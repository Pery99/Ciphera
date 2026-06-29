import assert from "node:assert/strict";

import {
  decryptText,
  deriveConversationKey,
  deriveConversationKeyCandidates,
  deriveLegacyConversationKey,
  encryptText,
  fromBase64,
  generateClientIdentityKey,
  importAesKey,
  toBase64
} from "../dist/index.js";

const identityKey = await generateClientIdentityKey();
assert.equal(typeof identityKey, "string");
assert.equal(fromBase64(identityKey).length, 32);

const conversationKey = await deriveConversationKey("conversation-a");
const legacyConversationKey = await deriveLegacyConversationKey("conversation-a");
const sameConversationKey = await deriveConversationKey("conversation-a");
const otherConversationKey = await deriveConversationKey("conversation-b");

assert.equal(conversationKey, sameConversationKey, "conversation key derivation should be deterministic");
assert.notEqual(conversationKey, legacyConversationKey, "legacy and primary conversation keys should remain distinct");
assert.notEqual(conversationKey, otherConversationKey, "different conversations should derive different keys");
assert.equal(fromBase64(conversationKey).length, 32);

const candidates = await deriveConversationKeyCandidates("conversation-a");
assert.deepEqual(candidates, [conversationKey, legacyConversationKey]);

await assert.doesNotReject(() => importAesKey(conversationKey));

const message = "Meet me at 21:00.";
const envelope = await encryptText(message, conversationKey, "device-1234");
assert.notEqual(envelope.ciphertext, message);
assert.equal(envelope.algorithm, "AES-GCM-256");
assert.equal(await decryptText(envelope, conversationKey), message);

await assert.rejects(() => decryptText(envelope, otherConversationKey), "wrong keys must not decrypt ciphertext");

const bytes = new Uint8Array([1, 2, 3, 254]);
assert.deepEqual(Array.from(fromBase64(toBase64(bytes))), Array.from(bytes));

const legacyEnvelope = await encryptText("old database message", legacyConversationKey, "device-1234");
let legacyPlaintext = "";
for (const key of candidates) {
  try {
    legacyPlaintext = await decryptText(legacyEnvelope, key);
    break;
  } catch {
    // Try the next candidate.
  }
}
assert.equal(legacyPlaintext, "old database message");
