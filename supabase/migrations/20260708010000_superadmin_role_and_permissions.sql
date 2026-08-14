-- =============================================================================
-- Migration: 3-Tier Role Hierarchy & Superadmin Privileges
-- Migration ID: 20260708010000_superadmin_role_and_permissions.sql
-- =============================================================================

-- 1. Update profiles table CHECK constraint to include 'superadmin'
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('superadmin', 'admin', 'agent'));

-- 2. Update is_admin() helper to include both 'admin' and 'superadmin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create is_superadmin() helper
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update check_profile_update trigger function to enforce superadmin authority for admin roles
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If coming from authenticated user session
  IF auth.uid() IS NOT NULL AND OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only superadmins can assign or modify admin / superadmin roles
    IF (OLD.role IN ('admin', 'superadmin') OR NEW.role IN ('admin', 'superadmin')) THEN
      IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Only Super Administrators can assign or modify administrator roles.';
      END IF;
    END IF;

    -- Standard admins can only manage agents
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Administrator privileges required to change user roles.';
    END IF;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Update RLS on contacts table: Only Superadmin can DELETE contacts
DROP POLICY IF EXISTS "admin_all_contacts" ON public.contacts;

-- Admins and Superadmins have full read/write access
CREATE POLICY "admin_select_contacts" ON public.contacts
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admin_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_contacts" ON public.contacts
  FOR UPDATE USING (public.is_admin());

-- Only Superadmins can permanently DELETE contacts
CREATE POLICY "superadmin_delete_contacts" ON public.contacts
  FOR DELETE USING (public.is_superadmin());

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
