"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = exports.createConversationSchema = exports.profileSchema = exports.loginSchema = exports.signUpSchema = exports.encryptedEnvelopeSchema = exports.usernameSchema = void 0;
const zod_1 = require("zod");
exports.usernameSchema = zod_1.z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Use letters, numbers, and underscores only.");
exports.encryptedEnvelopeSchema = zod_1.z.object({
    algorithm: zod_1.z.literal("AES-GCM-256"),
    ciphertext: zod_1.z.string().min(12),
    iv: zod_1.z.string().min(12),
    senderDeviceId: zod_1.z.string().uuid().or(zod_1.z.string().min(8)),
    keyVersion: zod_1.z.number().int().positive(),
    aad: zod_1.z.string().optional()
});
exports.signUpSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    username: exports.usernameSchema,
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(10),
    publicIdentityKey: zod_1.z.string().min(24),
    inviteToken: zod_1.z.string().min(20).optional()
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
exports.profileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    username: exports.usernameSchema,
    avatarUrl: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    bio: zod_1.z.string().max(180).optional()
});
exports.createConversationSchema = zod_1.z.object({
    peerUsername: exports.usernameSchema
});
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string(),
    encryptedPayload: exports.encryptedEnvelopeSchema,
    attachments: zod_1.z
        .array(zod_1.z.object({
        kind: zod_1.z.enum(["image", "video", "document", "voice"]),
        encryptedResourceRef: zod_1.z.string(),
        mimeType: zod_1.z.string(),
        sizeBytes: zod_1.z.number().int().nonnegative(),
        durationMs: zod_1.z.number().int().nonnegative().optional()
    }))
        .default([])
});
