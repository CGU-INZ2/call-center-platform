-- =============================================================================
-- Migration: Full Schema, RLS Hardening & Audit Triggers
-- Sprint 1.2 — Ministry Call Center Platform
-- =============================================================================


-- =============================================================================
-- 1. CATEGORIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id          BIGSERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  color_hex   TEXT NOT NULL DEFAULT '#6B7280',
  is_system   BOOLEAN NOT NULL DEFAULT false, -- system categories can't be deleted
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default system categories
INSERT INTO public.categories (label, color_hex, is_system) VALUES
  ('New Contact',          '#3B82F6', true),
  ('Attempted',            '#F59E0B', true),
  ('Connected',            '#10B981', true),
  ('Follow-up Required',   '#8B5CF6', true),
  ('Not Interested',       '#EF4444', true)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories
CREATE POLICY "authenticated_read_categories" ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete
CREATE POLICY "admin_manage_categories" ON public.categories
  FOR ALL USING (public.is_admin());


-- =============================================================================
-- 2. CONTACTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  phone               TEXT,
  email               TEXT,
  category_id         BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  assigned_agent_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source              TEXT,                            -- e.g. 'spreadsheet_import', 'manual'
  country             TEXT NOT NULL DEFAULT 'India',
  state               TEXT,
  district_city       TEXT,
  geo_status          TEXT NOT NULL DEFAULT 'unmapped'
                        CHECK (geo_status IN ('mapped', 'unmapped')),
  last_contacted_at   TIMESTAMPTZ,
  next_followup_at    TIMESTAMPTZ,
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast agent-scoped queries
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_agent
  ON public.contacts (assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_contacts_category
  ON public.contacts (category_id);

CREATE INDEX IF NOT EXISTS idx_contacts_geo_status
  ON public.contacts (geo_status);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "admin_all_contacts" ON public.contacts
  FOR ALL USING (public.is_admin());

-- Agents can only SELECT their own assigned contacts
CREATE POLICY "agent_read_own_contacts" ON public.contacts
  FOR SELECT USING (
    assigned_agent_id = auth.uid()
    AND NOT public.is_admin()
  );

-- Agents can INSERT contacts (auto-assigns themselves as creator)
CREATE POLICY "agent_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND NOT public.is_admin()
    AND created_by = auth.uid()
    AND assigned_agent_id = auth.uid()
  );

-- Agents can UPDATE only their own assigned contacts
CREATE POLICY "agent_update_own_contacts" ON public.contacts
  FOR UPDATE USING (
    assigned_agent_id = auth.uid()
    AND NOT public.is_admin()
  );


-- =============================================================================
-- 3. CALLS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_secs   INTEGER,                            -- null until call ends
  outcome         TEXT CHECK (outcome IN (
                    'answered', 'no_answer', 'busy', 'callback_requested',
                    'prayer_request', 'not_interested', 'other'
                  )),
  notes           TEXT,
  next_action     TEXT,
  recording_url   TEXT,                               -- Phase 6 only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_contact ON public.calls (contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent   ON public.calls (agent_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Admins see all calls
CREATE POLICY "admin_all_calls" ON public.calls
  FOR ALL USING (public.is_admin());

-- Agents can read calls for their assigned contacts
CREATE POLICY "agent_read_own_calls" ON public.calls
  FOR SELECT USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id AND c.assigned_agent_id = auth.uid()
    )
  );

-- Agents can insert calls on their own contacts
CREATE POLICY "agent_insert_calls" ON public.calls
  FOR INSERT WITH CHECK (
    NOT public.is_admin()
    AND agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id AND c.assigned_agent_id = auth.uid()
    )
  );

-- Agents can update their own calls only
CREATE POLICY "agent_update_own_calls" ON public.calls
  FOR UPDATE USING (
    NOT public.is_admin()
    AND agent_id = auth.uid()
  );


-- =============================================================================
-- 4. FOLLOWUPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.followups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at      TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'done', 'missed')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_agent   ON public.followups (agent_id);
CREATE INDEX IF NOT EXISTS idx_followups_contact ON public.followups (contact_id);
CREATE INDEX IF NOT EXISTS idx_followups_status  ON public.followups (status, due_at);

ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_followups" ON public.followups
  FOR ALL USING (public.is_admin());

CREATE POLICY "agent_own_followups" ON public.followups
  FOR ALL USING (
    NOT public.is_admin()
    AND agent_id = auth.uid()
  );


-- =============================================================================
-- 5. WHATSAPP MESSAGES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  template_used   TEXT,
  body            TEXT,
  marked_sent_at  TIMESTAMPTZ,          -- manually marked by agent after sending
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_contact ON public.whatsapp_messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_wa_agent   ON public.whatsapp_messages (agent_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_wa" ON public.whatsapp_messages
  FOR ALL USING (public.is_admin());

CREATE POLICY "agent_own_wa" ON public.whatsapp_messages
  FOR ALL USING (
    NOT public.is_admin()
    AND agent_id = auth.uid()
  );


-- =============================================================================
-- 6. PRAYER REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('prayer', 'testimony')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prayer_contact ON public.prayer_requests (contact_id);
CREATE INDEX IF NOT EXISTS idx_prayer_agent   ON public.prayer_requests (agent_id);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_prayer" ON public.prayer_requests
  FOR ALL USING (public.is_admin());

CREATE POLICY "agent_own_prayer" ON public.prayer_requests
  FOR ALL USING (
    NOT public.is_admin()
    AND agent_id = auth.uid()
  );


-- =============================================================================
-- 7. AUTO-UPDATE TRIGGERS (updated_at timestamps)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER followups_set_updated_at
  BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 8. AUDIT LOG TRIGGERS (auto-log inserts/updates on contacts & calls)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_to_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) VALUES (
    auth.uid(),
    TG_OP,                          -- 'INSERT', 'UPDATE', or 'DELETE'
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach to contacts table
CREATE OR REPLACE TRIGGER contacts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();

-- Attach to calls table
CREATE OR REPLACE TRIGGER calls_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();
