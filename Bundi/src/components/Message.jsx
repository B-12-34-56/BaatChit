import React, { useContext, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
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
  
  const isOwner = currentUser && message.senderUid === currentUser.uid;
  
  const defaultAvatar = 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&bold=true';
  const avatarUrl = isOwner
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

  return (
    <>
      <View style={{
        flexDirection: isOwner ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        marginBottom: 18,
        paddingHorizontal: 14,
      }}>
        <View style={{ 
          alignItems: isOwner ? 'flex-end' : 'flex-start',
          marginHorizontal: 14,
        }}>
          <Image
            source={{ uri: avatarUrl }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              marginBottom: 4,
            }}
            contentFit="cover"
          />
          <Text style={{ 
            fontSize: 11, 
            color: '#aaa', 
            marginTop: 2 
          }}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
        
        <View style={{
          maxWidth: 280,
          backgroundColor: isOwner ? '#667eea' : '#f7f8fa',
          borderRadius: isOwner ? 16 : 16,
          borderTopLeftRadius: isOwner ? 16 : 4,
          borderTopRightRadius: isOwner ? 4 : 16,
          paddingHorizontal: 18,
          paddingVertical: 12,
          shadowColor: '#2c3e50',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}>
          {message.text && !message.text.startsWith('[Image:') && (
            <Text style={{ 
              color: isOwner ? 'white' : '#222',
              fontSize: 15,
              fontWeight: '500',
              lineHeight: 20,
            }}>
              {message.text}
            </Text>
          )}
          
          {message.type === 'image' && message.imageUrl && (
            <View style={{ 
              marginTop: message.text && !message.text.startsWith('[Image:') ? 8 : 0 
            }}>
              <TouchableOpacity 
                onPress={() => handleImagePress(message.imageUrl)}
                activeOpacity={0.9}
              >
                <Image 
                  source={{ uri: message.imageUrl }}
                  style={{ 
                    width: 220, 
                    height: 150,
                    borderRadius: 10,
                    backgroundColor: '#e0e0e0',
                  }}
                  contentFit="cover"
                  onError={(error) => {
                    console.log('Image load error in Message.jsx:', {
                      uri: message.imageUrl,
                      errorMessage: error?.error,
                    });
                  }}
                />
              </TouchableOpacity>
              {message.imageTag && (
                <Text style={{ 
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: '600',
                  color: message.imageTag === 'duplicate' ? '#ff9800' : '#4caf50',
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}>
                  [{message.imageTag}]
                </Text>
              )}
            </View>
          )}
          
          {message.img && !message.imageUrl && (
            <TouchableOpacity 
              onPress={() => handleImagePress(message.img)}
              activeOpacity={0.9}
            >
              <Image 
                source={{ uri: message.img }}
                style={{ 
                  marginTop: 8, 
                  width: 220, 
                  height: 150,
                  borderRadius: 10,
                }}
                contentFit="cover"
              />
            </TouchableOpacity>
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

export default Message;