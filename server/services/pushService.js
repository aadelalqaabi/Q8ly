const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send Expo push notifications.
 * @param {Array<{ to: string, title: string, body: string, data?: object }>} messages
 */
async function sendPush(messages) {
  if (!messages || messages.length === 0) return;
  const valid = messages.filter(
    (m) => m.to && (m.to.startsWith('ExponentPushToken') || m.to.startsWith('ExpoPushToken'))
  );
  if (!valid.length) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(valid),
    });
    if (!res.ok) {
      console.error('[Push] Expo API error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Push] Failed to send:', err.message);
  }
}

/**
 * Send a push notification to a single user by their User document.
 * Respects notificationSettings and checks expoPushToken exists.
 * @param {object} user - Mongoose User document (must have expoPushToken, notificationSettings)
 * @param {string} settingKey - Key in notificationSettings to check ('likes'|'comments'|'follows')
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
async function sendToUser(user, settingKey, title, body, data = {}) {
  if (!user?.expoPushToken) return;
  if (settingKey && user.notificationSettings?.[settingKey] === false) return;
  await sendPush([{ to: user.expoPushToken, title, body, data, sound: 'default' }]);
}

/**
 * Send a push notification to all users with a registered token.
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
async function sendToAll(title, body, data = {}) {
  const User = require('../models/User');
  const users = await User.find({ expoPushToken: { $exists: true, $ne: null } })
    .select('expoPushToken')
    .lean();
  const messages = users.map((u) => ({
    to: u.expoPushToken,
    title,
    body,
    data,
    sound: 'default',
  }));
  // Expo recommends batches of 100
  for (let i = 0; i < messages.length; i += 100) {
    await sendPush(messages.slice(i, i + 100));
  }
}

module.exports = { sendPush, sendToUser, sendToAll };
