// UploadStatus.jsx - React Native version
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
};

const ICONS = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

export default function UploadStatus({ 
  message, 
  type, 
  visible, 
  onClose, 
  autoHideDuration = 6000 
}) {
  useEffect(() => {
    if (visible && (type === 'success' || type === 'info') && autoHideDuration) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [visible, type, onClose, autoHideDuration]);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}>
        <View style={{
          backgroundColor: COLORS[type] || COLORS.info,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 32,
          shadowColor: '#2c3e50',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 8,
          minWidth: 320,
          maxWidth: '90%',
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <Ionicons 
            name={ICONS[type] || ICONS.info} 
            size={22} 
            color="white" 
            style={{ marginRight: 16 }} 
          />
          <Text style={{
            flex: 1,
            color: 'white',
            fontWeight: '600',
            fontSize: 16,
            letterSpacing: 0.1,
          }}>
            {message}
          </Text>
          <TouchableOpacity 
            onPress={onClose}
            style={{
              marginLeft: 18,
              padding: 4,
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 22,
              fontWeight: '700',
              lineHeight: 22,
            }}>
              ×
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
