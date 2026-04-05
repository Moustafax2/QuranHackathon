import "server-only";

import {
  getQuranFoundationAccessToken,
  getQuranFoundationAccessTokenStatus,
} from "@/lib/quran/auth";
import { getQuranFoundationConfigStatus } from "@/lib/quran/config";
import { QuranApiError, quranContentGet } from "@/lib/quran/client";
import type { ChaptersResponse } from "@/lib/types";

export interface QuranIntegrationHealthCheck {
  status: "ok" | "error" | "skipped";
  message: string;
}

export interface QuranIntegrationStatus {
  config: ReturnType<typeof getQuranFoundationConfigStatus>;
  token: ReturnType<typeof getQuranFoundationAccessTokenStatus>;
  auth: QuranIntegrationHealthCheck;
  content: QuranIntegrationHealthCheck;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error.";
}

export async function getQuranIntegrationStatus(): Promise<QuranIntegrationStatus> {
  const config = getQuranFoundationConfigStatus();

  if (!config.isReady) {
    return {
      config,
      token: getQuranFoundationAccessTokenStatus(),
      auth: {
        status: "skipped",
        message: "Set the required env vars before testing authentication.",
      },
      content: {
        status: "skipped",
        message: "Content API checks are skipped until configuration is complete.",
      },
    };
  }

  try {
    await getQuranFoundationAccessToken();
  } catch (error) {
    return {
      config,
      token: getQuranFoundationAccessTokenStatus(),
      auth: {
        status: "error",
        message: getErrorMessage(error),
      },
      content: {
        status: "skipped",
        message: "Content API check skipped because auth did not succeed.",
      },
    };
  }

  try {
    const chapters = await quranContentGet<ChaptersResponse>("/chapters", {
      params: { language: "en" },
      cache: "no-store",
    });

    return {
      config,
      token: getQuranFoundationAccessTokenStatus(),
      auth: {
        status: "ok",
        message: "Client-credentials auth succeeded.",
      },
      content: {
        status: "ok",
        message: `Content API responded successfully with ${chapters.chapters.length} chapters.`,
      },
    };
  } catch (error) {
    const message =
      error instanceof QuranApiError
        ? `Content API check failed with ${error.status}.`
        : getErrorMessage(error);

    return {
      config,
      token: getQuranFoundationAccessTokenStatus(),
      auth: {
        status: "ok",
        message: "Client-credentials auth succeeded.",
      },
      content: {
        status: "error",
        message,
      },
    };
  }
}
