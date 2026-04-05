import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Wedding Invitation
        </p>

        <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
          You Are Invited
        </h1>

        <p className="mb-3 text-xl text-zinc-700">
          Join us as we celebrate our wedding day
        </p>

        <p className="mb-10 max-w-2xl text-base leading-7 text-zinc-600">
          We are so excited to celebrate with our family and friends. Please use
          your personal RSVP link to confirm your attendance.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/admin"
            className="rounded-full bg-black px-6 py-3 text-white transition hover:bg-zinc-800"
          >
            Open Admin Dashboard
          </Link>

          <Link
            href="/rsvp"
            className="rounded-full border border-zinc-300 px-6 py-3 transition hover:bg-zinc-100"
          >
            RSVP Page
          </Link>
        </div>
      </section>
    </main>
  );
}