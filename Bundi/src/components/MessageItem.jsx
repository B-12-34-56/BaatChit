import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import ImageViewerModal from './ImageViewerModal';

const MessageItem = ({ message, isOwnMessage }) => {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImagePress = (imageUrl) => {
    // Prevent any default behavior
    if (Platform.OS === 'web') {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }
    
    console.log('Image pressed, opening viewer for:', imageUrl);
    setSelectedImage(imageUrl);
    setImageViewerVisible(true);
  };

  return (
    <>
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {message.type === 'image' && message.imageUrl ? (
          <TouchableOpacity
            onPress={() => handleImagePress(message.imageUrl)}
            activeOpacity={0.9}
            style={styles.imageWrapper}
            // Disable any system gestures that might interfere
            delayLongPress={500}
          >
            <View pointerEvents="box-only">
              <Image
                source={{ uri: message.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
                onError={(e) => console.error('Image loading error in MessageItem.jsx:', { 
                  uri: message.imageUrl,
                  errorMessage: e.nativeEvent.error 
                })}
                // Prevent image from being draggable/clickable as a link
                draggable={false}
              />
              {message.imageTag && message.imageTag !== 'original' && (
                <View style={[
                  styles.imageTagContainer,
                  message.imageTag === 'duplicate' && styles.duplicateTag,
                  message.imageTag === 'similar' && styles.similarTag,
                  message.imageTag === 'blocked' && styles.blockedTag,
                ]}>
                  <Text style={styles.imageTagText}>
                    {message.imageTag.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={[
            styles.messageText,
            isOwnMessage && styles.ownMessageText
          ]}>
            {message.text}
          </Text>
        )}
        
        <Text style={[
          styles.timestamp,
          isOwnMessage && styles.ownTimestamp
        ]}>
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>

      {/* Image Viewer Modal */}
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
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  ownMessageText: {
    color: '#fff',
  },
  imageWrapper: {
    position: 'relative',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  imageTagContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  duplicateTag: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
  },
  similarTag: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
  },
  blockedTag: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
  },
  imageTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default MessageItem;