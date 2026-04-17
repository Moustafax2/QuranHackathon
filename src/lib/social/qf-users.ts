import type { QfSocialUser } from "@/lib/qf-user/types";

export interface SocialUserSummary {
  id: string;
  username: string | null;
  displayName: string;
  bio: string | null;
  country: string | null;
  followed: boolean;
  verified: boolean;
  followersCount: number;
  avatarUrl: string | null;
}

export function getQfUserDisplayName(user: Pick<QfSocialUser, "firstName" | "lastName" | "username">): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || "Quran.com user";
}

export function getQfUserAvatarUrl(user: Pick<QfSocialUser, "avatarUrls">): string | null {
  return user.avatarUrls.medium || user.avatarUrls.small || user.avatarUrls.large || null;
}

export function serializeSocialUser(user: QfSocialUser): SocialUserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: getQfUserDisplayName(user),
    bio: user.bio,
    country: user.country,
    followed: user.followed || user.isFollowed,
    verified: user.verified,
    followersCount: user.followersCount,
    avatarUrl: getQfUserAvatarUrl(user),
  };
}
