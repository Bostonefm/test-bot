const crypto = require('crypto');

const ALGO = "aes-256-gcm";
const RAW = (process.env.ENCRYPTION_KEY || "").trim();
if (!RAW) {
  console.warn("[encryption] ENCRYPTION_KEY is not set; decryption may fail. Set a 32-char key in prod.");
}
const KEY = RAW.slice(0, 32).padEnd(32, "0");
const IV_LEN = 12;

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(KEY), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(ciphertext, ivBase64, tagBase64) {
  if (!ciphertext) return "";
  if (!ivBase64 && !tagBase64) {
    try { return Buffer.from(ciphertext, "base64").toString("utf8"); } catch { return ciphertext; }
  }
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, Buffer.from(KEY), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encrypt, decrypt };
