# Sprint 5.1 — WhatsApp Deep Links + Message Log
# Thinking: LOW — Simple wa.me links, template selector, log insert

## What to Build
A "Send WhatsApp" action on contact detail that opens wa.me with pre-filled text, then logs the message.

## Components

### WhatsAppButton on Contact Detail
- Show on Quick Actions bar (contact detail page)
- On click:
  1. Open a modal with template selector
  2. User picks a template or writes custom text
  3. Preview shows the final message
  4. "Open WhatsApp" button: `window.open(\`https://wa.me/${phone}?text=${encodeURIComponent(message)}\`, '_blank')`
  5. After opening, show "Did you send this message?" confirmation
  6. On "Yes" → insert into `whatsapp_messages` table: `{ contact_id, agent_id, template_used, body, marked_sent_at: now() }`
  7. Show toast: "Message logged"

### WhatsApp Templates (Settings page)
- Admin can create reusable text templates
- Store in a `whatsapp_templates` table (add this table):
```sql
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_templates" ON public.whatsapp_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_templates" ON public.whatsapp_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```
- Template body supports `{name}` placeholder → replaced with contact.name
- Seed 2 default templates:
  1. "Greeting": "Hello {name}, greetings from the ministry! How are you doing today?"
  2. "Prayer Follow-up": "Hi {name}, we wanted to follow up on your prayer request. How can we continue to support you?"

### Template Manager UI (`/settings/templates`)
- Admin only
- List of templates with name, preview of body (truncated)
- Add/Edit/Delete actions
- Simple form: name + body textarea

## Definition of Done
- [ ] WhatsApp button opens modal with template selector
- [ ] Template placeholders (like {name}) replaced before preview
- [ ] wa.me link opens correctly with encoded message
- [ ] Confirmation logs message to whatsapp_messages table
- [ ] Admin can manage templates from Settings
- [ ] Message appears in contact detail timeline

---

# Sprint 5.2 — Prayer Request Module
# Thinking: LOW — Simple form + list views

## What to Build
A prayer request form accessible from contact detail, and a dedicated prayer list page.

### Log Prayer Request (from Contact Detail)
- Button "Log Prayer/Testimony" on contact detail Quick Actions
- Opens modal with:
  - Type: "Prayer Request" or "Testimony" (radio)
  - Content: Textarea (required)
- Inserts into `prayer_requests` table
- Shows in contact timeline

### Prayer Requests Page (`/prayers`)
- Add to sidebar nav with Heart icon
- Table view showing all prayer requests
- Columns: Contact Name, Type (badge: prayer=blue, testimony=gold), Content (truncated), Date, Agent
- Filter by type dropdown
- Click row → navigate to contact detail
- Add "Print" button that opens a clean, printer-friendly view of the current prayer list
- RLS: agent sees own, admin sees all

## Definition of Done
- [ ] Prayer request can be logged from contact detail
- [ ] Appears in contact timeline
- [ ] Prayer list page shows all requests with filters
- [ ] Print button opens a printer-friendly layout for group prayer sessions
- [ ] RLS scoping works correctly

---

# Sprint 7.1 — Hardening & Security
# Thinking: HIGH — Input sanitization, error boundaries, auth edge cases

## What to Build
Security hardening pass across the entire app.

### Checklist
1. **Input Sanitization:** Review ALL form fields. Ensure no raw HTML is rendered. Use `DOMPurify` or equivalent for any user content displayed in HTML context.
2. **SQL Injection:** Supabase client uses parameterized queries by default — verify no raw SQL string interpolation.
3. **Rate Limiting:** Add rate limiting to `/api/admin/create-user` route (max 10/min).
4. **Error Boundaries:** Add React ErrorBoundary component wrapping each page's content area. Show friendly "Something went wrong" card with "Reload" button.
5. **Auth Token Refresh:** Ensure Supabase auto-refreshes tokens. Add `onAuthStateChange` listener in root layout to handle expired sessions gracefully (redirect to login, not crash).
6. **Service Role Key Audit:** Grep entire codebase for `SUPABASE_SERVICE_ROLE_KEY` — must ONLY appear in server-side API routes, never in client components.
7. **CORS / Headers:** Set security headers in `next.config.js`:
   ```javascript
   headers: [
     { key: 'X-Frame-Options', value: 'DENY' },
     { key: 'X-Content-Type-Options', value: 'nosniff' },
     { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
   ]
   ```
8. **Env Var Check:** On app startup (root layout), verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Log warning if missing.
9. **Keyboard Shortcuts:** Add global hotkeys: `/` (Focus search bar), `Esc` (Close modals), `N` (New contact), `L` (Log call from detail page).
10. **Session Timeout:** Add auto-logout after 30 minutes of inactivity to protect unattended devices.
11. **RLS Re-test:** Re-run the full RLS test protocol from Sprint 1.2 after all features are built.

## Definition of Done
- [ ] All 9 checklist items verified
- [ ] No console errors or warnings in production build
- [ ] Service role key only in server-side code
- [ ] Error boundaries catch component crashes gracefully
- [ ] Keyboard shortcuts work
- [ ] Session timeout auto-logout works
- [ ] RLS re-test passes

---

# Sprint 7.2 — Launch Prep
# Thinking: LOW — Seed data, Vercel env vars, documentation

## What to Build
Final deployment and launch checklist.

### Checklist
1. **Seed Data:**
   - Create admin account in Supabase Auth dashboard
   - Update profile role to 'admin' via SQL
   - Create 2 test agent accounts via the admin UI
   - Import a small CSV (10 rows) to verify import pipeline end-to-end
   - Create 2 WhatsApp templates
2. **Vercel Production Deploy:**
   - Set all env vars in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Run `vercel --prod`
   - Test login on production URL
3. **Production Smoke Test:**
   - [ ] Login as admin ✓
   - [ ] Create an agent ✓
   - [ ] Login as agent ✓
   - [ ] Create a contact ✓
   - [ ] Log a call ✓
   - [ ] Create a follow-up ✓
   - [ ] Send WhatsApp (via link) ✓
   - [ ] Log a prayer request ✓
   - [ ] View dashboards ✓
   - [ ] CSV import (10 rows) ✓
   - [ ] Agent cannot see other agent's data ✓
4. **README.md:**
   - Project overview
   - Setup instructions (env vars, Supabase project)
   - Folder structure
   - Development commands
   - Deployment instructions

## Definition of Done
- [ ] All smoke tests pass on production
- [ ] README written
- [ ] Production URL shared with user
- [ ] No console errors on production
