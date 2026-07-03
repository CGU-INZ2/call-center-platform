# Sprint 2.2 — Contact Create/Edit + Detail Page
# Thinking: LOW-MEDIUM — Standard forms, validation, detail layout

## What to Build
- A form page for creating and editing contacts
- A detail page showing all contact info + interaction timeline

## Route: `/contacts/new` and `/contacts/[id]/edit`
Same form component, prefilled in edit mode.

### Form Fields (in order, grouped)

**Section 1: Personal Information**
| Field | Type | Required | Notes |
|---|---|---|---|
| Name | Text input | YES | |
| Phone | Text input | YES | Auto-format: strip spaces, ensure +91 prefix for 10-digit numbers |
| Email | Text input | No | Validate email format if provided |
| Language | Dropdown | No | Options: Hindi, English, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, Punjabi, Odia, Other |

**Section 2: Location**
| Field | Type | Required | Notes |
|---|---|---|---|
| Country | Dropdown | YES | Default "India", also offer "Other" with free text |
| State | Dropdown | No | List of Indian states + "Other" with free text |
| District/City | Text input | No | Free text |
| Full Address | Textarea | No | Raw/legacy, maps to `raw_address` |

**Section 3: Ministry Fields**
| Field | Type | Required | Notes |
|---|---|---|---|
| Watched Ministry Program | Checkbox | No | |
| Program Name | Text input | No | Show only if checkbox is checked |
| Want Prayer | Checkbox | No | |
| Prayer Day & Time | Text input | No | Show only if want_prayer is checked. Placeholder: "e.g. Saturday 10am" |
| Want ROR Daily | Checkbox | No | |

**Section 4: Cell Group**
| Field | Type | Required | Notes |
|---|---|---|---|
| Cell Group Name | Text input | No | |
| Cell Group Leader | Text input | No | |

**Section 5: Call Center Fields**
| Field | Type | Required | Notes |
|---|---|---|---|
| Category | Dropdown | No | From `categories` table |
| Call Status | Dropdown | YES | Default "New" |
| Assigned Agent | Dropdown | Admin only | From `profiles` where role=agent. Auto-set to current user if agent |
| Source | Dropdown | No | Options: Manual, CSV Import, Website, WhatsApp, Other |
| Notes | Textarea | No | |

### Behavior
- On create: POST to `contacts` table via Supabase client
- On edit: UPDATE the contact row
- Phone normalization: if user types `9876543210` → store as `+919876543210`
- After save: redirect to `/contacts/[id]`
- Show toast: "Contact saved successfully"
- On validation error: highlight field in red, show inline error below field

---

## Route: `/contacts/[id]` — Detail Page

### Layout: Two-column on desktop, single column on mobile

**Left Column (60%)**
1. **Header card:** Name (h2), phone (clickable tel: link), email, category badge, status badge
2. **Quick Actions bar:** 
   - "Call" button (tel: link)
   - "WhatsApp" button (wa.me link — Sprint 5.1)
   - "Edit" button → `/contacts/[id]/edit`
   - "Log Call" button → opens call log modal (Sprint 3.1)
3. **Interaction Timeline:** (below quick actions)
   - Ordered by date DESC
   - Merge calls, followups, whatsapp_messages, prayer_requests into single timeline
   - Each entry: icon (phone/message/prayer), timestamp, notes
   - Query all 4 tables where `contact_id = id`, union and sort by created_at
   - **If no interactions yet:** show "No interactions recorded yet."

**Right Column (40%)**
- **Contact Details card:** all fields in a definition-list layout (label: value pairs)
  - Location: state, city, raw_address
  - Ministry: program, prayer preferences, ROR
  - Cell Group: name, leader
  - Assigned Agent, Source, Created At, Last Contacted
- **Notes card:** display notes field in a read-only styled box

### Styling
- Header card: bg-surface, border-left with category color (4px)
- Timeline entries: vertical line connecting entries, dot indicators
- Gold "Log Call" button since it's the primary action
- **Phone number in header: large font (1.5rem), monospace, clickable `tel:` link** — this is the #1 piece of info during a call
- Responsive: stack columns on mobile

### Duplicate Detection (on Create)
When creating a new contact:
- After the user types a phone number and moves to the next field (on blur):
  - Query: `supabase.from('contacts').select('id, name, phone').eq('phone', normalizedPhone).limit(1)`
  - If a match is found, show a yellow warning banner below the phone field:
    - "⚠️ A contact with this phone already exists: **[Name]** ([Status]). [View existing →](/contacts/[id])"
  - Do NOT block submission — some duplicates are intentional (e.g., family members sharing a phone)
  - Just warn the user so they can make an informed choice

### Contact Detail Load Optimization
The detail page is where agents spend 90% of their time during a call. It must load in <1 second.
- Fetch contact data as a server component (no client-side loading spinner for primary data)
- Timeline entries can load client-side with a skeleton shimmer (secondary data)
- Use `Promise.all` to fetch calls, followups, whatsapp_messages, prayer_requests in parallel, not sequentially

## Definition of Done
- [ ] Can create a new contact with all fields
- [ ] Phone auto-normalizes to +91 format
- [ ] Can edit an existing contact (form prefilled)
- [ ] Detail page shows all contact info
- [ ] Timeline section renders (empty state if no interactions)
- [ ] Agent creating contact → auto-assigned to themselves
- [ ] Admin creating contact → can pick agent from dropdown
- [ ] Validation: name required, phone required, email format check
- [ ] **Duplicate phone warning shows on create**
- [ ] **Phone number displayed prominently on detail page**
- [ ] **Detail page loads within 1 second**
