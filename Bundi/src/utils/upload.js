import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadString, uploadBytes } from 'firebase/storage';
import { getDownloadURL } from 'firebase/storage';

/**
 * Converts a file URI to a Blob using XMLHttpRequest
 * @param {string} fileUri - The URI of the file to convert
 * @returns {Promise<Blob>} - A promise that resolves with the Blob
 */
export const getBlob = (fileUri) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      resolve(xhr.response);
    };
    xhr.onerror = (e) => {
      reject(new Error('Failed to get blob from URI'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', fileUri, true);
    xhr.send(null);
  });
};

/**
 * Uploads an image to Firebase Storage using base64 encoding
 * @param {string} path - The storage path where the image should be uploaded
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export const uploadImage = async (path) => {
  try {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) {
      throw new Error('Image picker was canceled');
    }

    const base64 = result.assets[0].base64;
    if (!base64) {
      throw new Error('No base64 data received from image picker');
    }

    // Create storage reference
    const storage = getStorage();
    const storageRef = ref(storage, path);

    // Upload base64 string
    const snapshot = await uploadString(storageRef, base64, 'base64');
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;

  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Uploads an image to Firebase Storage using blob
 * @param {string} path - The storage path where the image should be uploaded
 * @param {string} uri - The URI of the image to upload
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export const uploadImageFromUri = async (path, uri) => {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    
    // Get blob from URI and upload
    const blob = await getBlob(uri);
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image from URI:', error);
    throw error;
  }
}; 