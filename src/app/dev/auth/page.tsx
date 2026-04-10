import { notFound } from "next/navigation";
import DevAuthClient from "./DevAuthClient";
import { isDevAuthEnabled } from "@/lib/qf-user/dev-auth";
import { listPlayersForDevAuth } from "@/lib/qf-user/user-profile";

export const dynamic = "force-dynamic";

export default async function DevAuthPage() {
  if (!isDevAuthEnabled()) {
    notFound();
  }

  const players = await listPlayersForDevAuth();

  return <DevAuthClient players={players} />;
}
