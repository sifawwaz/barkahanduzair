"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [guests, setGuests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);

  const [newInviteName, setNewInviteName] = useState("");
  const [newFamily, setNewFamily] = useState("");
  const [newMaxGuests, setNewMaxGuests] = useState(1);
  const [addingGuest, setAddingGuest] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editInviteName, setEditInviteName] = useState("");
  const [editFamily, setEditFamily] = useState("");
  const [editMaxGuests, setEditMaxGuests] = useState(1);

  const [uploadingCsv, setUploadingCsv] = useState(false);
  const fileInputRef = useRef(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-auth");
    if (saved === "true") {
      setAuthorized(true);
    }
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (authorized) {
      fetchGuests();
    }
  }, [authorized]);

  const login = async () => {
    setLoginError("");

    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setLoginError("Incorrect password.");
      return;
    }

    sessionStorage.setItem("admin-auth", "true");
    setAuthorized(true);
    setPassword("");
  };

  const logout = () => {
    sessionStorage.removeItem("admin-auth");
    setAuthorized(false);
  };

  const fetchGuests = async () => {
    const res = await fetch("/api/guests");
    if (!res.ok) { console.error("Error fetching guests"); return; }
    const { data } = await res.json();
    setGuests(data || []);
  };

  const generateToken = (length = 12) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";

    for (let i = 0; i < length; i += 1) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  };

  const getUniqueToken = async () => {
    let token = generateToken();
    let exists = true;

    while (exists) {
      const res = await fetch(`/api/guests?token=${token}`);
      if (res.status === 404) {
        exists = false;
      } else {
        token = generateToken();
      }
    }

    return token;
  };

  const generateLinks = (guest) => {
    const url = `${baseUrl}/rsvp/${guest.token}`;
    const displayName = guest.invite_name || guest.family || "Guest";
    const message = `${process.env.NEXT_PUBLIC_INVITE_MESSAGE || "You are invited!"} ${displayName}.\n\nPlease RSVP here: ${url}`;

    return {
      url,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      sms: `sms:?body=${encodeURIComponent(message)}`,
    };
  };

  const addGuest = async () => {
    if (!newInviteName.trim()) {
      alert("Please enter an invite name.");
      return;
    }

    setAddingGuest(true);

    try {
      const token = await getUniqueToken();
      const rsvpPath = `/rsvp/${token}`;
      const rsvpLink = `${baseUrl}${rsvpPath}`;

      const payload = {
        invite_name: newInviteName.trim(),
        family: newFamily.trim() || null,
        max_guests: Number(newMaxGuests) || 1,
        token,
        rsvp_path: rsvpPath,
        rsvp_link: rsvpLink,
        rsvp_status: "pending",
        attending_count: 0,
        attending_names: null,
      };

      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: payload }),
      });
      if (!res.ok) { alert("Could not add guest."); return; }

      setNewInviteName("");
      setNewFamily("");
      setNewMaxGuests(1);
      await fetchGuests();
    } finally {
      setAddingGuest(false);
    }
  };

  const startEdit = (guest) => {
    setEditingId(guest.id);
    setEditInviteName(guest.invite_name || "");
    setEditFamily(guest.family || "");
    setEditMaxGuests(guest.max_guests || 1);
  };

  const saveEdit = async (guest) => {
    const res = await fetch("/api/guests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: guest.id, updates: {
        invite_name: editInviteName.trim(),
        family: editFamily.trim() || null,
        max_guests: Number(editMaxGuests) || 1,
      }}),
    });
    if (!res.ok) { alert("Could not save changes."); return; }
    setEditingId(null);
    await fetchGuests();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditInviteName("");
    setEditFamily("");
    setEditMaxGuests(1);
  };

  const resetRsvp = async (guest) => {
    const res = await fetch("/api/guests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: guest.id, updates: { rsvp_status: "pending", attending_count: 0, attending_names: null } }),
    });
    if (!res.ok) { alert("Could not reset RSVP."); return; }
    await fetchGuests();
  };

  const deleteGuest = async (guest) => {
    const confirmed = window.confirm(
      `Delete ${guest.invite_name || guest.family || "this guest"}?`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/guests?id=${guest.id}`, { method: "DELETE" });
    if (!res.ok) { alert("Could not delete guest."); return; }

    await fetchGuests();
  };

  const copyLink = async (guest) => {
    const { url } = generateLinks(guest);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(guest.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const parseCsvText = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const splitCsvLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result.map((v) => v.replace(/^"|"$/g, ""));
    };

    const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());

    return lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);

    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      const payloads = [];

      for (const row of rows) {
        const inviteName = row.invite_name?.trim() || "";
        const family = row.family?.trim() || "";
        const maxGuests = Number(row.max_guests || 1) || 1;

        if (!inviteName && !family) continue;

        const token = row.token?.trim() || (await getUniqueToken());
        const rsvpPath = `/rsvp/${token}`;
        const rsvpLink = `${baseUrl}${rsvpPath}`;

        payloads.push({
          invite_name: inviteName || null,
          family: family || null,
          max_guests: maxGuests,
          token,
          rsvp_path: rsvpPath,
          rsvp_link: rsvpLink,
          rsvp_status: "pending",
          attending_count: 0,
          attending_names: null,
        });
      }

      if (!payloads.length) {
        alert("No valid guest rows found in CSV.");
        return;
      }

      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: payloads }),
      });
      if (!res.ok) { alert("Could not upload CSV."); return; }

      await fetchGuests();
      alert("CSV uploaded successfully.");
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stats = useMemo(() => {
    const attendingHouseholds = guests.filter(
      (g) => g.rsvp_status === "attending"
    ).length;

    const attendingPeople = guests
      .filter((g) => g.rsvp_status === "attending")
      .reduce((sum, g) => sum + Number(g.attending_count || 0), 0);

    const declined = guests.filter((g) => g.rsvp_status === "declined").length;
    const pending = guests.filter(
      (g) => !g.rsvp_status || g.rsvp_status === "pending"
    ).length;

    return {
      total: guests.length,
      attendingHouseholds,
      attendingPeople,
      declined,
      pending,
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    if (filter === "attending") {
      return guests.filter((g) => g.rsvp_status === "attending");
    }

    if (filter === "declined") {
      return guests.filter((g) => g.rsvp_status === "declined");
    }

    if (filter === "pending") {
      return guests.filter(
        (g) => !g.rsvp_status || g.rsvp_status === "pending"
      );
    }

    return guests;
  }, [guests, filter]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        Loading...
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-zinc-900">
            Admin Login
          </h1>
          <p className="mb-5 text-zinc-600">
            Enter the admin password to access the dashboard.
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border bg-white px-4 py-3 text-black"
            placeholder="Password"
          />

          {loginError && (
            <p className="mb-4 text-sm text-red-600">{loginError}</p>
          )}

          <button
            onClick={login}
            className="w-full rounded-lg bg-black px-4 py-3 text-white hover:bg-zinc-800"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-900">
              RSVP Dashboard
            </h1>
            <p className="text-zinc-600">
              Manage guests, upload CSVs, generate links, edit invites, and control
              RSVPs.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-white hover:bg-zinc-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900">
              Add Guest
            </h2>

            <div className="grid gap-4 md:grid-cols-4">
              <input
                type="text"
                placeholder="Invite name"
                value={newInviteName}
                onChange={(e) => setNewInviteName(e.target.value)}
                className="rounded-lg border bg-white px-4 py-3 text-black placeholder:text-black"
              />

              <input
                type="text"
                placeholder="Family (optional)"
                value={newFamily}
                onChange={(e) => setNewFamily(e.target.value)}
                className="rounded-lg border bg-white px-4 py-3 text-black placeholder:text-black"
              />

              <input
                type="number"
                min="1"
                placeholder="Max guests"
                value={newMaxGuests}
                onChange={(e) => setNewMaxGuests(e.target.value)}
                className="rounded-lg border bg-white px-4 py-3 text-black placeholder:text-black"
              />

              <button
                onClick={addGuest}
                disabled={addingGuest}
                className="rounded-lg bg-black px-4 py-3 text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {addingGuest ? "Adding..." : "Add Guest"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900">
              Upload CSV
            </h2>

            <p className="mb-4 text-sm text-zinc-600">
              Use headers like: <span className="font-semibold">invite_name</span>,{" "}
              <span className="font-semibold">family</span>,{" "}
              <span className="font-semibold">max_guests</span>, optionally{" "}
              <span className="font-semibold">token</span>.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="mb-3 block w-full rounded-lg border bg-white px-4 py-3 text-black"
            />

            <p className="text-sm text-zinc-500">
              {uploadingCsv
                ? "Uploading CSV..."
                : "Tokens and RSVP links will be auto-generated if missing."}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Total Invites</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">
              {stats.total}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Attending Households</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {stats.attendingHouseholds}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Attending People</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {stats.attendingPeople}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Not Attending</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {stats.declined}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {stats.pending}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {["all", "attending", "declined", "pending"].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-5 py-2 font-medium ${
                filter === value
                  ? "bg-black text-white"
                  : "border bg-white text-zinc-700"
              }`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Invite Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Family
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Max
                </th>

                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  RSVP Link
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredGuests.map((guest) => {
                const links = generateLinks(guest);
                const isEditing = editingId === guest.id;

                return (
                  <tr key={guest.id} className="border-t align-top">
                    <td className="px-4 py-3 text-zinc-900">
                      {isEditing ? (
                        <input
                          value={editInviteName}
                          onChange={(e) => setEditInviteName(e.target.value)}
                          className="w-full rounded border px-3 py-2 text-black"
                        />
                      ) : (
                        guest.invite_name || "-"
                      )}
                    </td>

                    <td className="px-4 py-3 text-zinc-700">
                      {isEditing ? (
                        <input
                          value={editFamily}
                          onChange={(e) => setEditFamily(e.target.value)}
                          className="w-full rounded border px-3 py-2 text-black"
                        />
                      ) : (
                        guest.family || "-"
                      )}
                    </td>

                    <td className="px-4 py-3 text-zinc-700">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={editMaxGuests}
                          onChange={(e) => setEditMaxGuests(e.target.value)}
                          className="w-20 rounded border px-3 py-2 text-black"
                        />
                      ) : (
                        guest.max_guests ?? 1
                      )}
                    </td>


                    <td className="px-4 py-3 text-zinc-700">
                      {guest.attending_count ?? 0}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                          guest.rsvp_status === "attending"
                            ? "bg-green-100 text-green-700"
                            : guest.rsvp_status === "declined"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {guest.rsvp_status || "pending"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <a
                        href={links.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-blue-600 underline"
                      >
                        {links.url}
                      </a>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(guest)}
                              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded bg-zinc-500 px-3 py-1 text-sm text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(guest)}
                              className="rounded bg-amber-600 px-3 py-1 text-sm text-white"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => resetRsvp(guest)}
                              className="rounded bg-purple-600 px-3 py-1 text-sm text-white"
                            >
                              Reset RSVP
                            </button>
                            <button
                              onClick={() => deleteGuest(guest)}
                              className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => copyLink(guest)}
                              className="rounded bg-zinc-800 px-3 py-1 text-sm text-white"
                            >
                              {copiedId === guest.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              onClick={() => window.open(links.whatsapp, "_blank")}
                              className="rounded bg-green-500 px-3 py-1 text-sm text-white"
                            >
                              WhatsApp
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredGuests.length === 0 && (
                <tr>
                  <td
                    colSpan="9"
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No guests found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}