import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { friendRequestService } from '../services/friendRequestService';

const AddFriend = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser] = useAuthState(auth);
  const [outgoing, setOutgoing] = useState([]);

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
      
      setStatus("Friend request sent!");
      setEmail("");
      
      // Refresh outgoing requests
      fetchOutgoing();
    } catch (err) {
      console.error('Friend request error (catch):', err);
      setStatus("Error: " + (err.message || err.toString()));
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
    <View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 8,
    marginBottom: 18,
  },
  input: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  status: {
    fontSize: 13,
  },
  pendingSection: {
    marginTop: 16,
  },
  pendingTitle: {
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 6,
  },
  noPending: {
    color: '#888',
    fontSize: 13,
  },
  requestsList: {
    maxHeight: 200,
  },
  requestItem: {
    marginBottom: 4,
  },
  requestText: {
    fontSize: 14,
    color: '#333',
  },
});

export default AddFriend;