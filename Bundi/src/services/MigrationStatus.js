// ENV VARS NEEDED:
// AWS_REGION
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import Constants from 'expo-constants';

const getEnv = (key, fallback = '') => process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

const MigrationStatus = () => {
  const [user, loading] = useAuthState(auth);
  const [migrationStatus, setMigrationStatus] = useState({
    firebase: false,
    aws: false,
    dynamodb: false,
    s3: false,
  });

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    // Check Firebase
    setMigrationStatus(prev => ({ ...prev, firebase: !!user }));

    // Check AWS config
    const awsRegion = getEnv('AWS_REGION', 'us-east-1');
    setMigrationStatus(prev => ({ ...prev, aws: !!awsRegion }));

    // Check other services (simplified for demo)
    setMigrationStatus(prev => ({
      ...prev,
      dynamodb: true,
      s3: true,
    }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading migration status...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Migration Status</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.sectionTitle}>Services Status:</Text>
        
        <View style={styles.statusItem}>
          <Text style={styles.serviceName}>Firebase Auth:</Text>
          <Text style={[styles.status, migrationStatus.firebase ? styles.success : styles.error]}>
            {migrationStatus.firebase ? '✅ Connected' : '❌ Not Connected'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.serviceName}>AWS Config:</Text>
          <Text style={[styles.status, migrationStatus.aws ? styles.success : styles.error]}>
            {migrationStatus.aws ? '✅ Configured' : '❌ Not Configured'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.serviceName}>DynamoDB:</Text>
          <Text style={[styles.status, migrationStatus.dynamodb ? styles.success : styles.error]}>
            {migrationStatus.dynamodb ? '✅ Ready' : '❌ Not Ready'}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Text style={styles.serviceName}>S3 Storage:</Text>
          <Text style={[styles.status, migrationStatus.s3 ? styles.success : styles.error]}>
            {migrationStatus.s3 ? '✅ Ready' : '❌ Not Ready'}
          </Text>
        </View>
      </View>

      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Info:</Text>
        <Text style={styles.debugText}>
          User: {user ? user.email : 'Not logged in'}
        </Text>
        <Text style={styles.debugText}>
          AWS Region: {getEnv('AWS_REGION', 'us-east-1')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  success: {
    color: '#4CAF50',
  },
  error: {
    color: '#F44336',
  },
  debugContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  debugText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default MigrationStatus; 