// FriendRequestsDropdown.js - React Native conversion of FriendRequestsDropdown.jsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Image, StyleSheet, Alert } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { db } from '../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { friendRequestService } from '../services/friendRequestService';
import { getUserById } from '../services/userService';

const FriendRequestsDropdown = () => {
  const [currentUser] = useAuthState(auth);
  const [requests, setRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [acceptedId, setAcceptedId] = useState(null);
  const [newFriend, setNewFriend] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    
    let isMounted = true;
    
    const q = query(collection(db, 'friendRequests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, 
      async (snapshot) => {
        if (!isMounted) return;
        
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const withUserInfo = await Promise.all(reqs.map(async req => {
          const user = await getUserById(req.from);
          return { ...req, fromUser: user };
        }));
        setRequests(withUserInfo);
      },
      (error) => {
        if (!isMounted) return;
        console.error('FriendRequestsDropdown listener error:', error);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const handleAccept = async (id) => {
    setLoadingId(id);
    const result = await friendRequestService.acceptFriendRequest(id, currentUser.uid);
    if (!result.success) {
      Alert.alert('Error', result.message || 'Failed to accept request');
      setLoadingId(null);
      return;
    }
    setAcceptedId(id);
    Alert.alert('Success', 'Friend request accepted!');
    setNewFriend(result.friend);
    setTimeout(() => setAcceptedId(null), 1200);
    setLoadingId(null);
  };

  const handleReject = async (id) => {
    setLoadingId(id);
    await friendRequestService.rejectFriendRequest(id, currentUser.uid);
    setLoadingId(null);
  };

  const renderRequest = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image 
          source={{ 
            uri: item.fromUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (item.fromUser?.displayName || 'User') 
          }} 
          style={styles.avatar}
        />
        <View>
          <Text style={styles.displayName}>{item.fromUser?.displayName || item.from}</Text>
          <Text style={styles.email}>{item.fromUser?.email}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        {acceptedId === item.id ? (
          <View style={styles.acceptedContainer}>
            <Text style={styles.acceptedText}>✓ Accepted!</Text>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAccept(item.id)} 
              disabled={loadingId === item.id}
            >
              <Text style={styles.actionButtonText}>
                {loadingId === item.id ? 'Accepting...' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)} 
              disabled={loadingId === item.id}
            >
              <Text style={styles.actionButtonText}>
                {loadingId === item.id ? 'Rejecting...' : 'Reject'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.bellButton}>
        <Text style={styles.bellIcon}>🔔</Text>
        {requests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Main Modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setModalOpen(false)}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friend Requests</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            {requests.length === 0 ? (
              <Text style={styles.noRequests}>No pending requests</Text>
            ) : (
              <FlatList
                data={requests}
                renderItem={renderRequest}
                keyExtractor={(item) => item.id}
                style={styles.requestsList}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Friend Modal */}
      {newFriend && (
        <Modal
          visible={!!newFriend}
          transparent
          animationType="fade"
          onRequestClose={() => setNewFriend(null)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setNewFriend(null)}
          >
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>You are now friends!</Text>
                <TouchableOpacity onPress={() => setNewFriend(null)}>
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.newFriendInfo}>
                <Image 
                  source={{ 
                    uri: newFriend.photoURL || 'https://ui-avatars.com/api/?name=' + (newFriend.displayName || 'User') 
                  }} 
                  style={styles.newFriendAvatar}
                />
                <View>
                  <Text style={styles.newFriendName}>{newFriend.displayName || newFriend.uid}</Text>
                  <Text style={styles.newFriendEmail}>{newFriend.email}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setNewFriend(null)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e53e3e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44,62,80,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 32,
    minWidth: 340,
    maxWidth: '90%',
    maxHeight: '80%',
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 20,
  },
  closeButton: {
    fontSize: 22,
    color: '#888',
    fontWeight: 'bold',
  },
  noRequests: {
    color: '#888',
    fontWeight: '500',
  },
  requestsList: {
    maxHeight: 300,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  displayName: {
    fontWeight: '600',
    fontSize: 16,
  },
  email: {
    fontSize: 13,
    color: '#888',
  },
  requestActions: {
    alignItems: 'center',
  },
  acceptedContainer: {
    alignItems: 'center',
  },
  acceptedText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#e53e3e',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  newFriendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  newFriendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  newFriendName: {
    fontWeight: '600',
    fontSize: 18,
  },
  newFriendEmail: {
    fontSize: 14,
    color: '#888',
  },
  closeModalButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  closeModalButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default FriendRequestsDropdown;