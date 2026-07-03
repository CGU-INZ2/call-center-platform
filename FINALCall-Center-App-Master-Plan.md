# Ministry Call Center Platform — Master Build Plan
**Prepared for:** Josh / Vibeforge
**Purpose:** Execution blueprint to hand to Antigravity, phase by phase, under your TRA (Test–Recheck–Approve) protocol.

---

## Confirmed Decisions Log

| Decision | Answer |
|---|---|
| Telephony/recording | Manual call logging at launch. VoIP (Exotel/Knowlarity) deferred, budget-gated, Phase 6 |
| WhatsApp | `wa.me` deep link, one shared ministry number. No BSP, no template approval, no vendor cost |
| Contact data at launch | Migrating an existing spreadsheet |
| Agent seats at launch | 1–3 agents |
| Geo heatmap scope | India (state → district/city drill-down). Other countries: simple summary table, not mapped, not a priority |
| Heatmap metric | Toggle between volume and conversion rate |
| Heatmap time filter | All-time default, filterable by month/quarter |
| Heatmap access | Admin sees all-agent combined map; Agents see a scoped mini-map of their own contacts only |
| Spreadsheet geo data quality | Partial — some rows have state/city, many don't |

---

## 0. Senior Dev Notes Before We Start (read this first)

A few calls I'm making that diverge from your original brief, and why:

1. **Drop Prisma + NextAuth. Use Supabase end-to-end.**
   You're already running Supabase on Artspace246. Splitting your stack across two Postgres providers (Prisma/NextAuth needs its own DB, Supabase is another) is unnecessary complexity for a solo-maintained system. Supabase gives you Postgres + Auth + Storage + Row-Level Security (RLS) in one place. RLS is actually a *better* fit for your Admin/Agent access model than app-layer role checks — the database itself enforces "agents only see their own contacts," so there's no code path that can accidentally leak data. That's the "doing it properly" answer here, not a bulk query with a `WHERE agent_id = ?` you have to remember to add everywhere.

2. **Reality check on "click-to-call + recording."**
   A browser cannot record a real phone call made from an agent's personal phone — that's not a Next.js limitation, it's a physics/telecom one. To get true click-to-call *and* recording, you need a VoIP/telephony provider in the loop (e.g. **Exotel** or **Knowlarity** — both India-focused, DLT/KYC-compliant, click-to-call + auto-recording + call logs via API). This costs real money per minute and requires business KYC, similar to what you're doing for Razorpay.
   **Recommendation:** Ship the MVP with **manual call logging** (agent dials on their own phone, logs outcome in-app immediately after). Treat VoIP integration as a funded Phase 6, not a Phase 1 blocker. This is the single biggest scope/cost decision in this project — flag it to whoever owns budget before Antigravity writes a line of telephony code.

3. **WhatsApp — confirmed: `wa.me` deep link, not the official API.**
   Still avoid Baileys/Evolution API (unofficial, ban risk) — but for your scale (1–3 agents, one shared number), the official Cloud API's overhead (BSP signup, business verification, template pre-approval, per-message cost) isn't worth it. `wa.me/<number>?text=<prefilled message>` opens WhatsApp (app or web) with the message ready to send — agent hits send themselves. No API, no vendor, no cost. Trade-off you're accepting: no delivery/read status, no auto-logged inbound replies — agent manually marks a contact "message sent" in-app after sending. Revisit the official API only if volume or automation needs grow beyond what one shared number can handle.

4. **Auth:** Supabase Auth, email + password, with OTP/magic-link as an option — not Clerk. One less vendor, one less bill, same RLS integration.

5. **Audit trail (the thing you liked about "Add User Directly"):** build a single `audit_log` table from Sprint 1 that every mutating action writes to (status changes, contact reassignment, user creation, deletions). Retrofit this later is painful — bake it in now.

6. **Geo heatmap — state map is real, district map isn't (as a shape).** There's no reliable free GeoJSON covering India's districts accurately and consistently — boundaries shift, quality varies. Building a true district-shaped choropleth is a real risk of shipping something that looks broken. Instead: **state-level choropleth** (real map, `react-simple-maps` + a standard India-states GeoJSON) → click a state → **bar chart/list of that state's districts** (data-driven, not shape-driven). Same drill-down value, no boundary-data risk.

7. **Geo data is a launch dependency, not a nice-to-have.** Your spreadsheet only has partial state/city data. The heatmap is only as good as that data — so Phase 2 (contact import) needs a "geo status" flag (`mapped` / `unmapped`) and Phase 4 needs a quick bulk-tagging view for unmapped contacts, or the map will show a large, misleading "unknown" blob at launch.

---

