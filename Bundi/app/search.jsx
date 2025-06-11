import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import UserSearchComponent from '../src/components/Search';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Search Users',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            color: '#333',
          },
        }}
      />
      <View style={styles.content}>
        <UserSearchComponent />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
}); 