# Wedding RSVP

A wedding RSVP app ready for **Vercel + Supabase**.

Guests get a personal RSVP link, submit their response, and you can manage everything from `/admin`. Email notifications via Resend and WhatsApp notifications via CallMeBot are optional.

## Fastest setup on Windows

Open PowerShell in this folder and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
```

The script will:
- remove old Cloudflare-specific leftovers
- install dependencies
- ask for your wedding text, admin password, and Supabase keys
- push the project to GitHub
- create/link the Vercel project
- add environment variables to Vercel
- deploy to production twice so the public site URL is baked in

## What you need

- Node.js 18+
- Git
- Vercel account
- GitHub account
- Supabase project

## Required environment variables

```env
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_PUBLIC_RSVP_PROMPT=Please kindly respond for our wedding by May 3, 2026.
NEXT_PUBLIC_RSVP_DEADLINE=2026-05-03T23:59:59
NEXT_PUBLIC_INVITE_MESSAGE=You are warmly invited to our wedding!
ADMIN_PASSWORD=change-me
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
```

Optional:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@your-domain.com
NOTIFY_EMAIL=you@example.com
WHATSAPP_NOTIFY_PHONE=+11234567890
WHATSAPP_NOTIFY_API_KEY=your-callmebot-apikey
```

## Database setup

Run `schema.sql` once in your Supabase SQL Editor.

If you have `psql` installed and provide a Postgres connection string during setup, the PowerShell script will try to apply `schema.sql` automatically.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Deploying updates later

```bash
git add .
git commit -m "update"
git push
vercel --prod
```
