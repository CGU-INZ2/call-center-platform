# Sprint 3 — Call Logging Modal + Follow-up Queue

**Model:** Gemini 2.5 Flash — Medium Thinking  
**Complexity:** LOW (3.1) + MEDIUM (3.2)  
**Goal:** Enable agents to log calls from the contact detail page and table, create follow-ups, and manage them in a dedicated queue page.

---

## ⚠️ Critical Context Before You Write Any Code

### 1. DB Tables Are Already in Production
Do NOT create new migrations for `calls` or `followups`. Both tables exist in `supabase/migrations/20260703010000_full_schema_rls_hardening.sql`.

**`calls` table columns (exact names — use these):**
```
id, contact_id, agent_id, started_at, duration_secs, outcome, notes, next_action, recording_url, created_at
```

**`followups` table columns (exact names):**
```
id, contact_id, agent_id, due_at, status (pending/done/missed), notes, created_at, updated_at
```

### 2. Outcome Enum Mismatch — Use This Mapping
The DB `outcome` CHECK constraint uses these values (not the sprint spec labels):

| UI Label (show to user) | DB Value (insert to DB) |
|-------------------------|--------------------------|
| Connected | `answered` |
| Voicemail | `no_answer` |
| No Answer | `no_answer` |
| Wrong Number | `other` |
| Busy | `busy` |
| Disconnected | `other` |
| Prayer Request | `prayer_request` |
| Not Interested | `not_interested` |
| Callback Requested | `callback_requested` |

Use a `const OUTCOME_OPTIONS` array of `{ label, value }` objects. Always insert the `.value` field.

### 3. The "Log Call" Button Already Exists — It's Disabled
In `src/app/(dashboard)/contacts/[id]/page.tsx` at **lines 253–261**, there is already a disabled `<Button>` with a `Log Call` label and `PhoneCall` icon. You are **enabling** this button, not adding a new one.

The page is a **Server Component** — you cannot add `onClick` directly. You must convert the Quick Actions Bar section into a small `'use client'` component, OR pass contact data as props to `CallLogModal` which handles its own open state.

**Recommended approach:** Keep the page as a Server Component. Import `CallLogModal` as a client component that accepts `contactId`, `contactName`, and `currentStatus` props. The modal manages its own `open` state internally.

### 4. The `calls` table uses `duration_secs` not `duration_seconds`
The contact detail page `InteractionTimeline` already queries `duration_seconds` — that's a mismatch in existing code. In `CallLogModal`, insert to `duration_secs`. Don't touch the timeline query.

---

## Proposed Changes

---

### Sprint 3.1 — Call Logging Modal

#### [NEW] `src/components/shared/CallLogModal.tsx`

**This is the main deliverable. A `'use client'` component.**

```typescript
// Props
interface CallLogModalProps {
  contactId: string
  contactName: string
  currentStatus: string | null
  externalOpen?: boolean    // optional — for table row trigger
  onClose?: () => void      // optional — for table row trigger
}
```

**State:**
- `open: boolean` — dialog open/close
- `isSubmitting: boolean`
- `isSuccess: boolean` — show success state instead of form
- Form fields: `duration`, `outcome`, `notes`, `nextAction`, `followUpDate`, `newStatus`

**Form Fields (in order):**

| Field | Component | Notes |
|-------|-----------|-------|
| Outcome | shadcn `Select` | Required. Use `OUTCOME_OPTIONS` array |
| Duration (min) | `<input type="number">` min=0 | Optional. Multiply × 60 before insert |
| Notes | `<textarea>` | Placeholder: "What was discussed?" |
| Next Action | shadcn `Select` | Options: None, Follow Up, Send WhatsApp, Add to Prayer, Refer to Leader |
| Follow-up Date | `<input type="date">` | Only shown when next_action = "Follow Up". Required in that case. |
| Update Status To | shadcn `Select` | Pre-filled with `currentStatus`. Options: New, Attempted, Connected, Follow-up Required, Not Interested |

**On Submit (execute in this exact order):**

