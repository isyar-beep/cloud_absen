// Kirim push notification lewat Expo Push API (https://exp.host/--/api/v2/push/send).
// Tidak perlu akun/kredensial tambahan -- Expo push service gratis untuk app berbasis Expo.
const { catatan, dariGalat } = require('./catatan');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Kirim satu atau beberapa notifikasi sekaligus.
// messages: [{ to: expoPushToken, title, body, data? }]
//
// Mengembalikan { sent, target, error } supaya pemanggil bisa membedakan
// "tidak ada yang perlu dikirimi" dari "ada tujuan tapi pengiriman gagal" --
// keduanya sama-sama menghasilkan sent = 0 tapi artinya jauh berbeda.
async function sendPushNotifications(messages) {
  const valid = messages.filter((m) => m.to && m.to.startsWith('ExponentPushToken'));
  const hasil = { sent: 0, target: valid.length, error: null };

  if (valid.length === 0) {
    hasil.error = 'tidak ada push token yang valid';
    return hasil;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valid),
    });

    if (!res.ok) {
      hasil.error = `layanan push menolak permintaan (HTTP ${res.status})`;
      catatan.ingat('Layanan push menolak permintaan', { status: res.status });
      return hasil;
    }

    hasil.sent = valid.length;
    return hasil;
  } catch (err) {
    hasil.error = `tidak bisa menghubungi layanan push (${err.message})`;
    catatan.ingat('Gagal menghubungi layanan push', dariGalat(err, { tumpukan: false }));
    return hasil;
  }
}

module.exports = { sendPushNotifications };
