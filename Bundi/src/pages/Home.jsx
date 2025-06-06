// Home.jsx - React Native version
import React, { useReducer } from 'react';
import { View, StatusBar, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Chats from '../components/chat/Chats';
import { ChatContext } from '../context/ChatContext';

const { width, height } = Dimensions.get('window');

const Home = () => {
  const [state, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case 'CHANGE_USER':
        return {
          ...state,
          user: action.payload
        };
      default:
        return state;
    }
  }, { user: null });

  return (
    <ChatContext.Provider value={{ data: state, dispatch }}>
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
              <View style={{ flex: 1 }}>
                <Navbar />
                <Chats />
              </View>
            </>
          ) : (
            // Mobile layout
            <View style={{ flex: 1 }}>
              <Navbar />
              <Sidebar />
            </View>
          )}
        </View>
      </LinearGradient>
    </ChatContext.Provider>
  );
};

export default Home;