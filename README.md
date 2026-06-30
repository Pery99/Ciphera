# Ciphera

Ciphera is a privacy-first real-time messaging platform built with a React frontend, a NestJS backend, PostgreSQL, Redis/BullMQ, Socket.IO, Cloudinary, Prisma, and shared TypeScript packages.

The core idea is simple: users can chat normally while sensitive message payloads are encrypted in the browser before they leave the client. The API stores encrypted envelopes, metadata, delivery state, and encrypted media references.

Ciphera was built as a full-stack engineering portfolio project to show product thinking across authentication, secure-by-default messaging workflows, realtime systems, encrypted media handling, queues, push notifications, database design, and deployment readiness.

## Screenshots

### Register

![Ciphera register screen](apps/web/public/register.png)

### Conversation

![Ciphera conversation screen](apps/web/public/02.png)

## What Ciphera Supports

- Account registration and login.
- Username-based user discovery.
- Private invite links.
- Invite acceptance that opens the inviter conversation.
- HTTP-only refresh cookie sessions.
- One-to-one conversations.
- Real-time messaging over Socket.IO.
- Client-side encrypted message envelopes.
- Optimistic message sending with queued/sent/delivered/read states.
- Offline outbound queue in IndexedDB.
- Message notification queue for Web Push subscribers.
- Unread counts and read cursor tracking.
- Typing indicators.
- Message replies.
- Swipe-to-reply style frontend behavior.
- Encrypted image/video/media upload through Cloudinary.
- Voice-note recording with `MediaRecorder`.
- Local decrypt-and-play media rendering.
- Push notification subscription using Web Push/VAPID.
- PWA manifest and service worker.
- Rate limiting through Nest throttling.
- Audit-safe backend behavior that avoids plaintext message storage.

## Tech Stack

### Frontend

- React
- Vite
- TypeScript
- Socket.IO client
- Web Crypto API
- IndexedDB for queued outbound messages
- Service Worker + Web Push
- Cloudinary browser upload flow

### Backend

- NestJS
- Prisma
- PostgreSQL
- Socket.IO gateway
- Redis + BullMQ
- JWT access tokens
- Refresh-token sessions
- Web Push
- Cloudinary upload signatures
- Zod validation through shared packages

### Shared Packages

- `@ciphera/types`: shared domain types.
- `@ciphera/validation`: Zod schemas.
- `@ciphera/contracts`: REST and websocket event contracts.
- `@ciphera/crypto`: browser-side crypto helper contracts.

## Monorepo Structure

```text
apps/
  api/
    prisma/
      schema.prisma
    src/
      config/
      modules/
        auth/
        conversations/
        invites/
        media/
        messages/
        push/
        queues/
        realtime/
        users/

  web/
    public/
      register.png
      01.png
      02.png
      manifest.webmanifest
      sw.js
    src/
      components/
      App.tsx
      api.ts
      mediaUpload.ts
      outboundQueue.ts
      push.ts
      session.ts

packages/
  contracts/
  crypto/
  types/
  validation/
```

## Architecture Overview

Ciphera is split into three main runtime areas:

1. **Browser client**

   - Owns plaintext.
   - Encrypts messages and media before upload/send.
   - Decrypts received messages and media locally.
   - Maintains optimistic UI state and an outbound queue for failed sends.
2. **NestJS API**

   - Authenticates users.
   - Stores encrypted envelopes.
   - Routes websocket events.
   - Coordinates Cloudinary upload signatures.
   - Tracks delivery/read state and unread counts.
   - Queues push notification jobs.
3. **Infrastructure**

   - PostgreSQL stores users, sessions, conversations, encrypted messages, attachments, invites, and push subscriptions.
   - Redis/BullMQ handles background notification jobs.
   - Cloudinary stores encrypted media blobs.

## Privacy And Encryption Model

Ciphera uses a client-side encrypted payload workflow. The backend stores encrypted message/media payloads and delivery metadata, but the app does not implement a production end-to-end encryption protocol.

