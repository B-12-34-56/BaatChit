// Home.jsx - React Native version
import React from 'react';
import { View, StatusBar, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Sidebar from '../components/Sidebar';
import Chat from '../components/Chat';

const { width, height } = Dimensions.get('window');

const Home = () => {
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
        flexDirection: width > 768 ? 'row' : 'column',
        overflow: 'hidden',
      }}>
        {width > 768 ? (
          // Desktop/Tablet layout
          <>
            <Sidebar />
            <Chat />
          </>
        ) : (
          // Mobile layout - you might want to implement navigation here
          <View style={{ flex: 1 }}>
            <Sidebar />
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

export default Home;