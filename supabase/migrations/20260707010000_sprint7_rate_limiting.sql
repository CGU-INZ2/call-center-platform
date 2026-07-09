-- Migration: Sprint 7.1 — Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          BIGSERIAL PRIMARY KEY,
  identifier  TEXT NOT NULL, -- User ID or Client IP
  action      TEXT NOT NULL, -- Action name (e.g. 'create_user')
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast sliding-window querying and logs cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action
  ON public.rate_limits (identifier, action, created_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Admins can view/audit rate logs
CREATE POLICY "admin_all_rate_limits" ON public.rate_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Backend routes can insert logs
CREATE POLICY "service_role_write_rate_limits" ON public.rate_limits
  FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
