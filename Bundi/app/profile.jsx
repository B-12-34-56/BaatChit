// Profile.jsx - React Native version
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db, storage } from "../src/utils/firebase";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../src/services/authService';
import { updateUserProfile, getUserById } from '../src/services/userService';
import { useAuthState } from 'react-firebase-hooks/auth';
import Navbar from '../src/components/Navbar';

const { width } = Dimensions.get('window');

const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 100;
const MAX_BIO_LENGTH = 200;

const Profile = () => {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [currentUser] = useAuthState(auth);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userToFetch = userId || currentUser?.uid;
        if (!userToFetch) return;

        const userData = await getUserById(userToFetch);
        setProfileUser(userData);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, currentUser]);

  const isOwnProfile = !userId || userId === currentUser?.uid;

  if (loading) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Text style={styles.loadingText}>Loading profile...</Text>
      </LinearGradient>
    );
  }

  if (!profileUser) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Text style={styles.errorText}>Profile not found</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#667eea" />
          </TouchableOpacity>
          <Navbar />
        </View>
        <ScrollView style={styles.scrollView}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ 
                  uri: profileUser.photoURL || 'https://ui-avatars.com/api/?name=' + (profileUser.displayName || 'User')
                }}
                style={styles.profileImage}
              />
              {isOwnProfile && (
                <TouchableOpacity 
                  style={styles.editAvatarButton}
                >
                  <Ionicons name="camera" size={20} color="white" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.displayName}>{profileUser.displayName}</Text>
            <Text style={styles.username}>@{profileUser.displayName?.toLowerCase().replace(/\s+/g, '')}</Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={24} color="#667eea" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profileUser.email}</Text>
              </View>
            </View>

            {profileUser.phoneNumber && (
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={24} color="#667eea" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{profileUser.phoneNumber}</Text>
                </View>
              </View>
            )}

            {profileUser.bio && (
              <View style={styles.infoItem}>
                <Ionicons name="information-circle-outline" size={24} color="#667eea" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Bio</Text>
                  <Text style={styles.infoValue}>{profileUser.bio}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={24} color="#667eea" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Joined</Text>
                <Text style={styles.infoValue}>
                  {profileUser.createdAt ? new Date(profileUser.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {isOwnProfile && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="pencil" size={20} color="white" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
    margin: width > 768 ? 8 : 4,
    marginTop: 40, // Add space for status bar
    borderRadius: 12,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    maxHeight: '80%',
    alignSelf: 'center',
    width: '95%',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#667eea',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3a3a5a',
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  infoSection: {
    padding: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    marginLeft: 10,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 13,
    color: '#3a3a5a',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    padding: 8,
    borderRadius: 6,
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 4,
  },
  editButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
});

export default Profile; 