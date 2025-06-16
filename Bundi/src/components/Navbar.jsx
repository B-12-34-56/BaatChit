// Navbar.jsx - React Native version
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const Navbar = () => {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              await AsyncStorage.multiRemove(['authSession', 'phoneNumber', 'verificationId']);
              router.replace('/phone-login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 0,
      minHeight: 48,
      backgroundColor: 'white',
      zIndex: 10,
      shadowColor: '#2c3e50',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 4,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontWeight: '800',
          fontSize: 22,
          color: '#667eea',
          letterSpacing: 0.5,
          textAlign: 'left',
        }}>
          Bundi/Kitab
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity 
          onPress={handleProfile}
          style={{
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Ionicons name="person-circle-outline" size={24} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleLogout}
          style={{
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#e53e3e" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Navbar;
