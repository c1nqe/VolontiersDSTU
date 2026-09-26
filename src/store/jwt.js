/**
 * Утилиты для работы с JWT (RFC 7519).
 * Подпись детерминированная и демонстрационная — на реальном backend
 * (DataSpace CE) токен выпускается и проверяется сервером.
 */
export const JWT_SECRET = 'DSTU_VOLONTIERS_SECRET_KEY_2025';

export function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function generateJWT(payload, secret = JWT_SECRET) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + 24 * 60 * 60, // 24 часа
  }));

  let hash = 0;
  const signatureInput = `${encodedHeader}.${encodedPayload}.${secret}`;
  for (let i = 0; i < signatureInput.length; i++) {
    hash = ((hash << 5) - hash) + signatureInput.charCodeAt(i);
    hash |= 0;
  }
  const encodedSignature = base64UrlEncode(`sig_${Math.abs(hash).toString(16)}_dstu`);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const isExpired = Boolean(payload.exp && payload.exp < Math.floor(Date.now() / 1000));
    return { header, payload, isExpired, raw: token };
  } catch (e) {
    console.error('Ошибка декодирования JWT токена:', e);
    return null;
  }
}
