const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Twilio client
const accountSid = 'YOUR_ACCOUNT_SID';
const authToken = 'YOUR_AUTH_TOKEN';
const client = twilio(accountSid, authToken);

// Function to send verification code
exports.sendVerification = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber } = data;
    
    // Send verification code via Twilio
    const verification = await client.verify.v2
      .services('YOUR_VERIFY_SERVICE_SID')
      .verifications.create({ to: phoneNumber, channel: 'sms' });
    
    return { success: true, verification };
  } catch (error) {
    console.error('Error sending verification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to verify code
exports.verifyCode = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber, code } = data;
    
    // Verify code with Twilio
    const verificationCheck = await client.verify.v2
      .services('YOUR_VERIFY_SERVICE_SID')
      .verificationChecks.create({ to: phoneNumber, code });
    
    if (verificationCheck.status === 'approved') {
      // Get or create user in Firebase Auth
      let user;
      try {
        user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          user = await admin.auth().createUser({
            phoneNumber: phoneNumber
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
    
    // Create a custom token using the phone number as the UID
    const token = await admin.auth().createCustomToken(phoneNumber);
    
    return { token };
  } catch (error) {
    console.error('Error generating custom token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
}); 