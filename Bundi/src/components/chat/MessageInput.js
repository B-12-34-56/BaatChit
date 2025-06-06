import React, { useContext, useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { ChatContext } from '../../context/ChatContext';
import { messageService } from '../../services/messageService';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const MessageInput = () => {
  console.log('MessageInput rendering...');
  
  try {
    const { data, currentUser } = useContext(ChatContext);
    
    const [text, setText] = useState('');
    const [imageUri, setImageUri] = useState(null);
    const [imageFileInfo, setImageFileInfo] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState('');

    // Generate hash from actual file content
    const getFileHash = async (uri) => {
      try {
        // Fetch the file as base64
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64String = reader.result.split(',')[1]; // Remove data:image/... prefix
            resolve(base64String);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;
        
        // Generate hash from base64 content
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          base64Data,
          { encoding: Crypto.CryptoEncoding.HEX }
        );
        
        console.log('Generated content hash:', hash);
        return hash;
      } catch (error) {
        console.error('Hash generation failed:', error);
        // Fallback - this should rarely happen
        return `fallback_${Date.now()}_${Math.random().toString(36)}`;
      }
    };

    // GLOBAL duplicate and count check
    async function getUploadLog(fileHash) {
      const db = getFirestore();
      const logRef = doc(db, "global_upload_logs", fileHash);
      const logSnap = await getDoc(logRef);
      return logSnap.exists() ? logSnap.data() : null;
    }

    async function incrementUploadLog(userId, userName, fileHash, fileName) {
      const db = getFirestore();
      const logRef = doc(db, "global_upload_logs", fileHash);
      const logSnap = await getDoc(logRef);
      
      const uploadEntry = {
        userId: String(userId),
        userName: String(userName || 'Anonymous'),
        timestamp: Date.now()
      };
      
      if (logSnap.exists()) {
        const currentData = logSnap.data();
        await updateDoc(logRef, {
          count: currentData.count + 1,
          lastUploadedAt: serverTimestamp(),
          fileName: String(fileName),
          uploads: [...(currentData.uploads || []), uploadEntry]
        });
      } else {
        await setDoc(logRef, {
          fileHash: String(fileHash),
          count: 1,
          lastUploadedAt: serverTimestamp(),
          fileName: String(fileName),
          firstUploaderId: String(userId),
          firstUploaderName: String(userName || 'Anonymous'),
          uploads: [uploadEntry]
        });
      }
    }

    const handleImagePick = async () => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Permission to access gallery is required!');
          return;
        }

        console.log('Opening image picker...');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], // Use lowercase 'images' directly
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        console.log('Image picker result:', result);

        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          
          // Check file size (10MB limit in your storage rules)
          if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
            Alert.alert('Image Too Large', 'Please select an image smaller than 10MB');
            return;
          }
          
          setImageUri(asset.uri);
          setImageFileInfo({
            uri: asset.uri,
            fileName: asset.fileName || `image_${Date.now()}.jpg`,
            fileSize: asset.fileSize || 0
          });
          setDuplicateWarning('');
          console.log('Image selected:', asset.uri);
          console.log('File size:', asset.fileSize ? `${(asset.fileSize / 1024 / 1024).toFixed(2)}MB` : 'unknown');
        }
      } catch (error) {
        console.error('Error picking image:', error);
        Alert.alert('Error', 'Failed to open image picker');
      }
    };

    const uploadImageToFirebase = async (imageUri, userId, fileHash) => {
      try {
        const storage = getStorage();
        const timestamp = Date.now();
        const fileName = `image_${timestamp}.jpg`;
        const storageRef = ref(storage, `user_uploads/${userId}/${fileName}`);
        
        console.log('Fetching image from URI:', imageUri);
        const response = await fetch(imageUri);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log('Blob created, size:', blob.size, 'type:', blob.type);
        
        // Check if blob is valid
        if (!blob.size) {
          throw new Error('Image blob is empty');
        }
        
        const metadata = {
          contentType: blob.type || 'image/jpeg',
          customMetadata: {
            fileHash: String(fileHash),
            originalName: String(fileName),
            uploadTimestamp: String(timestamp),
            tag: 'original'
          }
        };
        
        console.log('Uploading to path:', `user_uploads/${userId}/${fileName}`);
        console.log('Metadata:', metadata);
        
        const uploadTask = await uploadBytes(storageRef, blob, metadata);
        console.log('Upload complete:', uploadTask);
        
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Download URL obtained:', downloadURL);
        
        return downloadURL;
      } catch (error) {
        console.error('Firebase upload error details:', {
          code: error.code,
          message: error.message,
          serverResponse: error.serverResponse,
          customData: error.customData
        });
        throw error;
      }
    };

    const handleSend = async () => {
      if ((!text.trim() && !imageUri) || !data.chatId) {
        console.log('Cannot send - missing text/image or chatId');
        return;
      }
      
      let imageUrl = null;
      let imageHash = null;
      let imageTag = null;
      
      if (imageUri) {
        setUploading(true);
        try {
          // Debug: Check current user
          console.log('Current user before upload:', {
            uid: currentUser?.uid,
            email: currentUser?.email,
            displayName: currentUser?.displayName
          });
          
          // Debug: Check file info
          console.log('Image file info:', imageFileInfo);
          
          console.log('Generating image hash...');
          imageHash = await getFileHash(imageUri);
          console.log('Image hash:', imageHash);
          
          console.log('Checking for duplicates...');
          const log = await getUploadLog(imageHash);
          console.log('Duplicate check result:', log);
          
          if (log && log.count >= 2) {
            const firstUploader = log.firstUploaderName || 'Someone';
            const secondUploader = log.uploads && log.uploads[1] ? log.uploads[1].userName : 'Someone else';
            setDuplicateWarning(`This image has already been uploaded twice (first by ${firstUploader}, then by ${secondUploader}). Upload blocked.`);
            setUploading(false);
            
            Alert.alert(
              'Duplicate Image', 
              `This image has already been uploaded twice and cannot be uploaded again.`,
              [{ text: 'OK' }]
            );
            return;
          } else if (log && log.count === 1) {
            imageTag = 'duplicate';
            const firstUploader = log.firstUploaderName || 'Someone';
            setDuplicateWarning(`Duplicate detected! This image was first uploaded by ${firstUploader}. [DUPLICATE]`);
          } else {
            imageTag = 'original';
            setDuplicateWarning('New image uploaded successfully! [ORIGINAL]');
          }
          
          console.log('Uploading image to Firebase Storage...');
          imageUrl = await uploadImageToFirebase(imageUri, currentUser.uid, imageHash);
          console.log('Image uploaded successfully:', imageUrl);
          
          console.log('Updating global upload log...');
          await incrementUploadLog(
            currentUser.uid,
            currentUser.displayName || currentUser.email,
            imageHash,
            imageFileInfo?.fileName || 'image.jpg'
          );
          console.log('Global log updated');
          
        } catch (error) {
          console.error('Image upload failed:', error);
          console.error('Full error details:', {
            name: error.name,
            code: error.code,
            message: error.message,
            stack: error.stack
          });
          
          // Provide more specific error messages
          let errorMessage = 'Could not upload image. ';
          if (error.code === 'storage/unauthorized') {
            errorMessage += 'Permission denied. Please check Firebase Storage rules.';
          } else if (error.code === 'storage/quota-exceeded') {
            errorMessage += 'Storage quota exceeded.';
          } else if (error.code === 'storage/unauthenticated') {
            errorMessage += 'You must be logged in to upload images.';
          } else if (error.message.includes('fetch')) {
            errorMessage += 'Failed to process the image file.';
          } else {
            errorMessage += error.message || 'Please try again.';
          }
          
          Alert.alert('Upload Failed', errorMessage);
          setUploading(false);
          return;
        }
        setUploading(false);
      }
      
      console.log('Sending message:', text || '[Image]');
      
      try {
        await messageService.sendMessage(
          data.chatId,
          {
            senderUid: currentUser.uid,
            senderDisplayName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL,
            recipientDisplayName: data.user?.displayName,
            recipientPhotoURL: data.user?.photoURL,
            text: text || (imageUri ? `[Image: ${imageFileInfo?.fileName || 'image.jpg'}]` : ''),
            type: imageUri ? 'image' : 'text',
            imageUrl,
            imageHash,
            imageTag,
            createdAt: new Date(),
          },
          data.user?.uid
        );
        
        console.log('Message sent successfully!');
        setText('');
        setImageUri(null);
        setImageFileInfo(null);
        setDuplicateWarning('');
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Send failed', 'Could not send message. Please try again.');
      }
    };

    // Ensure boolean values are actual booleans
    const isUploading = Boolean(uploading);
    const isBlocked = Boolean(duplicateWarning && duplicateWarning.includes('blocked'));

    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {duplicateWarning ? (
          <View style={styles.warningContainer}>
            <Text style={[
              styles.warningText,
              { 
                color: duplicateWarning.includes('[DUPLICATE]') ? '#ff9800' : 
                       duplicateWarning.includes('blocked') ? '#e53e3e' : '#4caf50' 
              }
            ]}>
              {duplicateWarning}
            </Text>
          </View>
        ) : null}
        
        <View style={styles.inputContainer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            style={styles.textInput}
            editable={!isUploading}
          />
          
          <TouchableOpacity 
            onPress={handleImagePick} 
            style={styles.attachButton}
            disabled={isUploading}
          >
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleSend} 
            style={[
              styles.sendButton,
              { 
                opacity: (isUploading || isBlocked) ? 0.5 : 1 
              }
            ]}
            disabled={isUploading || isBlocked}
          >
            <Text style={styles.sendButtonText}>
              {isUploading ? 'Uploading...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {imageUri && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.imageInfo}>
              <Text style={styles.imageFileName}>
                {imageFileInfo?.fileName || 'image.jpg'}
              </Text>
              {imageFileInfo?.fileSize ? (
                <Text style={styles.imageFileSize}>
                  ({Math.round(imageFileInfo.fileSize / 1024)} KB)
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => {
                setImageUri(null);
                setImageFileInfo(null);
                setDuplicateWarning('');
              }}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  } catch (error) {
    console.error('MessageInput error:', error);
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading message input</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  warningContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  warningText: {
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 24,
  },
  sendButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    padding: 20,
    textAlign: 'center',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  imageInfo: {
    flex: 1,
  },
  imageFileName: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  imageFileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 24,
    color: '#e53e3e',
    fontWeight: 'bold',
  },
});

export default MessageInput;