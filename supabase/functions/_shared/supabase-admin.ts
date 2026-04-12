import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase admin client for Edge Functions.
 * Uses the service role key to bypass RLS.
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Broadcast a game event to all players in a game channel.
 */
export async function broadcastGameEvent(
  gameId: string,
  event: { type: string; payload: Record<string, unknown> }
) {
  const admin = createAdminClient();
  const channel = admin.channel(`game:${gameId}`, {
    config: {
      broadcast: { ack: true },
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out subscribing to game channel ${gameId}`));
      }, 5000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          clearTimeout(timeout);
          reject(new Error(`Failed to subscribe to game channel ${gameId}: ${status}`));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event: "game_event",
      payload: event,
    });
  } finally {
    await admin.removeChannel(channel);
  }
}

/**
 * Standard CORS headers for Edge Functions.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
