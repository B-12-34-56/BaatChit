import { createContext, useContext, useReducer } from "react";
import { AuthContext } from "./AuthContext";

export const ChatContext = createContext();

export const ChatContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  
  const INITIAL_STATE = {
    chatId: null,
    user: {}
  };

  const chatReducer = (state, action) => {
    switch (action.type) {
      case "CHANGE_USER":
        // If payload includes chatId, use it directly
        if (action.payload.chatId) {
          return {
            user: action.payload,
            chatId: action.payload.chatId
          };
        }
        
        // Otherwise, create chatId from user IDs
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
    <ChatContext.Provider value={{ data: state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
};