-- Wedding RSVP — Database Schema for Supabase Postgres
-- Run this once in the Supabase SQL Editor if setup.ps1 did not apply it automatically.

create extension if not exists pgcrypto;

create table if not exists public.guests (
  id text primary key default gen_random_uuid()::text,
  invite_name text,
  family text,
  token text unique not null,
  max_guests integer default 1,
  rsvp_status text default 'pending',
  attending_count integer default 0,
  men_count integer,
  women_count integer,
  attending_names text,
  created_at timestamptz default now()
);
