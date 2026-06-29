const assert = require("node:assert/strict");

const { MessagesService } = require("../dist/modules/messages/messages.service.js");

function createService(overrides = {}) {
  const calls = { update: 0 };
  const prisma = {
    conversationParticipant: {
      findUnique: async () => ({ conversationId: "conversation-a", userId: "recipient" })
    },
    message: {
      findFirst:
        overrides.findFirst ??
        (async () => ({
          id: "message-a",
          senderId: "sender"
        })),
      update: async (input) => {
        calls.update += 1;
        return {
          id: input.where.id,
          conversationId: "conversation-a",
          senderId: "sender",
          replyToId: null,
          encryptedPayload: {
            algorithm: "AES-GCM-256",
            ciphertext: "ciphertext",
            iv: "iv",
            senderDeviceId: "device",
            keyVersion: 1
          },
          attachments: [],
          status: input.data.status,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          deliveredAt: input.data.deliveredAt ?? null,
          readAt: input.data.readAt ?? null
        };
      }
    }
  };

  return { service: new MessagesService(prisma), calls };
}

async function rejectsWithName(action, name) {
  await assert.rejects(action, (error) => error?.name === name);
}

async function run() {
  {
    const { service, calls } = createService({ findFirst: async () => null });
    await rejectsWithName(
      () => service.markDelivered("recipient", "conversation-a", "message-from-another-conversation"),
      "BadRequestException"
    );
    assert.equal(calls.update, 0, "unrelated messages must not be updated");
  }

  {
    const { service, calls } = createService({ findFirst: async () => ({ id: "message-a", senderId: "recipient" }) });
    await rejectsWithName(
      () => service.markRead("recipient", "conversation-a", "message-a"),
      "ForbiddenException"
    );
    assert.equal(calls.update, 0, "senders must not mark their own messages as read");
  }

  {
    const { service, calls } = createService();
    const message = await service.markDelivered("recipient", "conversation-a", "message-a");
    assert.equal(message.status, "delivered");
    assert.equal(calls.update, 1, "recipient should be able to mark an in-conversation message delivered");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
