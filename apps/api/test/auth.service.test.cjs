const assert = require("node:assert/strict");
const { hash } = require("bcryptjs");

const { AuthService } = require("../dist/modules/auth/auth.service.js");

async function run() {
  const refreshToken = "refresh-token-from-http-only-cookie";
  const refreshHash = await hash(refreshToken, 4);
  const updates = [];
  const prisma = {
    session: {
      findUnique: async () => ({
        id: "session-a",
        userId: "user-a",
        refreshHash,
        previousRefreshHash: null,
        previousRotatedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-a",
          name: "Ada",
          username: "ada",
          avatarUrl: null,
          bio: null,
          publicIdentityKey: "public-key"
        }
      }),
      update: async (input) => {
        updates.push(input);
        return input;
      }
    }
  };
  const jwt = {
    verifyAsync: async () => ({ sub: "user-a", type: "refresh", sid: "session-a" }),
    signAsync: async () => "new-access-token"
  };
  const config = { get: () => undefined };
  const service = new AuthService(prisma, jwt, config, {});

  const session = await service.refresh({
    cookies: { ciphera_refresh: refreshToken },
    headers: { "user-agent": "test-agent" },
    ip: "127.0.0.1"
  });

  assert.equal(session.accessToken, "new-access-token");
  assert.equal(session.refreshToken, refreshToken, "refresh should keep the same httpOnly refresh token");
  assert.equal(session.user.id, "user-a");
  assert.equal(updates.length, 1);
  assert.equal(Object.hasOwn(updates[0].data, "refreshHash"), false, "refresh must not rotate refreshHash on every reload");
  assert.equal(updates[0].data.userAgent, "test-agent");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
