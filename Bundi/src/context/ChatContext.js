import { createContext, useReducer, useEffect } from "react";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { View, ActivityIndicator, Text } from 'react-native';

export const ChatContext = createContext();

export const ChatContextProvider = ({ children }) => {
  const [currentUser, loading] = useAuthState(auth);
  
  const INITIAL_STATE = {
    chatId: null,
    user: {},
    initialized: false
  };

  const chatReducer = (state, action) => {
    switch (action.type) {
      case "CHANGE_USER":
        if (!currentUser?.uid) {
          console.warn('Attempted to change user before auth was ready');
          return state;
        }
        if (action.payload.chatId) {
          return {
            ...state,
            user: action.payload,
            chatId: action.payload.chatId,
            initialized: true
          };
        }
        const chatId = currentUser.uid > action.payload.uid
          ? currentUser.uid + action.payload.uid
          : action.payload.uid + currentUser.uid;
        return {
          ...state,
          user: action.payload,
          chatId: chatId,
          initialized: true
        };
      case "RESET":
        return {
          ...INITIAL_STATE,
          initialized: true
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);

  // Reset chat state when user changes
  useEffect(() => {
    if (!loading && !currentUser) {
      dispatch({ type: "RESET" });
    }
  }, [currentUser, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <ChatContext.Provider value={{ 
      data: state, 
      dispatch, 
      currentUser, 
      loading,
      initialized: state.initialized 
    }}>
      {children}
    </ChatContext.Provider>
  );
};
