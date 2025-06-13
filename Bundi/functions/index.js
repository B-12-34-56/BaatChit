const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');
const crypto = require('crypto');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  throw new Error('Missing required Twilio environment variables');
}

const client = twilio(accountSid, authToken);

// Secret key for password generation - should be stored in environment variables
const PASSWORD_SECRET_KEY = process.env.PASSWORD_SECRET_KEY || 'your-secret-key';

// Function to generate deterministic password
const generatePassword = (phoneNumber) => {
  return crypto
    .createHash('sha256')
    .update(`${phoneNumber}_${PASSWORD_SECRET_KEY}`)
    .digest('hex')
    .substring(0, 16);
};

// Function to send verification code
exports.sendVerification = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber } = data;
    
    // Send verification code via Twilio
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: 'sms' });
    
    return { success: true, verification };
  } catch (error) {
    console.error('Error sending verification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to verify code and create/update user
exports.verifyCode = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber, code } = data;
    
    // Verify code with Twilio
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code });
    
    if (verificationCheck.status === 'approved') {
      // Generate deterministic password
      const tempPassword = generatePassword(phoneNumber);
      
      // Get or create user in Firebase Auth
      let user;
      try {
        user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Create new user with phone number and generated password
          user = await admin.auth().createUser({
            phoneNumber: phoneNumber,
            password: tempPassword,
            email: `${phoneNumber}@temp.baatchit.com` // Temporary email
          });
        } else {
          throw error;
        }
      }
      
      // Create custom token
      const customToken = await admin.auth().createCustomToken(user.uid);
      
      return {
        success: true,
        customToken,
        user: {
          uid: user.uid,
          phoneNumber: user.phoneNumber
        }
      };
    } else {
      throw new Error('Invalid verification code');
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to generate custom token
exports.getCustomToken = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber } = data;
    
    // Generate deterministic password
    const tempPassword = generatePassword(phoneNumber);
    
    // Create a custom token using the phone number as the UID
    const token = await admin.auth().createCustomToken(phoneNumber);
    
    return { token };
  } catch (error) {
    console.error('Error generating custom token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Phone verification and token creation
exports.verifyPhoneAndCreateToken = functions.https.onCall(async (data, context) => {
  try {
    console.log('Received data:', data);
    const { phoneNumber } = data;
    
    if (!phoneNumber) {
      console.error('Phone number is missing');
      throw new functions.https.HttpsError('invalid-argument', 'Phone number is required');
    }

    // Generate deterministic password
    const tempPassword = generatePassword(phoneNumber);

    console.log('Checking for existing user with phone:', phoneNumber);
    // Check if user exists
    const userSnapshot = await admin.firestore()
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    let userId;
    
    if (userSnapshot.empty) {
      console.log('Creating new user for phone:', phoneNumber);
      // Create new user
      const userRef = await admin.firestore().collection('users').add({
        phoneNumber,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        displayName: `User ${phoneNumber.slice(-4)}`,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(phoneNumber.slice(-4))}&background=667eea&color=fff&bold=true`
      });
      userId = userRef.id;
      console.log('Created new user with ID:', userId);
    } else {
      console.log('Found existing user:', userSnapshot.docs[0].id);
      // Update existing user
      userId = userSnapshot.docs[0].id;
      await userSnapshot.docs[0].ref.update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
    }

    console.log('Creating custom token for user:', userId);
    // Create custom token
    const customToken = await admin.auth().createCustomToken(userId, {
      phoneNumber
    });

    console.log('Successfully created custom token');
    return { 
      customToken,
      userId,
      phoneNumber
    };
  } catch (error) {
    console.error('Error in verifyPhoneAndCreateToken:', error);
    throw new functions.https.HttpsError('internal', error.message || 'An unexpected error occurred');
  }
}); 