Before a message leaves the browser:

1. The client creates an encrypted envelope.
2. The plaintext body is encrypted locally.
3. The encrypted envelope is sent to the API.
4. The API stores the encrypted payload as JSON.
5. Recipients decrypt locally in their browser.

For media:

1. The client encrypts file bytes locally.
2. The client requests a Cloudinary upload signature from the API.
3. The encrypted blob is uploaded to Cloudinary.
4. The API stores only the encrypted media reference and metadata.
5. Recipients fetch the encrypted object and decrypt locally before viewing or playing.

The server can see:

- User IDs.
- Conversation IDs.
- Participant relationships.
- Timestamps.
- Message delivery/read status.
- Attachment metadata such as MIME type and size.
- Encrypted payloads as ciphertext.

The server should not see:

- Plaintext message bodies.
- Plaintext voice-note audio.
- Plaintext image/video/document bytes.
- Decrypted filenames or file contents.

### Cryptography Scope

Ciphera currently shows browser-side encryption and backend-blind storage. It should be described as client-side encrypted, not as a production end-to-end encryption protocol.

## Core Product Flows

### Registration And Login

- User signs up with name, username, email, and password.
- Client supplies browser-generated identity metadata.
- API stores password hash and identity metadata.
- API creates a refresh session, stores only a refresh-token hash, and sets the refresh token as an HTTP-only cookie.
- Refresh requests issue short-lived access tokens without exposing the refresh token to browser JavaScript.

### Invite Links

- Authenticated users create private invite links.
- The API stores only a hash of the invite token.
- Recipient opens `/invite/:token`.
- Recipient creates an account or accepts while logged in.
- API creates or reuses a direct conversation.
- Client opens the new conversation immediately.

### Real-Time Messaging

- Client connects to Socket.IO with JWT.
- Client joins conversation rooms.
- Sender encrypts the message locally.
- Sender emits `message:send`.
- API validates membership.
- API stores the encrypted message.
- API emits `message:new`.
- Clients replace optimistic queued messages with confirmed server messages.

### Queued Sending

The frontend includes an outbound queue using IndexedDB.

- If the socket/network is unavailable, messages can be stored locally as queued outbound entries.
- Pending attachment blobs are stored locally.
- When the socket reconnects, queued entries are uploaded/sent.
- The UI shows queued state until the server confirms storage.

### Message Notifications

When a message is stored:

- The gateway checks conversation participants.
- It queues a `message.notify` job for recipients.
- The notification worker sends metadata-only Web Push notifications.
- Notification payloads do not include plaintext or ciphertext content.
- Clients fetch stored encrypted messages from PostgreSQL.

## Database Design

Ciphera uses Prisma with PostgreSQL.

Main models:

- `User`
- `Session`
- `Device`
- `Conversation`
- `ConversationParticipant`
- `Invite`
- `Message`
- `MediaAttachment`
- `PushSubscription`

Notable design choices:

- `Message.encryptedPayload` is JSON and stores encrypted envelope data.
- There is no plaintext message body column.
- `Message.replyToId` supports replies.
- `ConversationParticipant.readCursorId` supports unread counts.
- `PushSubscription` stores browser push subscription metadata.
- `Invite.tokenHash` stores a hash, not the raw invite token.

## Queues

Ciphera uses BullMQ with Redis.

Current notification jobs include:

- `invite.created`
- `message.notify`

Queue responsibilities:

- Avoid blocking websocket/API flows.
- Retry transient notification failures.
- Send message notification metadata.
- Keep notification delivery separate from the realtime send path.

## Push Notifications

Ciphera includes Web Push support.

- Frontend registers the service worker.
- User can enable push notifications.
- Browser sends subscription info to the API.
- API stores push subscription records.
- Message notification jobs send metadata-only notifications.
- Service worker can open the conversation from notification data.

Required VAPID env values:

```env
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:support@ciphera.app"
```

## Media And Voice Notes

