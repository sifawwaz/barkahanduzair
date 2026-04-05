import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const {
      invite_name,
      family,
      rsvp_status,
      attending_count,
      max_guests,
    } = body;

    const displayName = invite_name || family || "Guest";

    let attendingGuests = [];
    try {
      const { data, error } = await supabase
        .from("guests")
        .select("invite_name, family, attending_count, max_guests, men_count, women_count")
        .eq("rsvp_status", "attending")
        .order("invite_name", { ascending: true, nullsFirst: false });

      if (error) throw error;
      attendingGuests = data || [];
    } catch (attendingError) {
      console.error("Error fetching attending list:", attendingError);
    }

    const totalAttendingPeople = (attendingGuests || []).reduce(
      (sum, guest) => sum + Number(guest.attending_count || 0),
      0
    );

    const formattedAttendingList = (attendingGuests || [])
      .map((guest, index) => {
        const name = guest.invite_name || guest.family || "Guest";
        const count = guest.attending_count || 0;
        const invited = guest.max_guests || 1;

        return `
          <tr>
            <td style="padding:8px; border:1px solid #ddd;">${index + 1}</td>
            <td style="padding:8px; border:1px solid #ddd;">${name}</td>
            <td style="padding:8px; border:1px solid #ddd;">${invited}</td>
            <td style="padding:8px; border:1px solid #ddd;">${count}</td>
          </tr>
        `;
      })
      .join("");

    const subject = `RSVP Update: ${displayName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>RSVP Update</h2>
        <p><strong>Guest:</strong> ${displayName}</p>
        <p><strong>Status:</strong> ${rsvp_status}</p>
        <p><strong>Invited Count:</strong> ${max_guests ?? 1}</p>
        <p><strong>Total Attending:</strong> ${attending_count ?? 0}</p>

        <hr style="margin: 24px 0;" />

        <h3>Current Attending Summary</h3>
        <p><strong>Total Attending Households:</strong> ${(attendingGuests || []).length}</p>
        <p><strong>Total People:</strong> ${totalAttendingPeople}</p>

        <h3 style="margin-top: 24px;">Current Full Attending List</h3>

        <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
          <thead>
            <tr>
              <th style="padding:8px; border:1px solid #ddd; background:#f5f5f5;">#</th>
              <th style="padding:8px; border:1px solid #ddd; background:#f5f5f5;">Guest</th>
              <th style="padding:8px; border:1px solid #ddd; background:#f5f5f5;">Invited</th>
              <th style="padding:8px; border:1px solid #ddd; background:#f5f5f5;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${
              formattedAttendingList ||
              `
              <tr>
                <td colspan="6" style="padding:8px; border:1px solid #ddd;">
                  No guests attending yet.
                </td>
              </tr>
            `
            }
          </tbody>
        </table>
      </div>
    `;

    const whatsappMessage = [
      "RSVP Update",
      "",
      `Guest: ${displayName}`,
      `Status: ${rsvp_status}`,
      `Invited: ${max_guests ?? 1}`,
      `Total: ${attending_count ?? 0}`,
      "",
      "Current Summary",
      `Households: ${(attendingGuests || []).length}`,
      `Total People: ${totalAttendingPeople}`,
    ].join("\n");

    let emailSent = false;
    let whatsappSent = false;
    let emailError = null;
    let whatsappError = null;

    if (resend && process.env.NOTIFY_EMAIL) {
      try {
        const recipients = (process.env.NOTIFY_EMAIL || "")
          .split(",")
          .map((email) => email.trim())
          .filter((email) => email.includes("@"));

        if (recipients.length) {
          const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: recipients,
            subject,
            html,
          });

          if (error) {
            emailError = error;
            console.error("Resend error:", error);
          } else {
            emailSent = true;
          }
        }
      } catch (err) {
        emailError = String(err);
        console.error("Email send failed:", err);
      }
    }

    const phone = (process.env.WHATSAPP_NOTIFY_PHONE || "").replace(/[^\d]/g, "");
    const apiKey = process.env.WHATSAPP_NOTIFY_API_KEY || "";

    if (phone && apiKey) {
      try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(
          whatsappMessage
        )}&apikey=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, { method: "GET" });
        const text = await response.text();

        if (!response.ok) {
          whatsappError = text || `HTTP ${response.status}`;
          console.error("WhatsApp error:", whatsappError);
        } else {
          whatsappSent = true;
        }
      } catch (err) {
        whatsappError = String(err);
        console.error("WhatsApp send failed:", err);
      }
    }

    return Response.json({
      ok: true,
      emailSent,
      whatsappSent,
      emailError,
      whatsappError,
    });
  } catch (error) {
    console.error("Notify route failed:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
