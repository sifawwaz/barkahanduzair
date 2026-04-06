"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RSVPPage() {
  const params = useParams();
  const token = params?.token;

  const CHANGE_DEADLINE = new Date(process.env.NEXT_PUBLIC_RSVP_DEADLINE || "2026-06-20T23:59:59");

  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // selection: "pending" | "declined" | number (1..maxGuests)
  const [selection, setSelection] = useState("pending");
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const changesOpen = new Date() <= CHANGE_DEADLINE;

  useEffect(() => {
    const fetchGuest = async () => {
      try {
        const res = await fetch(`/api/guests?token=${token}`);
        if (!res.ok) { setGuest(null); setLoading(false); return; }
        const { data } = await res.json();
        setGuest(data || null);
        // Restore previous selection on load
        if (data?.rsvp_status === "attending") {
          setSelection(Number(data.attending_count) || 1);
        } else if (data?.rsvp_status === "declined") {
          setSelection("declined");
        } else {
          setSelection("pending");
        }
      } catch (err) {
        console.error(err);
        setGuest(null);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchGuest();
  }, [token]);

  const maxGuests = Number(guest?.max_guests || 1);

  const notify = async (payload) => {
    try {
      await fetch("/api/notify-rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Notify failed", error);
    }
  };

  const showAnimatedSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2600);
  };

  const handleSubmit = async () => {
    if (!guest || !changesOpen) return;

    if (selection === "pending") {
      showAnimatedSuccess("Please select an option from the dropdown.");
      return;
    }

    const isAttending = selection !== "declined";
    const attendingCount = isAttending ? Number(selection) : 0;
    const rsvp_status = isAttending ? "attending" : "declined";

    setSaving(true);
    const res = await fetch("/api/guests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, updates: { rsvp_status, attending_count: attendingCount } }),
    });
    setSaving(false);

    if (!res.ok) { showAnimatedSuccess("Could not save RSVP. Please try again."); return; }

    await notify({ invite_name: guest.invite_name, family: guest.family, rsvp_status, attending_count: attendingCount, max_guests: maxGuests });
    setGuest({ ...guest, rsvp_status, attending_count: attendingCount });
    showAnimatedSuccess("RSVP submitted successfully.");
  };

  const handleChangeResponse = () => {
    if (!changesOpen) return;
    setGuest((prev) => ({ ...prev, rsvp_status: "pending" }));
    setSelection("pending");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f4f1eb] text-[#4b4338]">Loading...</div>;
  }

  if (!guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1eb] px-6">
        <div className="w-full max-w-lg rounded-[36px] bg-white p-10 text-center shadow-[0_15px_40px_rgba(0,0,0,0.08)]">
          <h1 className="text-2xl font-semibold text-[#3d342b]">Invitation Not Found</h1>
          <p className="mt-3 text-[#6e665d]">This RSVP link is invalid or no longer available.</p>
        </div>
      </div>
    );
  }

  const alreadyResponded = guest.rsvp_status && guest.rsvp_status !== "pending";

  return (
    <div className="min-h-screen bg-[#f4f1eb] px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto w-full max-w-4xl rounded-[38px] border border-[#ece7df] bg-white px-6 py-8 shadow-[0_18px_45px_rgba(0,0,0,0.08)] md:px-10 md:py-10">
          <div className="mb-8 flex justify-center">
            <img src="/rsvp.png" alt="RSVP" className="w-[240px] md:w-[360px] object-contain" />
          </div>

          <p className="mb-8 text-center text-[15px] text-[#5f5a54] md:text-[17px]">
            {process.env.NEXT_PUBLIC_RSVP_PROMPT || "Please kindly respond for the Shaadi of Barkah and Uzair by June 20th 2026."}
          </p>

          <div className="mb-8 rounded-[28px] border border-[#ebe6de] bg-[#fcfbf8] px-6 py-8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-[#8b8175]">Invitation For</p>
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold leading-tight text-[#2f2a24] md:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {guest.invite_name || guest.family}
            </h2>
            <p className="mt-5 text-[17px] text-[#6a635c]">
              Total invited from your family: <span className="font-semibold text-[#2f2a24]">{maxGuests}</span>
            </p>
          </div>

          {showSuccess && (
            <div className="mb-6 animate-[fadeSlide_0.35s_ease-out] rounded-2xl border border-[#d7eadb] bg-[#edf8f0] px-5 py-4 text-center text-[#2e6a40] shadow-sm">
              {successMessage}
            </div>
          )}

          {alreadyResponded ? (
            <div className="text-center">
              <p className="mb-4 text-lg text-[#514a42]">Your response has been recorded.</p>
              <div className="mx-auto mb-5 inline-block rounded-full bg-[#efe6d8] px-6 py-3 text-lg font-semibold text-[#69553a]">
                {guest.rsvp_status === "attending" ? `Attending (${guest.attending_count || 0})` : "Not Attending"}
              </div>
              {changesOpen ? (
                <button onClick={handleChangeResponse} className="mt-7 block mx-auto rounded-full bg-[#b7a48d] px-7 py-3 font-semibold text-white transition hover:bg-[#a18d75]">
                  Change RSVP
                </button>
              ) : (
                <p className="mt-6 text-sm text-[#8a8176]">RSVP changes are now closed.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="mb-6">
                <label className="mb-3 block text-left text-lg font-medium text-[#2f2a24]">
                  How many guests will be attending?
                </label>
                <select
                  value={selection}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelection(val === "declined" || val === "pending" ? val : Number(val));
                  }}
                  className="w-full rounded-2xl border border-[#ddd6cc] bg-white px-5 py-4 text-lg text-black outline-none transition focus:border-[#b8a58f]"
                >
                  <option value="pending">Select one</option>
                  <option value="declined">Not Attending</option>
                  {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Guest" : "Guests"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleSubmit}
                  disabled={saving || !changesOpen}
                  className="rounded-full bg-[#b7a48d] px-10 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-[#a18d75] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Submit RSVP"}
                </button>
              </div>

              {!changesOpen && (
                <p className="mt-4 text-center text-sm text-[#8a8176]">RSVP submissions and changes are closed.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes fadeSlide {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}