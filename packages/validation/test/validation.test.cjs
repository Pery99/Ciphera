const assert = require("node:assert/strict");

const {
  createConversationSchema,
  encryptedEnvelopeSchema,
  loginSchema,
  profileSchema,
  pushSubscribeSchema,
  sendMessageSchema,
  signUpSchema,
  usernameSchema
} = require("../dist/index.js");

assert.equal(usernameSchema.safeParse("ada_lovelace").success, true);
assert.equal(usernameSchema.safeParse("ada lovelace").success, false);

assert.equal(
  signUpSchema.safeParse({
    name: "Ada Lovelace",
    username: "ada",
    email: "ada@example.com",
    password: "short",
    publicIdentityKey: "x".repeat(24)
  }).success,
  false,
  "signup passwords must keep the configured minimum length"
);

assert.equal(loginSchema.safeParse({ username: "ada", password: "secret" }).success, true);
assert.equal(profileSchema.safeParse({ name: "Ada Lovelace", username: "ada", avatarUrl: "", bio: "Builder" }).success, true);
assert.equal(createConversationSchema.safeParse({ peerUsername: "grace_hopper" }).success, true);

const envelope = {
  algorithm: "AES-GCM-256",
  ciphertext: "ciphertext-strong",
  iv: "initial-vector",
  senderDeviceId: "device-1234",
  keyVersion: 1
};

assert.equal(encryptedEnvelopeSchema.safeParse(envelope).success, true);

const parsedMessage = sendMessageSchema.parse({
  conversationId: "conversation-a",
  encryptedPayload: envelope
});
assert.deepEqual(parsedMessage.attachments, [], "message attachments should default to an empty array");

assert.equal(
  sendMessageSchema.safeParse({
    conversationId: "conversation-a",
    encryptedPayload: { ...envelope, ciphertext: "tiny" }
  }).success,
  false
);

assert.equal(
  pushSubscribeSchema.safeParse({
    endpoint: "https://push.example.test/subscription",
    keys: { p256dh: "key", auth: "auth" }
  }).success,
  true
);
