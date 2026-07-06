-- Migration: Add Sprint 2.2 fields to public.contacts table
-- Adds fields for language, address, ministry preferences, cell group details, and call status.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS raw_address TEXT,
  ADD COLUMN IF NOT EXISTS watched_program BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS want_prayer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prayer_day_time TEXT,
  ADD COLUMN IF NOT EXISTS want_ror_daily BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cell_group_name TEXT,
  ADD COLUMN IF NOT EXISTS cell_group_leader TEXT,
  ADD COLUMN IF NOT EXISTS call_status TEXT NOT NULL DEFAULT 'New';

-- Re-notify PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
