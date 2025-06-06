// Navbar.jsx - React Native version
import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const Navbar = () => {
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
      <View style={{ flex: 1 }}></View>
    </View>
  );
};

export default Navbar;