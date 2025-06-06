
import React, { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { ChatContext } from "../context/ChatContext";
import ConversationList from './chat/ConversationList';

const Chats = () => {
  const { dispatch } = useContext(ChatContext);

  // Handler for selecting a conversation
  const handleSelectConversation = (conversation) => {
    // conversation.otherUser should be the user object for the other participant
    dispatch({ type: 'CHANGE_USER', payload: conversation.otherUser });
  };

  return (
    <View style={styles.container}>
      <ConversationList onSelect={handleSelectConversation} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
    paddingVertical: 18,
    borderRadius: 18,
    marginHorizontal: 8,
    minWidth: 0,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default Chats;