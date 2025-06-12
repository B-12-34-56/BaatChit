import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { friendRequestService } from '../services/friendRequestService';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

const AddFriend = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser] = useAuthState(auth);
  const [outgoing, setOutgoing] = useState([]);
  const router = useRouter();

  const handleAddFriend = async () => {
    setStatus("");
    
    if (!email) {
      setStatus("Please enter an email.");
      return;
    }
    
    try {
      // Find user by email
      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnap = await getDocs(userQuery);
      
      if (userSnap.empty) {
        setStatus("User not found");
        return;
      }
      
      const friendUid = userSnap.docs[0].id;
      
      if (friendUid === currentUser.uid) {
        setStatus("You cannot add yourself as a friend.");
        return;
      }
      
      // Send friend request
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, friendUid);
      
      if (!result.success) {
        console.error('Friend request error:', result);
        setStatus("Error: " + (result.message || "Failed to send friend request"));
        return;
      }
      
      Toast.show({
        type: 'success',
        text1: 'Friend request sent!',
      });
      
      setStatus("Friend request sent!");
      setEmail("");
      
      // Refresh outgoing requests
      fetchOutgoing();
    } catch (err) {
      console.error('Friend request error (catch):', err);
      setStatus("Error: " + (err.message || err.toString()));
      Toast.show({
        type: 'error',
        text1: 'Error sending friend request',
        text2: err.message
      });
    }
  };

  const fetchOutgoing = async () => {
    if (!currentUser?.uid) return;
    const reqs = await friendRequestService.getOutgoingRequests(currentUser.uid);
    setOutgoing(reqs);
  };

  React.useEffect(() => {
    fetchOutgoing();
  }, [currentUser]);

  const renderOutgoingRequest = ({ item }) => (
    <View style={styles.requestItem}>
      <Text style={styles.requestText}>
        To: {item.recipientInfo?.displayName || item.recipientInfo?.email || item.receiverId}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          placeholder="Add friend by email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={styles.button}
          onPress={handleAddFriend}
        >
          <Text style={styles.buttonText}>Add Friend</Text>
        </TouchableOpacity>
        {status ? (
          <Text style={[
            styles.status,
            { color: status.startsWith('Error') ? '#e53e3e' : '#4CAF50' }
          ]}>
            {status}
          </Text>
        ) : null}
      </View>
      
      <View style={styles.pendingSection}>
        <Text style={styles.pendingTitle}>
          Pending Friend Requests
        </Text>
        {outgoing.length === 0 ? (
          <Text style={styles.noPending}>No pending requests.</Text>
        ) : (
          <FlatList
            data={outgoing}
            renderItem={renderOutgoingRequest}
            keyExtractor={(item) => item.id}
            style={styles.requestsList}
          />
        )}
      </View>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  form: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  pendingSection: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  noPending: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  requestsList: {
    flex: 1,
  },
  requestItem: {
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestText: {
    fontSize: 14,
    color: '#333',
  },
});

export default AddFriend;