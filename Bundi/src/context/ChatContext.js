// ChatContext.js - Debug version to identify the type error
import React, { createContext, useReducer, useEffect, useState } from "react";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';

// Helper function to ensure all values are the correct type
const sanitizeValue = (value) => {
  if (typeof value === 'string' && (value === 'true' || value === 'false')) {
    // Convert string booleans to actual booleans
    return value === 'true';
  }
  return value;
};

// Create context with default values to avoid undefined errors
export const ChatContext = createContext({
  data: {
    chatId: null,
    user: {}
  },
  dispatch: () => {},
  currentUser: null,
  loading: true
});

export const ChatContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Debug logging
  console.log('ChatContextProvider rendering, loading:', loading, 'type:', typeof loading);
  
  // Use onAuthStateChanged instead of useAuthState to avoid the type error
  useEffect(() => {
    console.log('Setting up auth listener...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      if (user) {
        // Sanitize user object to ensure no type mismatches
        const sanitizedUser = {
          uid: String(user.uid),
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          // Only include primitive values, no complex objects
        };
        console.log('Setting sanitized user:', sanitizedUser);
        setCurrentUser(sanitizedUser);
      } else {
        setCurrentUser(null);
      }
      console.log('Setting loading to false');
      setLoading(false);
    });
    
    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }, []);
  
  const INITIAL_STATE = {
    chatId: null,
    user: {}
  };

  const chatReducer = (state, action) => {
    console.log('chatReducer called with action:', action.type);
    
    switch (action.type) {
      case "CHANGE_USER":
        if (!action.payload) {
          console.warn('CHANGE_USER called with no payload');
          return state;
        }
        
        console.log('CHANGE_USER payload:', action.payload);
        
        // Sanitize the payload
        const sanitizedPayload = {
          uid: String(action.payload.uid || ''),
          displayName: String(action.payload.displayName || ''),
          email: action.payload.email || null,
          photoURL: action.payload.photoURL || null,
        };
        
        // If chatId is provided directly, use it
        if (action.payload.chatId) {
          return {
            user: sanitizedPayload,
            chatId: String(action.payload.chatId)
          };
        }
        
        // Guard if user not ready
        if (!currentUser?.uid) {
          console.warn('Cannot set chat - current user not ready');
          return state;
        }
        
        // Generate chatId from user IDs
        const uid1 = String(currentUser.uid);
        const uid2 = String(sanitizedPayload.uid);
        
        if (!uid2) {
          console.warn('Cannot set chat - recipient uid missing');
          return state;
        }
        
        const chatId = uid1 > uid2 ? uid1 + uid2 : uid2 + uid1;
        console.log('Generated chatId:', chatId);
        
        return {
          user: sanitizedPayload,
          chatId: chatId
        };
        
      case "CLEAR_CHAT":
        return INITIAL_STATE;
        
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);

  // Create a wrapped dispatch that logs actions
  const wrappedDispatch = React.useCallback((action) => {
    console.log('Dispatch called with:', action);
    dispatch(action);
  }, []);

  // Sanitize all context values before providing them
  const contextValue = React.useMemo(() => {
    const value = {
      data: state,
      dispatch: wrappedDispatch,
      currentUser,
      loading: Boolean(loading) // Ensure loading is always a boolean
    };
    console.log('Context value:', value);
    return value;
  }, [state, wrappedDispatch, currentUser, loading]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};