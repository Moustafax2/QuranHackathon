import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import {
  getInvitationById,
  updateInvitationStatus,
} from "@/lib/social/invitations";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const invitation = await getInvitationById(id);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.invitee_qf_user_id !== session.user.sub) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "This invitation has already been handled." },
        { status: 400 }
      );
    }

    await updateInvitationStatus(id, "declined");

    return NextResponse.json(
      { success: true },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to decline invitation.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
