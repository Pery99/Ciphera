const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readSourceFiles(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return readSourceFiles(child);
    if (!/\.(ts|tsx|js|cjs|mjs|css|md)$/.test(entry.name)) return [];
    return [{ path: child, content: read(child) }];
  });
}

const apiSource = read("apps/web/src/api.ts");
const sessionSource = read("apps/web/src/session.ts");

assert.equal(exists("apps/web/src/demoData.ts"), false, "demo chat data must not ship in the real app");
assert.equal(exists("apps/api/src/modules/presence/presence.service.ts"), false, "unused presence service must stay removed");
assert.equal(exists("apps/api/src/modules/presence/presence.module.ts"), false, "unused presence module must stay removed");

assert.match(apiSource, /credentials:\s*"include"/, "API requests must include httpOnly refresh cookies");
assert.match(apiSource, /isCrossOrigin/, "production API URL resolution should force same-origin /api for cookie auth");
assert.doesNotMatch(apiSource, /localStorage|sessionStorage/, "API client must not read or write browser storage tokens");
assert.doesNotMatch(apiSource, /refreshToken/, "refresh tokens must not be handled by frontend API code");

assert.match(sessionSource, /removeItem\(LEGACY_REFRESH_TOKEN_KEY\)/, "legacy refresh token cleanup should remain");
assert.doesNotMatch(sessionSource, /setItem/, "session storage code must not persist tokens again");

const sources = [
  ...readSourceFiles("apps/api/src"),
  ...readSourceFiles("apps/web/src"),
  ...readSourceFiles("packages/contracts/src"),
  ...readSourceFiles("packages/crypto/src"),
  ...readSourceFiles("packages/types/src"),
  ...readSourceFiles("packages/validation/src")
];
const combined = sources.map((file) => `${file.path}\n${file.content}`).join("\n");

for (const forbidden of [
  /presence:update/,
  /PresenceState/,
  /lastSeenAt/,
  /demoData/,
  /generateDemoIdentityKey/,
  /deriveDemoConversationKey/,
  /importDemoKey/
]) {
  assert.doesNotMatch(combined, forbidden, `forbidden regression found: ${forbidden}`);
}
