import React, { useContext, useState, useRef, useEffect } from 'react';
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
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

async function getFileHash(uri) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    uri,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return digest;
}

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
    userId,
    userName: userName || 'Anonymous',
    timestamp: Date.now()
  };
  
  if (logSnap.exists()) {
    const currentData = logSnap.data();
    await updateDoc(logRef, {
      count: currentData.count + 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      uploads: [...(currentData.uploads || []), uploadEntry]
    });
  } else {
    await setDoc(logRef, {
      fileHash,
      count: 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      firstUploaderId: userId,
      firstUploaderName: userName || 'Anonymous',
      uploads: [uploadEntry]
    });
  }
}

async function uploadImageToFirebase(imageUri, userId, fileHash) {
  const storage = getStorage();
  const timestamp = Date.now();
  const fileName = `image_${timestamp}.jpg`;
  const storageRef = ref(storage, `user_uploads/${userId}/${fileName}`);
  
  // Convert image URI to blob
  const response = await fetch(imageUri);
  const blob = await response.blob();
  
  // Add custom metadata including the file hash
  const metadata = {
    customMetadata: {
      fileHash: fileHash,
      originalName: fileName,
      uploadTimestamp: timestamp.toString(),
      tag: 'original'
    }
  };
  await uploadBytes(storageRef, blob, metadata);
  return await getDownloadURL(storageRef);
}

const MessageInput = () => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setDuplicateWarning('');
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !imageUri) || !data.chatId) return;
    let imageHash = null;
    let imageUrl = null;
    let imageTag = null;
    
    if (imageUri) {
      imageHash = await getFileHash(imageUri);
      setDuplicateWarning('');
      setUploading(true);
      
      try {
        console.log('Checking for duplicates...');
        const log = await getUploadLog(imageHash);
        console.log('Duplicate check result:', log);
        
        if (log && log.count >= 2) {
          const firstUploader = log.firstUploaderName || 'Someone';
          const secondUploader = log.uploads && log.uploads[1] ? log.uploads[1].userName : 'Someone else';
          setDuplicateWarning(`This image has already been uploaded twice (first by ${firstUploader}, then by ${secondUploader}). Upload blocked.`);
          setUploading(false);
          return;
        } else if (log && log.count === 1) {
          imageTag = 'duplicate';
          const firstUploader = log.firstUploaderName || 'Someone';
          setDuplicateWarning(`Duplicate detected! This image was first uploaded by ${firstUploader}. [DUPLICATE]`);
        } else {
          imageTag = 'original';
          setDuplicateWarning('New image uploaded successfully! [ORIGINAL]');
        }
        
        console.log('Uploading to Firebase Storage...');
        imageUrl = await uploadImageToFirebase(imageUri, currentUser.uid, imageHash);
        console.log('Upload successful, URL:', imageUrl);
        
        console.log('Updating global upload log...');
        await incrementUploadLog(
          currentUser.uid, 
          currentUser.displayName || currentUser.email, 
          imageHash, 
          'image.jpg'
        );
        console.log('Global log updated');
      } catch (err) {
        console.error('Upload error:', err);
        setDuplicateWarning(`Image upload failed: ${err.message || 'Unknown error'}`);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    
    console.log('Sending message...');
    await messageService.sendMessage(
      data.chatId,
      {
        senderUid: currentUser.uid,
        senderDisplayName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        recipientDisplayName: data.user?.displayName,
        recipientPhotoURL: data.user?.photoURL,
        text: text || (imageUri ? '[Image]' : ''),
        type: imageUri ? 'image' : 'text',
        imageUrl,
        imageHash,
        imageTag,
        createdAt: new Date(),
      },
      data.user?.uid
    );
    
    setText('');
    setImageUri(null);
    setDuplicateWarning('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inputContainer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          style={styles.textInput}
          editable={!uploading}
        />
        
        <TouchableOpacity 
          onPress={handleImagePick} 
          style={styles.attachButton}
          disabled={uploading}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleSend} 
          style={[
            styles.sendButton,
            { opacity: uploading || (duplicateWarning && duplicateWarning.includes('blocked')) ? 0.5 : 1 }
          ]}
          disabled={uploading || (duplicateWarning && duplicateWarning.includes('blocked'))}
        >
          <Text style={styles.sendButtonText}>
            {uploading ? 'Uploading…' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {duplicateWarning ? (
        <Text style={[
          styles.warningText,
          { 
            color: duplicateWarning.includes('[DUPLICATE]') ? '#ff9800' : 
                   duplicateWarning.includes('blocked') ? '#e53e3e' : '#4caf50' 
          }
        ]}>
          {duplicateWarning}
        </Text>
      ) : null}
      
      {imageUri ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <TouchableOpacity
            onPress={() => {
              setImageUri(null);
              setDuplicateWarning('');
            }}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  warningText: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
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