```typescript
// Step 1: Insert call record
await supabase.from('calls').insert({
  contact_id: contactId,
  agent_id: currentUser.id,
  duration_secs: duration ? duration * 60 : null,
  outcome: selectedOutcomeValue,  // DB value, not label
  notes: notes || null,
  next_action: nextAction !== 'None' ? nextAction : null,
})

// Step 2: Update contact's last_contacted_at and call_status
await supabase.from('contacts').update({
  last_contacted_at: new Date().toISOString(),
  call_status: newStatus,
}).eq('id', contactId)

// Step 3: If next_action = "Follow Up" AND followUpDate is set
await supabase.from('followups').insert({
  contact_id: contactId,
  agent_id: currentUser.id,
  due_at: new Date(followUpDate).toISOString(),
  notes: notes || null,
  status: 'pending',
})
```

**On Success (DO NOT auto-close):**
- Set `isSuccess = true`
- Show green checkmark + "Call logged successfully"
- Button 1: **"Done"** → closes modal, calls `router.refresh()` to reload page data
- Button 2: **"Next Contact"** → query `contacts` table for next contact with `call_status = 'New'` assigned to current agent (oldest `created_at`). Navigate to `/contacts/[nextId]`.
- Show `toast.success("Call logged")` on success state entry

**Trigger (how to open):**
The modal renders a gold `<Button>` with `PhoneCall` icon as its trigger (for detail page use). When `externalOpen` prop is provided, the modal is controlled externally (for table row use).

**Styling:**
- shadcn `Dialog` with max-w-[500px]
- Gold submit button: `bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)]`
- Dark inputs: `bg-[var(--bg-root)] border-[var(--border-default)]`
- Success state: green checkmark icon, `text-[var(--success)]`

---

#### [MODIFY] `src/app/(dashboard)/contacts/[id]/page.tsx`

**Lines 253–261: Replace the disabled Log Call button with `<CallLogModal>`**

```diff
- {/* Log Call (placeholder for Sprint 3.1) */}
- <Button
-   disabled
-   className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] ..."
- >
-   <PhoneCall className="h-4 w-4" />
-   Log Call
- </Button>
+ <CallLogModal
+   contactId={id}
+   contactName={contact.full_name}
+   currentStatus={contact.call_status}
+ />
```

Add to imports: `import CallLogModal from '@/components/shared/CallLogModal'`  
Remove `PhoneCall` from the lucide-react import block (it moves into `CallLogModal`).

---

#### [MODIFY] `src/app/(dashboard)/contacts/ContactsClient.tsx`

Add a `PhoneCall` icon button to each row's action column. Use a single modal instance at the component level controlled by state.

```typescript
const [logCallContact, setLogCallContact] = useState<{
  id: string; name: string; status: string | null
} | null>(null)

// In table row actions, add:
<button
  onClick={() => setLogCallContact({ id: c.id, name: c.full_name, status: c.call_status })}
  className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--gold-400)] transition-colors"
  title="Log Call"
>
  <PhoneCall className="h-4 w-4" />
</button>

// At bottom of return JSX, before closing tag:
{logCallContact && (
  <CallLogModal
    contactId={logCallContact.id}
    contactName={logCallContact.name}
    currentStatus={logCallContact.status}
    externalOpen={true}
    onClose={() => setLogCallContact(null)}
  />
)}
```

---

### Sprint 3.2 — Follow-up Queue

#### [NEW] `src/app/(dashboard)/followups/page.tsx`

Server Component. Fetches all pending followups (RLS scopes to agent automatically).

```typescript
const { data: followups } = await supabase
  .from('followups')
  .select(`
    id, due_at, status, notes, created_at,
    contact:contacts(id, full_name, phone, call_status),
    agent:profiles!followups_agent_id_fkey(full_name)
  `)
  .eq('status', 'pending')
  .order('due_at', { ascending: true })
```

Pass to `<FollowupsClient followups={followups} userRole={profile.role} />`

---

#### [NEW] `src/app/(dashboard)/followups/FollowupsClient.tsx`

`'use client'` component managing local state and mutations.

