import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const ProfileViewer = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', id));
        
        if (!userDoc.exists()) {
          setError('User not found');
          return;
        }

        setUserData(userDoc.data());
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load profile');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load profile',
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchUserData();
    }
  }, [id]);

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#e3e6f3', '#f7f8fa']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Profile Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: userData?.photoURL || 
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.displayName || 'User')}&background=667eea&color=fff&bold=true`
              }}
              style={styles.profileImage}
            />
          </View>

          {/* User Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.name}>{userData?.displayName || 'Unknown User'}</Text>
            
            {userData?.phoneNumber && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color="#667eea" />
                <Text style={styles.infoText}>{userData.phoneNumber}</Text>
              </View>
            )}

            {userData?.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color="#667eea" />
                <Text style={styles.infoText}>{userData.email}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons 
                name={userData?.isOnline ? "radio-button-on" : "radio-button-off"} 
                size={20} 
                color={userData?.isOnline ? "#4CAF50" : "#9e9e9e"} 
              />
              <Text style={[
                styles.infoText,
                { color: userData?.isOnline ? "#4CAF50" : "#9e9e9e" }
              ]}>
                {userData?.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  imageContainer: {
    alignItems: 'center',
    padding: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoContainer: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
});

export default ProfileViewer; 