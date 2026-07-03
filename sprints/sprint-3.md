# Sprint 3.1 — Call Logging Modal
# Thinking: LOW — Simple modal form, one insert + one update

## What to Build
A "Log Call" modal that opens from the contact detail page or contacts table. Records a call and updates contact status.

## Component: `CallLogModal.tsx`

### Trigger
- Button on contact detail page (`/contacts/[id]`)
- Inline action button in contacts table row (phone icon)
- Opens a shadcn Dialog/Sheet

### Form Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Duration (min) | Number input | No | In minutes, stored as seconds (multiply by 60) |
| Outcome | Dropdown | YES | Options: "Connected", "Voicemail", "No Answer", "Wrong Number", "Busy", "Disconnected" |
| Notes | Textarea | No | Placeholder: "What was discussed?" |
| Next Action | Dropdown | No | Options: "None", "Follow Up", "Send WhatsApp", "Add to Prayer", "Refer to Leader" |
| Follow-up Date | Date picker | Conditional | Show only if next_action = "Follow Up". Required in that case. |
| Update Status To | Dropdown | No | Options match call_status enum. Pre-fill with current status. |

### On Submit (Two-Step Flow)
1. Insert into `calls` table: `{ contact_id, agent_id: current_user, duration_seconds, outcome, notes, next_action }`
2. Update `contacts` table: `{ last_contacted_at: now(), call_status: selectedStatus }`
3. If follow-up date set → insert into `followups` table: `{ contact_id, agent_id, due_at: selectedDate, notes }`
4. **DO NOT auto-close the modal.** Instead, show a success state inside the modal:
   - Green checkmark + "Call logged successfully"
   - Button 1: "Done" (closes modal, refreshes contact detail)
   - Button 2: "Next Contact" (fetches the next contact assigned to agent with status 'New', or oldest pending follow-up, and navigates to their detail page)
5. Show success toast: "Call logged"

### Styling
- Modal width: 500px max
- Gold submit button
- Smooth open/close animation (shadcn Dialog defaults)

## Definition of Done
- [ ] Modal opens from contact detail and table row
- [ ] Call record inserted into `calls` table
- [ ] Contact `last_contacted_at` and `call_status` updated
- [ ] Follow-up created when "Follow Up" next action selected
- [ ] Timeline on contact detail shows the new call entry
- [ ] Toast confirmation on success
- [ ] **Modal does not auto-close on submit; shows success state instead**
- [ ] **"Next Contact" button works and routes to another contact**

---

# Sprint 3.2 — Follow-up Queue
# Thinking: MEDIUM — Date logic, sorting, grouped views

## What to Build
A dedicated "Follow-ups" page showing all pending follow-ups for the agent (or all, for admin), grouped by urgency.

## Route: `/followups` (add to sidebar nav with Clock icon)

### Data Structure
Query `followups` table:
- Join with `contacts(name, phone, call_status)` and `profiles(full_name)`
- Filter: `status = 'pending'`
- Sort: `due_at ASC`

### Grouped Display
Show 3 sections (collapsible):

1. **🔴 Overdue** — `due_at < today` → Red left border
2. **🟡 Due Today** — `due_at = today` → Gold left border  
3. **🔵 Upcoming** — `due_at > today` → Blue left border

Each followup card shows:
- Contact name (clickable → `/contacts/[id]`)
- Phone number
- Due date (relative: "2 days ago", "today", "in 3 days")
- Notes (truncated to 2 lines)
- Actions: "Mark Done" button, "Call Now" (tel: link), "Reschedule" (date picker popover)

### Actions
- **Mark Done:** Update followup `status = 'done'`. Remove from list with fade animation.
- **Reschedule:** Update `due_at` to new date. Move card to correct section.
- **Call Now:** Opens tel: link. After returning, prompt with "Log this call?" → opens CallLogModal.

### Auto-mark Missed
- A nightly cron isn't feasible on free tier, so on page load:
  - Query followups where `due_at < today - 3 days AND status = 'pending'`
  - Auto-update to `status = 'missed'`

### Header Stats
- Show 3 stat cards at top: "X Overdue", "Y Today", "Z Upcoming" with matching colors

### Styling
- Cards in a single-column list (not grid — easier to scan)
- Cards: bg-surface, left colored border, hover lift
- Empty state: "🎉 All caught up! No pending follow-ups."

## Definition of Done
- [ ] Follow-ups page shows grouped list
- [ ] Overdue, Today, Upcoming sections with correct grouping
- [ ] Mark Done removes from list
- [ ] Reschedule updates date and re-sorts
- [ ] Agent sees only their followups (RLS)
- [ ] Admin sees all followups with agent name
- [ ] Stat cards show accurate counts
