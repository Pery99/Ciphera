import type { UserProfile } from "@ciphera/types";

export type UserRecord = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  publicIdentityKey: string;
};

export function toProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    publicIdentityKey: user.publicIdentityKey
  };
}
