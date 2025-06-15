import React, { useContext } from "react";
import { View, StyleSheet, Text } from "react-native";
import { ChatContext } from "../context/ChatContext";
import Chat from './Chat';

const Chats = () => {
  const context = useContext(ChatContext);
  
  // Handle case where context is not available
  if (!context) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Chat />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#666',
    fontSize: 16,
  },
});

export default Chats;
