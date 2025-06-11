import { by, device, element, expect } from 'detox';

describe('Phone Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete phone authentication flow', async () => {
    // Start at login screen
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await element(by.text('Continue with Phone')).tap();

    // Phone input screen
    await expect(element(by.text('Enter Phone Number'))).toBeVisible();
    
    // Enter phone number
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('7328908125');
    await expect(phoneInput).toHaveText('(732) 890-8125');

    // Mock Firebase response for phone verification
    await device.setURLBlacklist(['.*firebase.*']);
    await device.setURLBlacklist(['.*googleapis.*']);

    // Send verification code
    await element(by.text('Send Code')).tap();

    // Wait for OTP screen
    await expect(element(by.text('Enter Verification Code'))).toBeVisible();
    await expect(element(by.text('+17328908125'))).toBeVisible();

    // Enter test OTP code
    const otpInput = element(by.id('otp-input'));
    await otpInput.typeText('654321');

    // Wait for auto-verification
    await expect(element(by.text('Verifying...'))).toBeVisible();

    // Verify successful navigation to home
    await expect(element(by.text('Home'))).toBeVisible();
  });

  it('should handle invalid phone number', async () => {
    // Start at login screen
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await element(by.text('Continue with Phone')).tap();

    // Enter invalid phone number
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('123');

    // Try to send code
    await element(by.text('Send Code')).tap();

    // Verify error message
    await expect(element(by.text('Invalid phone number format'))).toBeVisible();
  });

  it('should handle resend code functionality', async () => {
    // Start at login screen
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await element(by.text('Continue with Phone')).tap();

    // Enter phone number
    const phoneInput = element(by.id('phone-input'));
    await phoneInput.typeText('7328908125');

    // Send verification code
    await element(by.text('Send Code')).tap();

    // Wait for OTP screen
    await expect(element(by.text('Enter Verification Code'))).toBeVisible();

    // Verify resend button is disabled initially
    const resendButton = element(by.text("Didn't receive the code? Resend"));
    await expect(resendButton).toBeVisible();
    await expect(resendButton).toBeDisabled();

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify resend button is enabled
    await expect(resendButton).toBeEnabled();
    await resendButton.tap();

    // Verify new code is sent
    await expect(element(by.text('Verification code sent'))).toBeVisible();
  });

  it('should handle back navigation', async () => {
    // Start at login screen
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await element(by.text('Continue with Phone')).tap();

    // Verify phone input screen
    await expect(element(by.text('Enter Phone Number'))).toBeVisible();

    // Go back to login
    await element(by.text('Back to Login')).tap();

    // Verify login screen
    await expect(element(by.text('Welcome Back'))).toBeVisible();
  });
}); 