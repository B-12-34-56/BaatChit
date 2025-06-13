import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../src/utils/firebase';

export default function RootLayoutNav() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const segments = useSegments();
  const navigationRef = useRef(false); // Prevent multiple navigations

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await AsyncStorage.getItem('authSession');
      if (session) {
        const { phoneNumber } = JSON.parse(session);
        setUser({ uid: phoneNumber, phoneNumber });
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only navigate once after initial load
    if (!isLoading && !navigationRef.current) {
      const inAuthGroup = segments[0] === '(auth)';
      const currentRoute = segments.join('/');
      
      if (!user && !inAuthGroup && currentRoute !== 'phone-login') {
        // Redirect to the sign-in page
        navigationRef.current = true;
        router.replace('/phone-login');
      } else if (user && inAuthGroup && currentRoute !== 'home') {
        // Redirect away from the sign-in page
        navigationRef.current = true;
        router.replace('/home');
      }
    }
  }, [user, isLoading]); // Remove segments from dependencies

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="phone-login"
        options={{
          headerShown: false,
          title: 'Phone Login'
        }}
      />
      <Stack.Screen
        name="verify-otp"
        options={{
          headerShown: false,
          title: 'Verify OTP'
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
          title: 'Home'
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: 'Profile'
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          headerShown: true,
          title: 'Search'
        }}
      />
    </Stack>
  );
}
