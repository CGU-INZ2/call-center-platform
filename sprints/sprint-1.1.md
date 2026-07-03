# Sprint 1.1 — Auth, Profiles & Agent Invite Flow
# Thinking: MEDIUM — Supabase auth wiring, trigger functions, role logic

## What to Build
Supabase Auth with email/password login, a `profiles` table that auto-populates on signup, and an admin-only screen to create agent accounts.

## Database (run in Supabase SQL Editor)

### Create profiles table
```sql
-- Profiles extends auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins see all profiles
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users see own profile
CREATE POLICY "user_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Users update own profile (not role)
CREATE POLICY "user_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin updates any profile
CREATE POLICY "admin_update_all_profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### Create audit_log table
```sql
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins read audit log
CREATE POLICY "admin_read_audit_log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Authenticated users can insert (system writes)
CREATE POLICY "authenticated_insert_audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

## App Code

### Login Page (`src/app/(auth)/login/page.tsx`)
- Email + password form using shadcn Input, Label, Button
- Call `supabase.auth.signInWithPassword()`
- On success → redirect to `/` (dashboard)
- On error → show toast with error message
- Minimal layout: centered card on bg-root, gold accent on submit button
- No signup link (admin creates accounts)

### Auth Middleware (`src/middleware.ts`)
- Check for Supabase session on every request
- If no session + path is not `/login` → redirect to `/login`
- If session + path is `/login` → redirect to `/`
- Use `@supabase/ssr` `createServerClient` in middleware

### Dashboard Layout Auth Check (`src/app/(dashboard)/layout.tsx`)
- Fetch user profile on load via server component
- Store role in a React context (`UserContext`) with `{id, role, full_name}`
- Pass context to sidebar (admin sees "Manage Users" nav item, agent doesn't)

### Admin: Create Agent Page (`src/app/(dashboard)/settings/users/page.tsx`)
- Only accessible if `role === 'admin'` (redirect otherwise)
- Form: full_name, email, temporary password
- On submit: call Supabase `auth.admin.createUser()` — **IMPORTANT:** This requires the service_role key, which must NOT be exposed client-side
- **Solution:** Create a Next.js API route `/api/admin/create-user` that:
  1. Verifies the caller is admin (check their JWT)
  2. Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only env var) to call `supabase.auth.admin.createUser({ email, password, user_metadata: { full_name, role: 'agent' } })`
  3. Writes to audit_log: `{ action: 'user_created', entity_type: 'profile', after_data: { email, full_name, role: 'agent' } }`
- Show list of existing agents below the form (from `profiles` table)
- Each agent row shows: name, email, active status, created_at

### New Env Var
Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard, Settings > API>
```
Add to `.env.example`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
**NEVER prefix with NEXT_PUBLIC_**

## Seed Data
After deploying, manually create the first admin account:
1. Go to Supabase Dashboard > Authentication > Users > Add User
2. Create user with email + password
3. In SQL Editor, update their role: `UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';`

## Definition of Done
- [ ] Admin can log in and see dashboard with sidebar
- [ ] Admin can create an agent account from Settings > Users
- [ ] Agent can log in and see dashboard (without Settings > Users)
- [ ] Logout works and redirects to login
- [ ] Unauthenticated users are redirected to login
- [ ] audit_log has a row for the agent creation
- [ ] Service role key is server-side only, not exposed in client bundle
