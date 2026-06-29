const assert = require("node:assert/strict");

const { hashInviteToken } = require("../dist/modules/invites/invites.service.js");

const first = hashInviteToken("invite-token-a");
const second = hashInviteToken("invite-token-a");
const third = hashInviteToken("invite-token-b");

assert.equal(first, second, "invite token hashing must be deterministic for lookup");
assert.notEqual(first, third, "different invite tokens must produce different hashes");
assert.match(first, /^[a-f0-9]{64}$/);
