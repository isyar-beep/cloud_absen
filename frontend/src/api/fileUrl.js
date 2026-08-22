// Foto disimpan di database sebagai path relatif (mis. /uploads/avatar/x.jpg)
// supaya datanya tidak terikat pada satu domain -- pindah server tidak
// membuat seluruh URL lama rusak.
//
// Tapi berarti browser perlu diberi tahu host-nya: tanpa ini, <img src="/uploads/...">
// dicari di server frontend (5173), padahal berkasnya ada di backend (5000).
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

export function urlFoto(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // sudah absolut (PUBLIC_BASE_URL diisi)
  return `${API_ORIGIN}${path}`;
}
