// Kirim push notification lewat Expo Push API (https://exp.host/--/api/v2/push/send).
// Tidak perlu akun/kredensial tambahan -- Expo push service gratis untuk app berbasis Expo.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Kirim satu atau beberapa notifikasi sekaligus.
// messages: [{ to: expoPushToken, title, body, data? }]
// Token yang formatnya tidak valid (bukan ExponentPushToken[...]) dilewati saja.
async function sendPushNotifications(messages) {
  const valid = messages.filter((m) => m.to && m.to.startsWith('ExponentPushToken'));
  if (valid.length === 0) return { sent: 0 };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(valid),
  });

  if (!res.ok) {
    console.error('Gagal kirim push notification, status:', res.status);
    return { sent: 0 };
  }

  return { sent: valid.length };
}

module.exports = { sendPushNotifications };
