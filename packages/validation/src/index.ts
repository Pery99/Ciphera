import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/i, "Use letters, numbers, and underscores only.");

export const encryptedEnvelopeSchema = z.object({
  algorithm: z.literal("AES-GCM-256"),
  ciphertext: z.string().min(12),
  iv: z.string().min(12),
  senderDeviceId: z.string().uuid().or(z.string().min(8)),
  keyVersion: z.number().int().positive(),
  aad: z.string().optional()
});

export const signUpSchema = z.object({
  name: z.string().min(2).max(80),
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(10),
  publicIdentityKey: z.string().min(24),
  inviteToken: z.string().min(20).optional()
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const profileSchema = z.object({
  name: z.string().min(2).max(80),
  username: usernameSchema,
  avatarUrl: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(180).optional()
});

export const createConversationSchema = z.object({
  peerUsername: usernameSchema
});

export const sendMessageSchema = z.object({
  conversationId: z.string(),
  replyToId: z.string().optional(),
  encryptedPayload: encryptedEnvelopeSchema,
  attachments: z
    .array(
      z.object({
        kind: z.enum(["image", "video", "document", "voice"]),
        encryptedResourceRef: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        durationMs: z.number().int().nonnegative().optional()
      })
    )
    .default([])
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
