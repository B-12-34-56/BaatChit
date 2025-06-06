// app/index.js - Updated version
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { auth } from '../src/utils/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function Index() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupAnonymousUser = async () => {
      try {
        // Sign in anonymously if not already signed in
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Error setting up anonymous user:', error);
      } finally {
        setLoading(false);
      }
    };

    setupAnonymousUser();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return <Redirect href="/home" />;
}