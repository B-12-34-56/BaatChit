import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../src/utils/firebase';
import { useEffect } from 'react';

export default function RootLayout() {
  const [user, loading] = useAuthState(auth);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait for auth to load

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // User is not signed in and trying to access protected route
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // User is signed in but on auth screen
      router.replace('/home');
    }
  }, [user, loading, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide headers for all screens
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}