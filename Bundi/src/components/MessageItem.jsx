import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import ImageViewerModal from './ImageViewerModal';

const MessageItem = ({ message, isOwnMessage }) => {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImagePress = (imageUrl) => {
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
          >
            <Image
              source={{ uri: message.imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
              onError={(e) => console.error('Image loading error:', e.nativeEvent.error)}
            />
            {message.imageTag && (
              <Text style={[
                styles.imageTag,
                { color: message.imageTag === 'duplicate' ? '#ff9800' : '#4caf50' }
              ]}>
                [{message.imageTag.toUpperCase()}]
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.messageText}>{message.text}</Text>
        )}
        
        <Text style={styles.timestamp}>
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
        onClose={() => setImageViewerVisible(false)}
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
    color: '#000',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  imageTag: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default MessageItem;