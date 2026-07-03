# Sprint 2.1 — Contacts Table View
# Thinking: MEDIUM — Data table UX, server-side pagination, filter logic

## What to Build
The main Contacts page: a data table with search, category filter, state filter, pagination, and a "New Contact" button.

## Specifications

### Route: `/contacts`

### Data Fetching
- **Server-side paginated:** Pass `page` and `pageSize` as URL search params
- Fetch from `contacts` table joined with `categories(label, color_hex)` and `profiles!assigned_agent_id(full_name)`
- Default sort: `created_at DESC`
- Page size: 25

### Table Columns (ordered)
| Column | Source | Notes |
|---|---|---|
| Name | contacts.name | Bold text, clickable → `/contacts/[id]` |
| Phone | contacts.phone | Monospace font |
| Status | contacts.call_status | Colored badge |
| Category | categories.label | Badge with category color_hex |
| Language | contacts.language | Plain text |
| State | contacts.state | Plain text, "—" if null |
| Assigned To | profiles.full_name | Only visible to admin |
| Last Contacted | contacts.last_contacted_at | Relative time ("3 days ago"), "—" if null |
| Next Follow-up | contacts.next_followup_at | Date, highlight in gold if today, red if overdue |

### Filters Bar (above table)
- **Search input:** Searches `name`, `phone`, `email` — use `ilike` on server
- **Category dropdown:** Options from `categories` table + "All"
- **State dropdown:** `SELECT DISTINCT state FROM contacts WHERE state IS NOT NULL` + "All"
- **Call Status dropdown:** "All", "New", "Active", "Follow Up", "Not Interested", "Converted", "Completed"
- Filters update URL search params (enables back/forward navigation)

### Actions
- **"+ New Contact" button** (top right) → opens `/contacts/new` (built in Sprint 2.2)
- Row click → navigates to `/contacts/[id]` (built in Sprint 2.2)

### Empty State
If no contacts: show centered illustration-free card with text:
"No contacts yet. Click '+ New Contact' to add your first contact."

### Pagination
- Show "Showing X–Y of Z" below table
- Prev / Next buttons, disabled at boundaries
- Jump to page input if > 5 pages

### Styling
- Table: bg-surface, sticky header row
- Hover rows: bg-hover transition 150ms
- Status badges use semantic colors: New=info, Active=success, Follow Up=warning, Not Interested=danger, Converted=purple (#a78bfa), Completed=text-secondary
- Gold focus ring on search input
- Responsive: on mobile (<768px), hide Language, State, Assigned To columns

### Global Phone Lookup Bar (in TopBar — visible on ALL pages)
This is the most critical UX feature for a call center. When a call comes in, the agent needs to find the caller in <2 seconds.

**Component: `src/components/layout/TopBar.tsx`**
- Add a search input in the top bar, always visible (not hidden behind a button)
- Placeholder: "Search by phone or name..." with a Search icon
- On type (debounced 300ms):
  - Query `contacts` where `phone ilike '%${input}%' OR name ilike '%${input}%'`
  - Show results in a dropdown overlay (like a Command palette / shadcn Command component)
  - Each result shows: Name, Phone, Status badge
  - Click result → navigate to `/contacts/[id]`
  - `Escape` closes the dropdown
- This component is in the layout, so it works from ANY page
- RLS automatically scopes results (agent only sees their contacts)

### Bulk Actions
When one or more rows are selected via checkboxes:

**Selection UI:**
- Add a checkbox column as the first column in the table
- "Select All" checkbox in header selects all visible rows (not all pages)
- Selected row count shown: "X selected"

**Floating Action Bar** (appears at bottom of screen when items selected):
- **Change Status** → dropdown with status options → updates all selected contacts
- **Assign To** (admin only) → dropdown of agents → reassigns all selected
- **Export Selected** → downloads CSV of selected rows
- **Deselect All** → clears selection

Implementation: maintain `selectedIds: Set<string>` in component state. On bulk action, call `supabase.from('contacts').update({...}).in('id', [...selectedIds])`.

### CSV Export
- **"Export" button** next to "+ New Contact" button
- Exports ALL contacts matching current filters (not just current page)
- Query: use same filters as current URL params but without pagination (`range` removed)
- Generate CSV with columns: Name, Phone, Email, Status, Category, Language, State, City, Source, Last Contacted, Next Follow-up, Notes
- Download as `contacts_export_YYYY-MM-DD.csv`
- Use Blob + URL.createObjectURL for client-side download

## Definition of Done
- [ ] Table displays paginated contacts with all columns
- [ ] Search filters contacts by name/phone/email
- [ ] Category, State, Call Status dropdowns filter correctly
- [ ] Filters persist in URL (shareable/refreshable)
- [ ] Empty state shows when no contacts
- [ ] Agent only sees their assigned contacts (RLS)
- [ ] Admin sees all contacts with "Assigned To" column
- [ ] Mobile responsive — no horizontal scroll
- [ ] **Global phone lookup bar in TopBar works from any page**
- [ ] **Bulk select + change status works**
- [ ] **Bulk assign (admin) works**
- [ ] **CSV export downloads correctly with current filters**

