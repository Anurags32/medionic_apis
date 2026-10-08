/**
 * services/zegoToken.js
 *
 * Official ZegoCloud Token04 server-side generator.
 *
 * Token04 binary layout (before base64):
 *   [0..3]   expire_time  (uint32 LE)
 *   [4..19]  IV           (16 random bytes)
 *   [20..23] cipherLen    (uint32 LE)
 *   [24..]   cipherText   (AES-128-CBC, key = first 16 bytes of hex-decoded secret)
 *
 * The AES plaintext is the JSON payload string:
 *   { app_id, user_id, nonce, ctime, expire, payload }
 *
 * The inner `payload` field is a JSON string encoding:
 *   { room_id, privilege, stream_id_list }
 * where privilege = { "1": 1, "2": 1 }  (1 = LoginRoom, 2 = PublishStream)
 *
 * Final token = "04" + base64(binary)
 *
 * Env vars:
 *   ZEGO_APP_ID          - numeric App ID
 *   ZEGO_SERVER_SECRET   - 32-char hex Server Secret (never sent to client)
 */

const crypto = require('crypto');

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

/**
 * Derive 16-byte AES key from the 32-char hex server secret.
 * @returns {Buffer}
 */
function _getAesKey() {
  const secret = process.env.ZEGO_SERVER_SECRET || '';
  if (secret.length < 32) {
    throw new Error('ZEGO_SERVER_SECRET must be at least 32 hex characters long.');
  }
  // First 32 hex chars → 16 bytes
  return Buffer.from(secret.slice(0, 32), 'hex');
}

/**
 * AES-128-CBC encrypt a UTF-8 string.
 * @param {string} plaintext
 * @param {Buffer} key  16 bytes
 * @returns {{ iv: Buffer, cipherText: Buffer }}
 */
function _aesEncrypt(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const cipherText = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, cipherText };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Generate a ZegoCloud Token04 scoped to a specific room.
 *
 * @param {object} opts
 * @param {string} opts.userId           - User ID (taken from JWT, never from client)
 * @param {string} opts.roomID           - Room ID to scope the token (= callID)
 * @param {number} [opts.effectiveTimeInSeconds=3600]  - TTL in seconds (max 86400)
 * @returns {{ token: string, appID: number, expireTime: number }}
 */
function generateToken04({ userId, roomID, effectiveTimeInSeconds = 3600 }) {
  // --- Validate env ---
  const appID = parseInt(process.env.ZEGO_APP_ID || '0', 10);
  if (!appID) throw new Error('ZEGO_APP_ID env var is missing or zero.');
  const aesKey = _getAesKey(); // throws if secret is missing/short

  if (!userId) throw new Error('userId is required to generate a Zego token.');
  if (!roomID)  throw new Error('roomID is required to generate a Zego token.');

  const ttl  = Math.min(Math.max(effectiveTimeInSeconds, 60), 86400);
  const ctime  = Math.floor(Date.now() / 1000);
  const expire = ctime + ttl;

  // Inner payload: room + privilege scoping
  const innerPayload = JSON.stringify({
    room_id: roomID,
    privilege: {
      '1': 1, // LoginRoom
      '2': 1  // PublishStream
    },
    stream_id_list: null
  });

  // Outer JSON to encrypt
  const outerPayload = JSON.stringify({
    app_id:  appID,
    user_id: String(userId),
    nonce:   crypto.randomInt(0x7fffffff),
    ctime,
    expire,
    payload: innerPayload
  });

  // Encrypt
  const { iv, cipherText } = _aesEncrypt(outerPayload, aesKey);

  // Build binary buffer
  const expireBuf    = Buffer.alloc(4);
  expireBuf.writeUInt32LE(expire, 0);

  const cipherLenBuf = Buffer.alloc(4);
  cipherLenBuf.writeUInt32LE(cipherText.length, 0);

  const binary = Buffer.concat([expireBuf, iv, cipherLenBuf, cipherText]);
  const token  = '04' + binary.toString('base64');

  return { token, appID, expireTime: expire };
}

module.exports = { generateToken04 };
