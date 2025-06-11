import React, { useEffect, useState } from "react";
import { View, StyleSheet, SafeAreaView } from "react-native";
import { auth, db } from "../utils/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Chats from "../components/Chats";
import FriendRequests from "../components/FriendRequests";

export default function HomePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for auth state
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  if (!user) {
    return null; // or a loading spinner, then redirect to /auth
  }

  return (
    <SafeAreaView style={styles.container}>
      <Navbar />
      <View style={styles.body}>
        <Sidebar />
        <View style={styles.main}>
          <Chats />
          <FriendRequests user={user} db={db} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, flexDirection: "row" },
  main: { flex: 1, padding: 16 },
});