Media support includes:

- Image selection.
- Video selection.
- Voice-note recording.
- Encrypted Cloudinary upload.
- Attachment metadata persistence.
- Local decrypt-and-view.
- Local decrypt-and-play for voice/video.

Voice notes use the browser `MediaRecorder` API.

## Environment Variables

Create `apps/api/.env` from `apps/api/.env.example`.

Important values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/ciphera?schema=public"

JWT_ACCESS_SECRET="generate-a-long-random-secret"
JWT_REFRESH_SECRET="generate-a-different-long-random-secret"

CORS_ORIGIN="http://localhost:5173"
APP_WEB_URL="http://localhost:5173"

REDIS_URL="redis://localhost:6379"
QUEUE_PREFIX="ciphera"

CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:support@ciphera.app"

COOKIE_SECURE="false"
COOKIE_SAME_SITE="lax"
```

For production, use strong JWT secrets, secure cookies, HTTPS origins, production PostgreSQL, and Redis with a queue-safe eviction policy such as `noeviction`.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the API:

```bash
npm run dev:api
```

Start the web app:

```bash
npm run dev:web
```

Open:

```text
http://localhost:5173
```

API default:

```text
http://localhost:3000/api
```

## Database Setup

Generate Prisma Client:

```bash
npm exec --workspace @ciphera/api -- prisma generate
```

Push schema during prototype/development:

```bash
npm exec --workspace @ciphera/api -- prisma db push
```

For migration-based workflow:

```bash
npm exec --workspace @ciphera/api -- prisma migrate dev --name init
```

Open Prisma Studio:

```bash
npm exec --workspace @ciphera/api -- prisma studio
```

## Scripts

Root scripts:

```bash
npm run dev:web       # Start Vite frontend
npm run dev:api       # Start NestJS API
npm run build         # Build shared packages + API
npm run build:web     # Build shared packages + web app
npm run build:all     # Build everything
npm run start         # Start compiled API
```

API workspace scripts:

```bash
npm run build --workspace @ciphera/api
npm run start:dev --workspace @ciphera/api
npm run deploy:db --workspace @ciphera/api
```

Web workspace scripts:

```bash
npm run build --workspace @ciphera/web
npm run dev --workspace @ciphera/web
```

## Deployment Notes

The repo includes deployment-oriented files:

- `railway.toml`
- `railpack.json`
- `vercel.json`
- `middleware.js`
- React legal routes at `/privacy` and `/terms`

Deployment expectations:

- API needs PostgreSQL, Redis, Cloudinary, JWT secrets, and VAPID keys.
- Web needs the API URL/socket target configured for the deployment environment.
- Service worker and push notifications require HTTPS in production.
- CORS origin must match the deployed frontend origin.

## Security Decisions

- Passwords are hashed with bcrypt.
- Refresh tokens are hashed in the database and stored in HTTP-only cookies.
- Invite tokens are stored as hashes.
- Message plaintext is never stored in the database.
- Push notifications contain metadata only.
- CORS is explicitly validated.
- Production mode rejects weak JWT secrets.
- Cookies can be configured for secure/same-site deployment needs.

## Current Limitations

- The encryption model is a client-side encrypted payload workflow, not a production end-to-end encryption protocol.
- Multi-device encrypted session management is not implemented.
- Push notification delivery depends on browser support and VAPID configuration.
- Cloudinary stores encrypted blobs, but large-file chunking is not yet implemented.
- Regression coverage exists for selected backend security paths, shared validation/crypto helpers, and frontend guardrails, but it is not comprehensive.

## Why This Project Matters

Ciphera is not a simple CRUD chat clone. It combines:

- Product-quality frontend interaction.
- Real-time communication.
- Secure-by-design backend constraints.
- Encrypted media workflows.
- Offline and queue-aware messaging.
- Push notification infrastructure.
- Monorepo architecture.
- Deployment-minded configuration.

It is built to show the engineering decisions behind a serious privacy-first communication product.
