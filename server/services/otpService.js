/**
 * OTP Service — Twilio Verify + Test Mode
 *
 * TEST MODE (OTP_TEST_MODE=true or no Twilio credentials):
 *   - OTP is always "123456"
 *   - No SMS is sent
 *   - OTP is printed to the server console
 *   - Stored in memory (Map), expires after 10 minutes
 *
 * PRODUCTION MODE:
 *   - Uses Twilio Verify API to send real SMS
 *   - Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
 */

const TEST_MODE =
  process.env.OTP_TEST_MODE === 'true' ||
  !process.env.TWILIO_ACCOUNT_SID ||
  !process.env.TWILIO_AUTH_TOKEN ||
  !process.env.TWILIO_VERIFY_SID;

const TEST_OTP = '123456';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// In-memory store for test mode — replace with Redis in production
const otpStore = new Map(); // phone → { otp, expires, attempts }

let verifyService = null;

if (!TEST_MODE) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  verifyService = client.verify.v2.services(process.env.TWILIO_VERIFY_SID);
}

/**
 * Normalize a phone number to E.164 format (+965XXXXXXXX for Kuwait)
 */
function normalizePhone(raw) {
  const cleaned = String(raw).replace(/[\s\-\(\)\.]/g, '');

  // Already E.164
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;

  // 965XXXXXXXX → +965XXXXXXXX
  if (/^965[0-9]{8}$/.test(cleaned)) return `+${cleaned}`;

  // 8-digit Kuwait mobile (starts with 5, 6, or 9)
  if (/^[569]\d{7}$/.test(cleaned)) return `+965${cleaned}`;

  return cleaned; // pass through, Twilio will reject if invalid
}

/**
 * Send OTP to a phone number.
 * Returns { testMode: boolean }
 */
async function sendOtp(phone) {
  const normalized = normalizePhone(phone);

  if (TEST_MODE) {
    otpStore.set(normalized, {
      otp: TEST_OTP,
      expires: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });
    console.log(`\n🔐 [OTP TEST MODE] Code for ${normalized}: ${TEST_OTP}\n`);
    return { testMode: true };
  }

  await verifyService.verifications.create({ to: normalized, channel: 'sms' });
  return { testMode: false };
}

/**
 * Verify an OTP code.
 * Returns { valid: boolean, reason?: string }
 */
async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);

  if (TEST_MODE) {
    const stored = otpStore.get(normalized);
    if (!stored) return { valid: false, reason: 'No code was sent to this number' };
    if (Date.now() > stored.expires) {
      otpStore.delete(normalized);
      return { valid: false, reason: 'Code has expired' };
    }
    if (stored.attempts >= 5) {
      otpStore.delete(normalized);
      return { valid: false, reason: 'Too many attempts' };
    }
    if (stored.otp !== String(code)) {
      stored.attempts += 1;
      return { valid: false, reason: 'Incorrect code' };
    }
    otpStore.delete(normalized);
    return { valid: true };
  }

  const result = await verifyService.verificationChecks.create({ to: normalized, code: String(code) });
  return { valid: result.status === 'approved' };
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