**Grouping Logic:**
```typescript
const today = new Date(); today.setHours(0,0,0,0)
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

const overdue  = followups.filter(f => new Date(f.due_at) < today)
const dueToday = followups.filter(f => {
  const d = new Date(f.due_at); d.setHours(0,0,0,0)
  return d.getTime() === today.getTime()
})
const upcoming = followups.filter(f => new Date(f.due_at) >= tomorrow)
```

**On mount — auto-mark missed (3+ days overdue):**
```typescript
useEffect(() => {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3)
  const toMiss = followups.filter(f => new Date(f.due_at) < cutoff && f.status === 'pending')
  if (toMiss.length > 0) {
    supabase.from('followups').update({ status: 'missed' }).in('id', toMiss.map(f => f.id))
    // Remove from local state
    setItems(prev => prev.filter(f => !toMiss.find(m => m.id === f.id)))
  }
}, [])
```

**Mark Done:**
```typescript
await supabase.from('followups').update({ status: 'done' }).eq('id', id)
setItems(prev => prev.filter(f => f.id !== id))  // fade out card
```

**Reschedule:**
```typescript
await supabase.from('followups').update({ due_at: newDate, updated_at: new Date().toISOString() }).eq('id', id)
// Update local state and re-sort
```

**Stats header — 3 cards:**
- "X Overdue" — red (`var(--danger)`)
- "Y Due Today" — gold (`var(--gold-400)`)
- "Z Upcoming" — blue (`var(--info)`)

**Each follow-up card:**
- Left border 3px colored (red/gold/blue)
- Contact name → link to `/contacts/[id]`
- Phone number (small, secondary)
- Agent name (only shown if admin role)
- Due date: relative format ("2 days ago", "Today", "In 3 days")
- Notes: max 2 lines (`line-clamp-2 text-sm text-[var(--text-secondary)]`)
- Action row: "Mark Done" | "Reschedule" | "Call Now" (tel: link)

**Empty state:**
```jsx
<div className="text-center py-16">
  <span className="text-4xl">🎉</span>
  <p className="mt-3 text-[var(--text-secondary)]">All caught up! No pending follow-ups.</p>
</div>
```

---

#### [MODIFY] `src/components/layout/Sidebar.tsx`

Add Follow-ups link. Position it after Contacts in the nav list.

```typescript
import { Clock } from 'lucide-react'

// Add to nav items:
{ href: '/followups', label: 'Follow-ups', icon: Clock }
```

---

## No DB Migration Required

Both tables (`calls`, `followups`) and `contacts.call_status` already exist in production.

---

## Definition of Done

### Sprint 3.1
- [ ] `CallLogModal.tsx` in `src/components/shared/`
- [ ] Modal opens from contact detail page (previously disabled button now works)
- [ ] Modal opens from contacts table (PhoneCall icon per row)
- [ ] Outcome dropdown maps UI labels → correct DB values
- [ ] Duration: user enters minutes, stored as seconds (`duration_secs`)
- [ ] Follow-up date field only appears when "Follow Up" selected
- [ ] 3-step DB flow: call insert → contact update → optional followup insert
- [ ] Modal does NOT auto-close — shows success state
- [ ] "Done" closes modal + refreshes data
- [ ] "Next Contact" navigates to next `call_status = 'New'` contact for this agent
- [ ] `toast.success("Call logged")` fires
- [ ] New call visible in InteractionTimeline after refresh

### Sprint 3.2
- [ ] `/followups` route loads for agents and admins
- [ ] "Follow-ups" with Clock icon in Sidebar
- [ ] 3 sections with correct grouping (Overdue/Today/Upcoming)
- [ ] Stat header cards show accurate counts
- [ ] Mark Done removes card with animation
- [ ] Reschedule updates date and re-sorts card
- [ ] 3+ day overdue auto-marks as missed on load
- [ ] Agents see only their followups (RLS)
- [ ] Admins see all followups with agent name
- [ ] Empty state shown when no pending followups
- [ ] Cards link correctly to `/contacts/[id]`
