-- =============================================================================
-- Migration: Fix Contacts & Profiles Foreign Keys for PostgREST Joins
-- =============================================================================

-- 1. Fix public.contacts
ALTER TABLE public.contacts 
  DROP CONSTRAINT IF EXISTS contacts_assigned_agent_id_fkey,
  DROP CONSTRAINT IF EXISTS contacts_created_by_fkey;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_assigned_agent_id_fkey 
    FOREIGN KEY (assigned_agent_id) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT contacts_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;

-- 2. Fix public.calls
ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_agent_id_fkey;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_agent_id_fkey
    FOREIGN KEY (agent_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 3. Fix public.followups
ALTER TABLE public.followups
  DROP CONSTRAINT IF EXISTS followups_agent_id_fkey;

ALTER TABLE public.followups
  ADD CONSTRAINT followups_agent_id_fkey
    FOREIGN KEY (agent_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 4. Fix public.whatsapp_messages
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_agent_id_fkey;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_agent_id_fkey
    FOREIGN KEY (agent_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 5. Fix public.prayer_requests
ALTER TABLE public.prayer_requests
  DROP CONSTRAINT IF EXISTS prayer_requests_agent_id_fkey;

ALTER TABLE public.prayer_requests
  ADD CONSTRAINT prayer_requests_agent_id_fkey
    FOREIGN KEY (agent_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
