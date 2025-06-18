// ENV VARS NEEDED:
// FIREBASE_STORAGE_BUCKET
import Constants from 'expo-constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebase';
import * as FileSystem from 'expo-file-system';

const getEnv = (key, fallback = '') =>
  process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

export const uploadAvatarToFirebase = async (fileUri, userId) => {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    const fileName = `avatars/${userId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading avatar to Firebase:', error);
    throw error;
  }
};

export const uploadImageToFirebase = async (fileUri, folder = 'images') => {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image to Firebase:', error);
    throw error;
  }
}; 