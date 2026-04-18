import type { QfSocialUser } from "@/lib/qf-user/types";

export type SocialRelationshipStatus =
  | "none"
  | "incoming_request"
  | "outgoing_request"
  | "friend";

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
  relationshipStatus?: SocialRelationshipStatus;
}

export function getQfUserDisplayName(user: Pick<QfSocialUser, "firstName" | "lastName" | "username">): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || "Quran.com user";
}

export function getQfUserAvatarUrl(
  user: Partial<Pick<QfSocialUser, "avatarUrls">>
): string | null {
  const avatarUrls = user.avatarUrls;
  if (!avatarUrls) {
    return null;
  }

  return avatarUrls.medium || avatarUrls.small || avatarUrls.large || null;
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
