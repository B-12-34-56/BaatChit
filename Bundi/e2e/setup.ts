import { device } from 'detox';

beforeAll(async () => {
  // Mock Firebase test environment
  await device.setURLBlacklist(['.*firebase.*']);
  await device.setURLBlacklist(['.*googleapis.*']);

  // Set test phone number and verification code
  await device.setURLBlacklist(['.*phone.*']);
  await device.setURLBlacklist(['.*verification.*']);

  // Mock Firebase Auth responses
  await device.setURLBlacklist(['.*identitytoolkit.*']);
  await device.setURLBlacklist(['.*securetoken.*']);
});

// Increase timeout for all tests
jest.setTimeout(120000); 