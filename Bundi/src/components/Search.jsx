// Search.jsx - React Native version
import React, { useContext, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  FlatList,
  Alert
} from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { Ionicons } from '@expo/vector-icons';

const Search = () => {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(false);
  const [currentUser] = useAuthState(auth);

  const handleSearch = async () => {
    setErr(false);
    setUser(null);
    let q = query(collection(db, "users"));
    try {
      const querySnapshot = await getDocs(q);
      let results = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!username) {
          results.push({ uid: docSnap.id, ...data });
        } else if (username.includes('@')) {
          if (data.email && data.email.toLowerCase() === username.toLowerCase()) {
            results.push({ uid: docSnap.id, ...data });
          }
        } else {
          if (data.displayName && data.displayName.toLowerCase().includes(username.toLowerCase())) {
            results.push({ uid: docSnap.id, ...data });
          }
        }
      });
      if (results.length === 0) {
        setErr(true);
      } else {
        setUser(results);
      }
    } catch (error) {
      setErr(true);
    }
  };

  const handleSelect = async (selectedUser) => {
    // check whether the group(chats in firestore) exists, if not create
    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;
    try {
      const res = await getDoc(doc(db, "chats", combinedId));

      if (!res.exists()) {
        // create a chat in chats collection
        await setDoc(doc(db, "chats", combinedId), {
          messages: [],
        });

        // create user chats
        await updateDoc(
          doc(db, "userChats", currentUser.uid), {
            [combinedId + ".userInfo"]: {
              uid: selectedUser.uid,
              displayName: selectedUser.displayName,
              photoURL: selectedUser.photoURL,
            },
            [combinedId + ".date"]: serverTimestamp(),
        });

        await updateDoc(
          doc(db, "userChats", selectedUser.uid), {
            [combinedId + ".userInfo"]: {
              uid: currentUser.uid,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            },
            [combinedId + ".date"]: serverTimestamp(),
        });
      }
    } catch (err) {
      Alert.alert("Error", "Failed to create chat");
    }

    setUser(null);
    setUsername("");
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleSelect(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        marginTop: 8,
        shadowColor: '#2c3e50',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Image 
        source={{ uri: item.photoURL || 'https://ui-avatars.com/api/?name=' + (item.displayName || 'User') }} 
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18,
          marginRight: 14,
        }} 
      />
      <View>
        <Text style={{ 
          fontWeight: '700', 
          fontSize: 15, 
          color: '#3a3a5a' 
        }}>
          {item.displayName}
        </Text>
        <Text style={{ 
          fontSize: 13, 
          color: '#888' 
        }}>
          {item.email}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ width: '100%' }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f8fa',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 10,
        shadowColor: '#2c3e50',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}>
        <Ionicons name="search" size={20} color="#667eea" style={{ opacity: 0.6, marginRight: 8 }} />
        <TextInput
          placeholder="Find a user"
          onChangeText={setUsername}
          value={username}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
            color: '#222',
            paddingVertical: 8,
          }}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          onPress={handleSearch}
          style={{
            backgroundColor: '#667eea',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 8,
            marginLeft: 6,
          }}
        >
          <Text style={{
            color: 'white',
            fontWeight: '600',
            fontSize: 14,
          }}>
            Search
          </Text>
        </TouchableOpacity>
      </View>
      
      {err && (
        <Text style={{ 
          color: "#e53e3e", 
          fontSize: 13, 
          fontWeight: '500',
          marginTop: 4 
        }}>
          User not found!
        </Text>
      )}
      
      {user && Array.isArray(user) && (
        <FlatList
          data={user}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default Search;