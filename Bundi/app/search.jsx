import React from 'react';
import { View, StatusBar, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Navbar from '../src/components/Navbar';
import UserSearch from '../src/components/friends/UserSearch';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const Search = () => {
  const router = useRouter();
  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: width > 768 ? 20 : 10,
        paddingVertical: 20,
      }}
    >
      <StatusBar style="light" />
      <View style={{
        backgroundColor: 'white',
        borderRadius: 24,
        shadowColor: '#2c3e50',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 15,
        width: '100%',
        maxWidth: 1200,
        height: '90%',
        minHeight: 600,
        overflow: 'hidden',
      }}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.replace('/home')}
          style={{ padding: 16, position: 'absolute', left: 0, top: 0, zIndex: 10 }}
        >
          <Ionicons name="arrow-back" size={28} color="#667eea" />
        </TouchableOpacity>
        <Navbar />
        <UserSearch />
      </View>
    </LinearGradient>
  );
};

export default Search; 