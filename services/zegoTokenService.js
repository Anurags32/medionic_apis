/**
 * zegoTokenService.js
 * 
 * Generates ZegoCloud Token04 for authenticating users in a ZegoCloud room.
 * Based on the official ZegoCloud Token04 Node.js spec.
 *
 * Algorithm:
 *   1. Build a binary payload with: expiry, IV + AES-128-CBC encrypted privilege blob.
 *   2. Base64-encode → prefix with "04".
 *
 * Env vars required:
 *   ZEGO_APP_ID     - numeric App ID from ZegoCloud console
 *   ZEGO_SERVER_SECRET - 32-char hex Server Secret from ZegoCloud console
 */

const crypto = require('crypto');

const ZEGO_APP_ID = parseInt(process.env.ZEGO_APP_ID || '0', 10);
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET || '';

/**
 * Generate a ZegoCloud Token04.
 *
 * @param {object} options
 * @param {string} options.userId       - Unique user ID (must match what the client sends)
 * @param {string} [options.roomId]     - Optional room ID restriction. Pass empty string for no restriction.
 * @param {number} [options.ttl]        - Token TTL in seconds. Default: 3600 (1 hour)
 * @returns {{ token: string, expireTime: number }}
 */
function generateToken04({ userId, roomId = '', ttl = 3600 }) {
  if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
    throw new Error('ZEGO_APP_ID and ZEGO_SERVER_SECRET env vars are required to generate Zego tokens.');
  }
  if (!userId) {
    throw new Error('userId is required to generate a Zego token.');
  }

  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + ttl;

  // Privilege map: 1 = login room, 2 = publish stream (both = 1)
  const privilege = { 1: 1, 2: 1 };

  const payload = JSON.stringify({
    app_id: ZEGO_APP_ID,
    user_id: userId,
    nonce: crypto.randomInt(2147483647),
    ctime: createTime,
    expire: expireTime,
    payload: roomId,
    privilege
  });

  // 16-byte random IV
  const iv = crypto.randomBytes(16);

  // Derive 16-byte AES key from server secret (first 32 hex chars → 16 bytes)
  const aesKey = Buffer.from(ZEGO_SERVER_SECRET.slice(0, 32), 'hex');

  const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);

  // Binary layout: [expireTime 4B LE][iv 16B][cipherLen 4B LE][cipher]
  const expireBuf = Buffer.alloc(4);
  expireBuf.writeUInt32LE(expireTime, 0);

  const cipherLenBuf = Buffer.alloc(4);
  cipherLenBuf.writeUInt32LE(encrypted.length, 0);

  const combined = Buffer.concat([expireBuf, iv, cipherLenBuf, encrypted]);
  const token = '04' + combined.toString('base64');

  return { token, expireTime };
}

module.exports = { generateToken04 };
