import { createContext, useReducer } from "react";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

export const ChatContext = createContext();

export const ChatContextProvider = ({ children }) => {
  const [currentUser, loading] = useAuthState(auth);
  
  const INITIAL_STATE = {
    chatId: null,
    user: {}
  };

  const chatReducer = (state, action) => {
    switch (action.type) {
      case "CHANGE_USER":
        if (action.payload.chatId) {
          return {
            user: action.payload,
            chatId: action.payload.chatId
          };
        }
        if (!currentUser?.uid) return state; // Guard if user not ready
        const chatId = currentUser.uid > action.payload.uid
          ? currentUser.uid + action.payload.uid
          : action.payload.uid + currentUser.uid;
        return {
          user: action.payload,
          chatId: chatId
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);

  return (
    <ChatContext.Provider value={{ data: state, dispatch, currentUser, loading }}>
      {children}
    </ChatContext.Provider>
  );
};