## 1. Final Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Matches Artspace246, Antigravity is already tuned to this |
| Styling | Tailwind CSS + shadcn/ui | Fast to theme, consistent with your other builds |
| Animation | Framer Motion (light use — dashboards, transitions) | Consistency, not novelty |
| Database | Supabase Postgres | One vendor, RLS-native |
| Auth | Supabase Auth | Native RLS integration, no second vendor |
| File/Recording Storage | Supabase Storage | Same vendor, signed URLs for private recordings |
| Charts | Recharts | Lighter than Chart.js in React, better composability |
| Maps | `react-simple-maps` + India states TopoJSON (free) | State choropleth, no API cost, no vendor |
| WhatsApp | `wa.me` deep link, shared ministry number | No vendor, no cost, no approval wait — matches your scale |
| Telephony (Phase 6 only) | Exotel (India) — evaluate at that stage | Click-to-call + recording, but budget-gated |
| Hosting | Vercel | Same as Artspace246 |
| CSV import/export | `papaparse` + `xlsx` (client-side, no backend lib needed) | No server dependency |

---

## 2. Data Model (entity-level — schema code comes when we build, not in this plan)

- **profiles** — extends `auth.users`; role (`admin` / `agent`), name, phone, avatar, active flag
- **contacts** — name, phone, email, category_id, assigned_agent_id, source, country (default `India`), state, district_city, geo_status (`mapped` / `unmapped`), last_contacted_at, next_followup_at, notes, created_by, created_at
- **categories** — label, color_hex, is_system (seeded ones can't be deleted, only renamed), created_by
- **calls** — contact_id, agent_id, started_at, duration_seconds, outcome, notes, next_action, recording_url (nullable until Phase 6)
- **followups** — contact_id, agent_id, due_at, status (pending/done/missed), notes
- **whatsapp_messages** — contact_id, agent_id, template_used, body, marked_sent_at (manual — agent confirms after clicking the deep link)
- **prayer_requests** — contact_id, agent_id, type (prayer/testimony), content, created_at
- **audit_log** — actor_id, action, entity_type, entity_id, before (jsonb), after (jsonb), created_at

**RLS shape:** every table with `agent_id`/`assigned_agent_id` gets two policies — `role() = 'admin'` (full access) OR `assigned_agent_id = auth.uid()`. This is written once, then reused as a pattern (Postgres policy templates) — Antigravity can generate the rest by pattern-matching the first one.

---

## 3. Phase & Sprint Breakdown

Each **Sprint Session** is scoped to be one sitting with Antigravity — one clear TRA cycle (Test what it builds, Recheck against this spec, Approve or send back). Don't combine sessions; each should end in a working, demoable state.

### **PHASE 0 — Foundation (1 sprint)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 0.1 | Repo init, Next.js 15 + TS + Tailwind + shadcn scaffold, Supabase project provisioned, env vars, folder structure locked, deploy empty shell to Vercel | Blank app live on a Vercel URL, connected to Supabase, `.env.example` committed |

### **PHASE 1 — Auth, Roles & Data Backbone (2 sprints)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 1.1 | Supabase Auth wiring, login/logout, `profiles` table + trigger to auto-create profile on signup, Admin can create Agent accounts (invite flow, not self-signup) | Admin can log in, create an Agent, Agent can log in and see an empty dashboard shell |
| 1.2 | Full schema migration (all tables above), RLS policies written and **tested with two real test accounts** (one admin, one agent) to confirm data isolation, `audit_log` trigger scaffolding on contacts + calls tables | Agent account provably cannot query another agent's contacts via API, even directly |

### **PHASE 2 — Contact Management (3 sprints)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 2.1 | Contacts table UI (list view), server-side pagination/search/sort, category badges with color coding, quick status-change dropdown (writes to audit_log). Add persistent Phone Lookup Bar in TopBar. Add Bulk Actions (Status Change, Assign, CSV Export filtered contacts) | Agent sees only their contacts; Admin sees all with an agent filter |
| 2.2 | Add/Edit contact form (with Duplicate Phone Detection), contact detail page (calls history, notes, follow-up date), category management screen (Admin-only: add/edit/archive custom categories) | Full CRUD on contacts, custom categories persist and show correctly for all agents |
| 2.3 | CSV bulk upload (papaparse, with a preview/validation step before commit, duplicate-phone detection). Import maps your spreadsheet's existing state/city columns where present and auto-sets `geo_status = mapped`; rows missing that data import as `geo_status = unmapped` (not blocked — just flagged). CSV export of filtered views | Admin can upload the real spreadsheet and get a clear success/error report, with an accurate mapped/unmapped count, before anything writes to DB |

### **PHASE 3 — Call Logging (2 sprints)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 3.1 | "Log a Call" modal (manual entry: duration, outcome, notes, next action), tied to a contact, auto-updates `last_contacted_at` and prompts for `next_followup_at`. Add "Next Contact" flow to auto-open next assigned contact | Every logged call appears instantly in that contact's call history |
| 3.2 | Follow-up list/queue view ("My follow-ups today/this week/overdue"), calendar view (simple month grid, not a full calendar library unless needed) | Agent has a single screen showing what's due today, sorted by urgency |

### **PHASE 4 — Dashboards, Analytics & Geo Heatmap (4 sprints)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 4.1 | Agent dashboard: calls today, contacts by status (donut), personal conversion rate, upcoming follow-ups widget | Numbers match a manual DB count — verify, don't trust the chart |
| 4.2 | Admin dashboard: org-wide totals, calls per day/week (line chart), status funnel, top performers table, agent-filter toggle | Admin can drill from org view down to a single agent's numbers |
| 4.3 | **Geo heatmap core:** India state choropleth, toggle between volume and conversion-rate heat, click-state drill-down into a district/city bar chart, month/quarter + all-time filter. Admin view = all agents combined | Admin can select a state, toggle metrics, filter by quarter, and see an accurate district breakdown |
| 4.4 | **Geo heatmap — agent scope + data quality:** scoped mini-map on Agent dashboard (own contacts only), "Unmapped contacts" queue (bulk state/city tagging screen so the map doesn't launch with a big unknown blob), international contacts summary table (country, count, status breakdown — no map) | Agent sees only their own geo spread; Admin has a working queue to clear the unmapped backlog |

### **PHASE 5 — WhatsApp (1 sprint — no vendor, no approval wait)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 5.1 | "Send WhatsApp" button on contact page — opens `wa.me` deep link to the shared ministry number with a pre-filled template (e.g. Rhapsody request), agent taps send in WhatsApp itself, then hits "Mark as Sent" in-app which logs to `whatsapp_messages`. Simple message-history list per contact (log entries, not a live thread) | Agent can go from contact → prefilled WhatsApp message → logged send in under 10 seconds |
| 5.2 | Prayer Requests & Print View: Add a "Print" button on the prayer requests page that opens a clean, printer-friendly view for ministry leaders | Prayer request lists can be easily printed for group prayer sessions |

### **PHASE 6 — Telephony / Recording (Stretch — separate budget approval required)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 6.1 | Evaluate Exotel vs Knowlarity vs staying manual — cost per seat, KYC timeline, recording storage cost | A written go/no-go decision, not code |
| 6.2 | If greenlit: click-to-call button, webhook receiver for call events, recording auto-attached to call log, transcript (optional — Whisper API) | Only build this once 6.1 is resolved — don't let Antigravity start here speculatively |

### **PHASE 7 — Hardening & Launch (1–2 sprints)**
| Sprint | Scope | Definition of Done |
|---|---|---|
| 7.1 | Input sanitization pass, rate limiting on auth + bulk upload routes, RLS re-audit (attempt cross-agent access manually one more time), dark/light mode polish, mobile responsiveness pass on Contacts + Call Log + Dashboard. Add Keyboard Shortcuts (`/`, `Esc`, `N`, `L`) and 30-min Session Timeout | A written security checklist, all items ticked, tested on an actual phone |
| 7.2 | Seed data cleanup, real Admin account handover, agent onboarding doc (one-pager, not a manual), production deploy | Ministry team can log in and use it without you in the room |

---

## 4. Suggested Sequencing / Timeline

Assuming solo-driven sprints (you + Antigravity), roughly 1 sprint per session, sessions 2–3x/week:

```
Week 1     Phase 0 + Phase 1 start
Week 2     Phase 1 finish + Phase 2 start (import your real spreadsheet here)
Week 3-4   Phase 2 finish
Week 5     Phase 3
Week 6-7   Phase 4 (dashboards + geo heatmap — the biggest phase now)
Week 8     Phase 5 (WhatsApp deep link — one sprint, no external wait)
Week 9     Phase 7 (hardening + launch)
—          Phase 6 only if/when budget clears
```

~9 weeks to a real launch, telephony excluded. Dropping the WhatsApp BSP wait actually offset the extra heatmap work — timeline held at 9 weeks.

---

## 5. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Agents logging calls late/inaccurately (manual entry) | Bad data quality, skews analytics | Add a lightweight "log now" nudge/notification after X minutes of no activity post-dial (Phase 4 stretch) |
| RLS misconfiguration | Data leak between agents — serious for a ministry's contact data | Non-negotiable: every phase that touches a table gets a manual "log in as Agent B, try to see Agent A's data" test before Approve |
| Scope creep into VoIP too early | Budget/time overrun | Phase 6 explicitly gated — don't let a sprint "accidentally" start telephony work |
| CSV bulk upload garbage data | Corrupts contact base | Validation + preview step is mandatory, not optional, in 2.3 |
| Heatmap launches misleading (large "unmapped" blob) | Undermines trust in the headline feature | Sprint 4.4's unmapped-contacts queue must be cleared (or substantially cleared) before you demo the heatmap to leadership |
| WhatsApp deep link — no delivery/read tracking | Can't prove a message was actually sent/seen | Accepted trade-off for now; "Mark as Sent" is an honor-system log, not a guarantee — revisit official API if this becomes a real gap |
| Agent forgets to hit "Mark as Sent" | WhatsApp outreach undercounted in analytics | Consider a soft reminder — e.g. flag contacts with no WhatsApp log 24h after the button was clicked (Phase 5 stretch, not launch-blocking) |

---

## 6. Operating Notes

### To Antigravity (paste this at the start of every session)

1. **One sprint per session, no exceptions.** Don't start the next sprint's scope even if there's time left — end in a demoable state, stop, wait for Approve.
2. **RLS test is mandatory before any Approve on a sprint that touches data.** Log in as both a test Admin and a test Agent account and confirm the Agent cannot see/query the Admin's or another agent's rows — via the UI *and* a direct API call. Report the test result explicitly, don't just say "done."
3. **No new dependencies without flagging first.** Stack is locked (see Section 1). If a sprint seems to need something not listed there, stop and ask before installing.
4. **No schema changes beyond what's in Section 2** without flagging first — including column renames or type changes.
5. **Phase 6 (telephony) is off-limits** unless explicitly told otherwise in a session prompt. Don't scaffold it "in advance."
6. **Secrets never get hardcoded.** All keys/URLs via `.env.local`, referenced in `.env.example` with placeholder values only, committed clean.
7. **Every mutating action (status change, reassignment, delete, user creation) must write to `audit_log`.** If a new sprint adds a new mutation and forgets this, that's a bug, not a nice-to-have.
8. **Match the existing Vibeforge/Artspace246 visual language** — dark navy + gold accent as the default theme direction, unless a sprint says otherwise — don't default to generic shadcn styling.
9. **End each sprint with a one-paragraph summary**: what was built, what was tested, what's explicitly deferred/not-yet-done. This is what Josh reviews under TRA — make Recheck easy, not a guessing game.

### To You

1. **Don't rubber-stamp the RLS test claim.** Once a month (or after any auth-related sprint), log in yourself as a real Agent test account and try to see another agent's contact. Trust but verify — this is the one bug category that's genuinely dangerous for a ministry's contact data.
2. **Start cleaning the spreadsheet's state/city columns now, in parallel**, not during Sprint 2.3. The cleaner that data going in, the less time Sprint 4.4's unmapped-queue eats later.
3. **Lock the shared WhatsApp number before Phase 5.** Decide now whose number it is, who has access to it, and what happens if that person is unavailable — it's an org decision, not a dev one.
4. **Get one agent using the app for real by end of Phase 3**, not after Phase 7. Real usage surfaces workflow gaps ("this field isn't where I'd look for it") that no amount of your own review will catch, and it's cheap to fix early, expensive to fix at Week 9.
5. **Don't compress Phase 7.** Hardening is the phase most likely to get skipped under time pressure because it "doesn't add a visible feature" — it's also the one that matters most for a system holding people's contact and outreach data.
6. **Revisit the Phase 6 go/no-go explicitly**, not by default drift. Put a date on it (e.g. "reassess after Week 9 with real usage data") so it doesn't just quietly never happen or quietly get built without a real decision.
7. **Back up before big sprints.** Supabase point-in-time recovery on the paid tier, or a manual `pg_dump` before any migration-heavy sprint (2.3, 4.3/4.4) — cheap insurance.

---

## 7. Backlog (post-launch, not in initial build)

- Prayer request / testimony reporting view for pastoral follow-up
- International contacts get their own world map (currently a plain summary table)
- SMS fallback for contacts without WhatsApp
- Automated follow-up reminders (push/email)
- Multi-language templates (you've already done Marathi work for INZ2 — reusable here)
- Upgrade WhatsApp from deep link to official Cloud API if volume/automation needs grow
- Exotel/Knowlarity VoIP integration (Phase 6, budget-gated)

---

**All launch-blocking decisions are locked.** Nothing left in this plan needs your input to start building. Next step is Sprint 0.1 — repo init, Supabase provisioning, empty shell deployed to Vercel.
