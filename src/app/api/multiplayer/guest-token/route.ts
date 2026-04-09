import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createAdminSupabaseClient();

  const guestNumber = Math.floor(1000 + Math.random() * 9000);

  const { data, error } = await supabase
    .from("players")
    .insert({ display_name: `Guest ${guestNumber}` })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
