# Sprint 1.2 — Full Schema Migration + RLS Policies
# Thinking: HIGH — RLS policies need careful logic, cross-table relationships

## What to Build
All remaining database tables, RLS policies tested with real accounts, audit_log triggers on contacts and calls.

## Database Schema (run in Supabase SQL Editor, in this order)

### 1. Categories
```sql
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#d4a853',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories (org-wide)
CREATE POLICY "authenticated_read_categories" ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete categories
CREATE POLICY "admin_manage_categories" ON public.categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed system categories
INSERT INTO public.categories (label, color_hex, is_system) VALUES
  ('New', '#60a5fa', true),
  ('Active', '#34d399', true),
  ('Follow Up', '#fbbf24', true),
  ('Not Interested', '#f87171', true),
  ('Converted', '#a78bfa', true);
```

### 2. Contacts
```sql
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  category_id UUID REFERENCES public.categories(id),
  assigned_agent_id UUID REFERENCES public.profiles(id),
  source TEXT DEFAULT 'manual',
  country TEXT NOT NULL DEFAULT 'India',
  state TEXT,
  district_city TEXT,
  raw_address TEXT,
  geo_status TEXT NOT NULL DEFAULT 'unmapped' CHECK (geo_status IN ('mapped', 'unmapped')),
  language TEXT,
  watched_ministry_program BOOLEAN DEFAULT false,
  program_name TEXT,
  want_prayer BOOLEAN DEFAULT false,
  prayer_day_time TEXT,
  want_ror_daily BOOLEAN DEFAULT false,
  cell_group_name TEXT,
  cell_group_leader TEXT,
  call_status TEXT DEFAULT 'New' CHECK (call_status IN ('New','Active','Follow Up','Not Interested','Converted','Completed')),
  call_status_notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_assigned_agent ON public.contacts(assigned_agent_id);
CREATE INDEX idx_contacts_category ON public.contacts(category_id);
CREATE INDEX idx_contacts_state ON public.contacts(state);
CREATE INDEX idx_contacts_call_status ON public.contacts(call_status);
CREATE INDEX idx_contacts_next_followup ON public.contacts(next_followup_at);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Agents see only their assigned contacts
CREATE POLICY "agent_read_own_contacts" ON public.contacts
  FOR SELECT USING (assigned_agent_id = auth.uid());

-- Admins see all contacts
CREATE POLICY "admin_read_all_contacts" ON public.contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Agents can insert contacts (auto-assign to self)
CREATE POLICY "agent_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND assigned_agent_id = auth.uid()
  );

-- Admin can insert contacts (assign to anyone)
CREATE POLICY "admin_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Agents update only their own contacts
CREATE POLICY "agent_update_own_contacts" ON public.contacts
  FOR UPDATE USING (assigned_agent_id = auth.uid())
  WITH CHECK (assigned_agent_id = auth.uid());

-- Admin updates any contact
CREATE POLICY "admin_update_all_contacts" ON public.contacts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admin can delete
CREATE POLICY "admin_delete_contacts" ON public.contacts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### 3. Calls
```sql
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  outcome TEXT,
  notes TEXT,
  next_action TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_read_own_calls" ON public.calls
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "admin_read_all_calls" ON public.calls
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "agent_insert_own_calls" ON public.calls
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "admin_insert_calls" ON public.calls
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### 4. Followups
```sql
CREATE TABLE public.followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','missed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

-- Same agent/admin pattern
CREATE POLICY "agent_read_own_followups" ON public.followups
  FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "admin_read_all_followups" ON public.followups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "agent_insert_own_followups" ON public.followups
  FOR INSERT WITH CHECK (agent_id = auth.uid());
CREATE POLICY "agent_update_own_followups" ON public.followups
  FOR UPDATE USING (agent_id = auth.uid());
CREATE POLICY "admin_manage_followups" ON public.followups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### 5. WhatsApp Messages
```sql
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  template_used TEXT,
  body TEXT,
  marked_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_read_own_wa" ON public.whatsapp_messages
  FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "admin_read_all_wa" ON public.whatsapp_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "agent_insert_own_wa" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (agent_id = auth.uid());
```

### 6. Prayer Requests
```sql
CREATE TABLE public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL DEFAULT 'prayer' CHECK (type IN ('prayer', 'testimony')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_read_own_prayers" ON public.prayer_requests
  FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "admin_read_all_prayers" ON public.prayer_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "agent_insert_own_prayers" ON public.prayer_requests
  FOR INSERT WITH CHECK (agent_id = auth.uid());
```

### 7. Tags System (Foundation — UI built later)
```sql
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL DEFAULT '#8b8fa3',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_tags (
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_tags" ON public.tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_tags" ON public.tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "authenticated_read_contact_tags" ON public.contact_tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "agent_manage_own_contact_tags" ON public.contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE id = contact_id AND assigned_agent_id = auth.uid())
  );
CREATE POLICY "admin_manage_all_contact_tags" ON public.contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```
> **NOTE:** This is schema-only. Tag management UI will be built in a future phase.

### 8. Team Foundation (Schema only — UI built later)
Add `team_id` to profiles for future supervisor role:
```sql
ALTER TABLE public.profiles ADD COLUMN team_id UUID;
-- No FK constraint yet — teams table will be created when supervisor role is built
-- This column is nullable and unused until Phase 2+
```

### 9. Audit Log Trigger (on contacts)
```sql
CREATE OR REPLACE FUNCTION public.log_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
    VALUES (auth.uid(), 'updated', 'contact', NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, after_data)
    VALUES (auth.uid(), 'created', 'contact', NEW.id::text, to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before_data)
    VALUES (auth.uid(), 'deleted', 'contact', OLD.id::text, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER contact_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_contact_changes();
```

## RLS Testing Protocol
After running all SQL above:
1. Create Admin account (if not done in 1.1)
2. Create Agent A account via the admin UI
3. Create Agent B account via the admin UI
4. As Admin: insert 2 contacts, assign one to Agent A, one to Agent B
5. Log in as Agent A → should see ONLY their contact
6. As Agent A, try direct API call: `supabase.from('contacts').select('*')` → must return only 1 row
7. As Agent A, try: `supabase.from('audit_log').select('*')` → must return 0 rows
8. As Admin: `supabase.from('contacts').select('*')` → must return all rows
9. **Report results explicitly**

## Definition of Done
- [ ] All 8 tables exist with correct columns and constraints
- [ ] RLS policies applied to every table
- [ ] Audit trigger fires on contact insert/update/delete
- [ ] RLS test protocol executed — Agent B cannot see Agent A's data (confirmed)
- [ ] Agent cannot read audit_log (confirmed)
- [ ] Categories seeded with 5 system defaults
