import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (token) {
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .eq("token", token)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      return Response.json({ data });
    }

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .order("invite_name", { ascending: true, nullsFirst: false });

    if (error) throw error;

    return Response.json({ data: data || [] });
  } catch (err) {
    console.error("GET /api/guests error:", err);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const rows = body.guests || (body.guest ? [body.guest] : []);
    if (!rows.length) {
      return Response.json({ error: "No guest data" }, { status: 400 });
    }

    const payload = rows.map((g) => ({
      id: crypto.randomUUID(),
      invite_name: g.invite_name || null,
      family: g.family || null,
      token: g.token,
      max_guests: Number(g.max_guests) || 1,
      rsvp_status: "pending",
      attending_count: 0,
      attending_names: null,
      men_count: null,
      women_count: null,
    }));

    const { error } = await supabase.from("guests").insert(payload);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/guests error:", err);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, token, updates } = body;

    if (!updates || (!id && !token)) {
      return Response.json({ error: "Missing id/token or updates" }, { status: 400 });
    }

    const allowed = [
      "invite_name",
      "family",
      "max_guests",
      "rsvp_status",
      "attending_count",
      "attending_names",
      "men_count",
      "women_count",
    ];

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowed.includes(key))
    );

    if (!Object.keys(filteredUpdates).length) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    let query = supabase.from("guests").update(filteredUpdates);
    query = id ? query.eq("id", id) : query.eq("token", token);

    const { error } = await query;
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/guests error:", err);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase.from("guests").delete().eq("id", id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/guests error:", err);
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
