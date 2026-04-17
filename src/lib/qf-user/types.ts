export interface QfOidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface QfTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

export interface QfIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
}

export interface QfUserProfile {
  sub: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export interface QfSession {
  access_token: string;
  refresh_token: string | null;
  id_token: string;
  expires_at: number;
  user: QfUserProfile;
  player_id: string;
}

export interface QfSessionSummary {
  isAuthenticated: boolean;
  user: QfUserProfile | null;
  player: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    total_points: number;
    total_wins: number;
  } | null;
}

export interface QfLoginTransaction {
  state: string;
  nonce: string;
  code_verifier: string;
  redirect_to: string;
  created_at: number;
}

export interface QfBookmark {
  id: string;
  createdAt: string;
  type: "ayah" | "surah" | "juz" | "page";
  key: number;
  verseNumber?: number;
  group?: string | null;
  isInDefaultCollection: boolean;
  isReading?: boolean | null;
  collectionsCount?: number;
}

export interface QfBookmarkListResponse {
  success: boolean;
  data: QfBookmark[];
  pagination?: {
    startCursor: string | null;
    endCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface QfBookmarkMutationResponse {
  success: boolean;
  data: QfBookmark | Record<string, never>;
}
