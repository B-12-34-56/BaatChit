import React, { useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from 'expo-image';
import { ChatContext } from "../context/ChatContext";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import ImageViewerModal from './ImageViewerModal';

const Message = ({ message }) => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [imageLoading, setImageLoading] = useState(!!message.imageUrl);
  
  const isOutgoing = message.senderUid === currentUser?.uid;
  
  const defaultAvatar = 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&bold=true';
  const avatarUrl = isOutgoing
    ? (currentUser?.photoURL || defaultAvatar)
    : (data.user?.photoURL || defaultAvatar);

  const handleImagePress = (imageUrl) => {
    if (!imageUrl) return;
    setSelectedImage(imageUrl);
    setImageViewerVisible(true);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'just now';
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Simple image loading check - no need for waitForS3 since images are already uploaded
  useEffect(() => {
    if (message.imageUrl) {
      setImageLoading(true);
      setImageError(null);
      
      // Simple check if image loads successfully
      const img = new Image();
      img.onload = () => {
        setImageLoading(false);
        setImageError(null);
      };
      img.onerror = () => {
        setImageLoading(false);
        setImageError('Image failed to load');
      };
      img.src = message.imageUrl;
    }
  }, [message.imageUrl]);

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
          marginVertical: 6,
          paddingHorizontal: 10,
        }}
      >
        <View style={[
          styles.bubble,
          isOutgoing ? styles.outgoing : styles.incoming
        ]}>
          {/* TEXT (if any) */}
          {!!message.text && (
            <Text style={[styles.text, isOutgoing ? styles.textOutgoing : styles.textIncoming]}>{message.text}</Text>
          )}

          {/* IMAGE (if any) */}
          {message.imageUrl && (
            <>
              {imageLoading && <ActivityIndicator size="small" />}
              {imageError && (
                <Text style={styles.error}>
                  {imageError}
                </Text>
              )}
              {!imageLoading && !imageError && (
                <TouchableOpacity 
                  onPress={() => handleImagePress(message.imageUrl)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: message.imageUrl }}
                    style={styles.image}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImage}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImage(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bubble: {
    marginVertical: 2,
    padding: 10,
    borderRadius: 16,
    maxWidth: '80%',
    minWidth: 40,
  },
  outgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
    borderTopRightRadius: 4,
  },
  incoming: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e5ea',
    borderTopLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 2,
  },
  textOutgoing: {
    color: '#fff',
  },
  textIncoming: {
    color: '#222',
  },
  error: { 
    color: '#f88', 
    fontSize: 12 
  },
  image: { 
    width: 160, 
    height: 160, 
    borderRadius: 8, 
    marginTop: 4 
  },
});

export default Message;