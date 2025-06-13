// Home.tsx
import React, { useState, useContext } from 'react';
import { View, Dimensions, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Import components from the correct paths
import Navbar from '../src/components/Navbar';
import Sidebar from '../src/components/Sidebar';
import Chats from '../src/components/Chats';
import Chat from '../src/components/Chat';
import { ChatContextProvider, ChatContext } from '../src/context/ChatContext';

const { width, height } = Dimensions.get('window');

export default function Home() {
  const [activeView, setActiveView] = useState('friends'); // 'friends' or 'chats'
  const router = useRouter();

  return (
    <ChatContextProvider>
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
              {activeView === 'friends' ? (
                <Sidebar />
              ) : (
                <ChatViewContainer />
              )}
              
              {/* Bottom Navigation */}
              <View style={{
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: '#e0e0e0',
                backgroundColor: 'white',
                paddingVertical: 12,
                paddingHorizontal: 20,
                justifyContent: 'space-around',
              }}>
                <TouchableOpacity 
                  onPress={() => setActiveView('friends')}
                  style={{
                    alignItems: 'center',
                    opacity: activeView === 'friends' ? 1 : 0.6,
                  }}
                >
                  <Ionicons 
                    name="people" 
                    size={24} 
                    color={activeView === 'friends' ? '#667eea' : '#666'} 
                  />
                  <Text style={{
                    color: activeView === 'friends' ? '#667eea' : '#666',
                    fontSize: 12,
                    marginTop: 4,
                  }}>
                    Friends
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setActiveView('chats')}
                  style={{
                    alignItems: 'center',
                    opacity: activeView === 'chats' ? 1 : 0.6,
                  }}
                >
                  <Ionicons 
                    name="chatbubbles" 
                    size={24} 
                    color={activeView === 'chats' ? '#667eea' : '#666'} 
                  />
                  <Text style={{
                    color: activeView === 'chats' ? '#667eea' : '#666',
                    fontSize: 12,
                    marginTop: 4,
                  }}>
                    Chats
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </ChatContextProvider>
  );
}

// Separate component to access context
const ChatViewContainer = () => {
  const { data } = useContext(ChatContext);
  
  return (
    <View style={{ flex: 1 }}>
      {data.user && data.chatId ? (
        <Chat />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#666', fontSize: 16 }}>
            Select a conversation to start chatting
          </Text>
        </View>
      )}
    </View>
  );
};
