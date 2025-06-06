import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide headers for all screens
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
} 