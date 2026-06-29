const assert = require("node:assert/strict");

const { RealtimeGateway } = require("../dist/modules/realtime/realtime.gateway.js");

function createGateway(participant) {
  const prisma = {
    conversationParticipant: {
      findUnique: async () => participant
    }
  };

  return new RealtimeGateway({}, {}, {}, prisma, {});
}

async function run() {
  {
    const gateway = createGateway(null);
    let joined = false;
    await assert.rejects(
      () =>
        gateway.join(
          {
            data: { user: { id: "user-a", username: "ada" } },
            join: () => {
              joined = true;
            }
          },
          "conversation-a"
        ),
      /not a participant/
    );
    assert.equal(joined, false, "unauthorized sockets must not join conversation rooms");
  }

  {
    const gateway = createGateway({ id: "participant-id" });
    let joinedRoom = "";
    await gateway.join(
      {
        data: { user: { id: "user-a", username: "ada" } },
        join: (room) => {
          joinedRoom = room;
        }
      },
      "conversation-a"
    );
    assert.equal(joinedRoom, "conversation-a");
  }

  {
    const gateway = createGateway(null);
    let emitted = false;
    await assert.rejects(
      () =>
        gateway.typingStart(
          {
            data: { user: { id: "user-a", username: "ada" } },
            to: () => ({
              emit: () => {
                emitted = true;
              }
            })
          },
          "conversation-a"
        ),
      /not a participant/
    );
    assert.equal(emitted, false, "unauthorized sockets must not emit typing events");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
