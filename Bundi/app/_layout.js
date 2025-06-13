import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { auth } from '../src/utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { AuthProvider } from '../src/contexts/AuthContext';

const RootLayoutNav = () => {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) {
      const inAuthGroup = segments[0] === '(auth)';
      const isVerifyOTP = segments[segments.length - 1] === 'verify-otp';
      
      if (!user && !inAuthGroup && !isVerifyOTP) {
        // Redirect to the sign-in page
        router.replace('/phone-login');
      } else if (user && inAuthGroup && !isVerifyOTP) {
        // Redirect away from the sign-in page
        router.replace('/home');
      }
    }
  }, [user, loading, segments]);

  if (loading) {
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
          headerShown: false
        }}
      />
      <Stack.Screen
        name="verify-otp"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false
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
};

const RootLayout = () => {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
};

export default RootLayout;
