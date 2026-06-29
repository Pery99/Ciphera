const assert = require("node:assert/strict");

const { toClientAuthSession } = require("../dist/modules/auth/auth-cookies.js");

const clientSession = toClientAuthSession({
  accessToken: "access-token",
  refreshToken: "refresh-token-that-must-not-reach-js",
  redirectConversationId: "conversation-id",
  user: {
    id: "user-id",
    name: "Ada",
    username: "ada",
    publicIdentityKey: "public-key"
  }
});

assert.equal(clientSession.accessToken, "access-token");
assert.equal(clientSession.redirectConversationId, "conversation-id");
assert.equal(clientSession.user.username, "ada");
assert.equal(Object.hasOwn(clientSession, "refreshToken"), false, "auth JSON must not expose refreshToken");
