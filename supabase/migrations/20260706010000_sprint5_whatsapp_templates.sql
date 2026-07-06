-- =============================================================================
-- Migration: Sprint 5 — WhatsApp Templates Table
-- Creates the whatsapp_templates table with RLS and seeds default templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates (for template selector)
CREATE POLICY "authenticated_read_templates" ON public.whatsapp_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can create/edit/delete templates
CREATE POLICY "admin_manage_templates" ON public.whatsapp_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed 2 default templates
INSERT INTO public.whatsapp_templates (name, body) VALUES
  ('Greeting',          'Hello {name}, greetings from the ministry! How are you doing today?'),
  ('Prayer Follow-up',  'Hi {name}, we wanted to follow up on your prayer request. How can we continue to support you?')
ON CONFLICT DO NOTHING;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
