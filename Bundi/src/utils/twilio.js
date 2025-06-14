import twilio from 'twilio';

const client = twilio(
  'YOUR_TWILIO_ACCOUNT_SID',
  'YOUR_TWILIO_AUTH_TOKEN'
);

const verifyServiceSid = 'YOUR_TWILIO_VERIFY_SERVICE_SID';

const twilioConfig = {
  accountSid: 'YOUR_TWILIO_ACCOUNT_SID',
  authToken: 'YOUR_TWILIO_AUTH_TOKEN',
  verifyServiceSid: 'YOUR_TWILIO_VERIFY_SERVICE_SID'
};

export { client, verifyServiceSid, twilioConfig }; 