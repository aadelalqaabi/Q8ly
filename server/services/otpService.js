/**
 * OTP Service — Twilio Verify + Test Mode
 *
 * TEST MODE (OTP_TEST_MODE=true, missing credentials, or credentials fail):
 *   - OTP is always "123456"
 *   - No SMS is sent
 *
 * PRODUCTION MODE:
 *   - Uses Twilio Verify API to send real SMS
 *   - Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID
 */

// Trim to guard against accidental spaces when pasting into Railway
const ACCOUNT_SID  = (process.env.TWILIO_ACCOUNT_SID  || '').trim();
const AUTH_TOKEN   = (process.env.TWILIO_AUTH_TOKEN    || '').trim();
const VERIFY_SID   = (process.env.TWILIO_VERIFY_SID    || '').trim();
const FORCE_TEST   = process.env.OTP_TEST_MODE === 'true';

const TEST_OTP = '123456';
const OTP_EXPIRY_MS = 10 * 60 * 1000;

// Demo numbers always accept TEST_OTP regardless of mode — used for Apple/store reviewers.
// Set DEMO_PHONES as a comma-separated list in env vars, e.g. "+96500000000,+96500000001"
const DEMO_NUMBERS = new Set(
  (process.env.DEMO_PHONES || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
);

// Founder dummy accounts: +96500000001–+96500000050 always bypass OTP (code: 123456)
// Only usable from the founder's own phone session — these numbers are not real SIM cards.
function isDummyAccount(normalized) {
  return /^\+965000000(0[1-9]|[1-4][0-9]|50)$/.test(normalized);
}

const otpStore = new Map(); // phone → { otp, expires, attempts }

let verifyService = null;
let TEST_MODE = FORCE_TEST || !ACCOUNT_SID || !AUTH_TOKEN || !VERIFY_SID;

if (!TEST_MODE) {
  try {
    const twilio = require('twilio');
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    verifyService = client.verify.v2.services(VERIFY_SID);
    console.log(`[OTP] Production mode — SID:${ACCOUNT_SID.slice(0,6)}...${ACCOUNT_SID.slice(-4)}  VSID:${VERIFY_SID.slice(0,6)}...${VERIFY_SID.slice(-4)}`);

    // Verify credentials immediately at startup — catches bad creds before first request
    client.api.accounts(ACCOUNT_SID).fetch()
      .then(() => console.log('[OTP] Twilio credentials verified OK'))
      .catch((err) => {
        console.error(`[OTP] Twilio credential check FAILED (${err.code} ${err.message}) — switching to test mode`);
        TEST_MODE = true;
        verifyService = null;
      });
  } catch (err) {
    console.error('[OTP] Failed to init Twilio client — switching to test mode:', err.message);
    TEST_MODE = true;
  }
} else {
  const missing = ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VERIFY_SID'].filter(k => !(process.env[k]||'').trim());
  if (missing.length) console.warn('[OTP] Test mode — missing vars:', missing.join(', '));
  else console.log('[OTP] Test mode — OTP_TEST_MODE=true');
}

function normalizePhone(raw) {
  const cleaned = String(raw).replace(/[\s\-\(\)\.]/g, '');
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  if (/^965[0-9]{8}$/.test(cleaned)) return `+${cleaned}`;
  if (/^[569]\d{7}$/.test(cleaned)) return `+965${cleaned}`;
  return cleaned;
}

async function sendOtp(phone) {
  const normalized = normalizePhone(phone);

  // Dummy founder accounts (+96500000001–+96500000050) bypass OTP
  if (isDummyAccount(normalized)) {
    otpStore.set(normalized, { otp: TEST_OTP, expires: Date.now() + OTP_EXPIRY_MS, attempts: 0 });
    console.log(`[OTP DUMMY] Founder dummy account ${normalized} — code: ${TEST_OTP}`);
    return { testMode: true };
  }

  // Demo numbers bypass OTP entirely — used for app store reviewer accounts
  if (DEMO_NUMBERS.has(normalized)) {
    otpStore.set(normalized, { otp: TEST_OTP, expires: Date.now() + OTP_EXPIRY_MS, attempts: 0 });
    console.log(`[OTP DEMO] Demo number ${normalized} — code: ${TEST_OTP}`);
    return { testMode: true };
  }

  if (TEST_MODE) {
    otpStore.set(normalized, { otp: TEST_OTP, expires: Date.now() + OTP_EXPIRY_MS, attempts: 0 });
    console.log(`[OTP TEST] Code for ${normalized}: ${TEST_OTP}`);
    return { testMode: true };
  }

  try {
    await verifyService.verifications.create({ to: normalized, channel: 'sms', locale: 'en' });
    return { testMode: false };
  } catch (err) {
    console.error('[Twilio] sendOtp error:', err.code, err.status, err.message);
    const code = err.code || err.status;
    if (code === 20003) {
      // Credentials rejected — fall back to test mode for this session
      TEST_MODE = true;
      verifyService = null;
      console.error('[OTP] Falling back to test mode due to auth failure');
      otpStore.set(normalized, { otp: TEST_OTP, expires: Date.now() + OTP_EXPIRY_MS, attempts: 0 });
      return { testMode: true };
    }
    if (code === 60200 || err.message?.toLowerCase().includes('invalid')) {
      const e = new Error('Invalid phone number'); e.statusCode = 400; throw e;
    }
    if (code === 60203) {
      const e = new Error('Too many OTP requests. Please wait before requesting another code.'); e.statusCode = 429; throw e;
    }
    const e = new Error('Could not send verification code. Please try again.'); e.statusCode = 502; throw e;
  }
}

async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);

  // Dummy founder accounts
  if (isDummyAccount(normalized)) {
    const stored = otpStore.get(normalized);
    if (!stored) return { valid: false, reason: 'No code was sent to this number' };
    if (Date.now() > stored.expires) { otpStore.delete(normalized); return { valid: false, reason: 'Code has expired' }; }
    if (stored.otp !== String(code)) return { valid: false, reason: 'Incorrect code' };
    otpStore.delete(normalized);
    return { valid: true };
  }

  // Demo numbers always accept the test OTP
  if (DEMO_NUMBERS.has(normalized)) {
    const stored = otpStore.get(normalized);
    if (!stored) return { valid: false, reason: 'No code was sent to this number' };
    if (Date.now() > stored.expires) { otpStore.delete(normalized); return { valid: false, reason: 'Code has expired' }; }
    if (stored.otp !== String(code)) return { valid: false, reason: 'Incorrect code' };
    otpStore.delete(normalized);
    return { valid: true };
  }

  if (TEST_MODE) {
    const stored = otpStore.get(normalized);
    if (!stored) return { valid: false, reason: 'No code was sent to this number' };
    if (Date.now() > stored.expires) { otpStore.delete(normalized); return { valid: false, reason: 'Code has expired' }; }
    if (stored.attempts >= 5) { otpStore.delete(normalized); return { valid: false, reason: 'Too many attempts' }; }
    if (stored.otp !== String(code)) { stored.attempts += 1; return { valid: false, reason: 'Incorrect code' }; }
    otpStore.delete(normalized);
    return { valid: true };
  }

  try {
    const result = await verifyService.verificationChecks.create({ to: normalized, code: String(code) });
    return { valid: result.status === 'approved' };
  } catch (err) {
    const code2 = err.code || err.status;
    if (code2 === 20003) {
      TEST_MODE = true; verifyService = null;
      return { valid: false, reason: 'Verification service unavailable. Please request a new code.' };
    }
    if (code2 === 60200) return { valid: false, reason: 'Incorrect code' };
    const e = new Error('Could not verify code. Please try again.'); e.statusCode = 502; throw e;
  }
}

module.exports = { sendOtp, verifyOtp, normalizePhone };
