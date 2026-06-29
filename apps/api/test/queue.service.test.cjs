const assert = require("node:assert/strict");

const { QueueService } = require("../dist/modules/queues/queue.service.js");

const calls = [];
const queue = {
  add: async (name, payload, options) => {
    calls.push({ name, payload, options });
    return { id: `${name}-job` };
  }
};

async function run() {
  const service = new QueueService(queue);

  await service.queueInviteCreated({
    inviteId: "invite-a",
    inviterId: "user-a",
    inviteUrl: "https://ciphera.app/invite/token"
  });

  await service.queueMessageNotify({
    recipientUserId: "user-b",
    conversationId: "conversation-a",
    messageId: "message-a"
  });

  assert.equal(calls[0].name, "invite.created");
  assert.equal(calls[0].options.attempts, 3);
  assert.deepEqual(calls[0].options.backoff, { type: "exponential", delay: 2000 });
  assert.equal(calls[0].options.removeOnComplete, 100);

  assert.equal(calls[1].name, "message.notify");
  assert.deepEqual(calls[1].payload, {
    recipientUserId: "user-b",
    conversationId: "conversation-a",
    messageId: "message-a"
  });
  assert.equal(calls[1].options.attempts, 3);
  assert.deepEqual(calls[1].options.backoff, { type: "exponential", delay: 1500 });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
