# Sprint 2.3 — CSV Import Engine
# Thinking: HIGH — Parsing, validation, preview, column mapping, error handling

## What to Build
An admin-only CSV import tool with column mapping, data preview, validation, and batch insert.

## Route: `/settings/import`
Only accessible by admin (redirect if agent).

## Multi-Step Flow

### Step 1: Upload
- Drag-and-drop zone OR file picker button
- Accept only `.csv` files, max 5MB
- Parse with `papaparse` (client-side, `{ header: true, skipEmptyLines: true }`)
- Show: "X rows detected, Y columns found"
- List the detected column headers

### Step 2: Column Mapping
- Show a table with two columns:
  - Left: **Your CSV Column** (dropdown of detected headers + "Skip")
  - Right: **Maps To** (our database field name)
- Auto-detect mappings by fuzzy matching:
  ```
  CSV header → DB field (case insensitive matching rules)
  "name"/"full name" → name
  "phone"/"mobile"/"contact" → phone
  "email"/"e-mail" → email
  "location"/"address"/"city" → raw_address
  "state" → state
  "city"/"district" → district_city
  "language"/"lang" → language
  "program"/"ministry program" → program_name
  "prayer"/"wants prayer"/"prayer day" → prayer_day_time
  "ror"/"ror daily" → want_ror_daily
  "cell group"/"cell"/"group" → cell_group_name
  "leader"/"cell leader" → cell_group_leader
  "source" → source
  "notes"/"comments" → notes
  ```
- Unmapped columns show a yellow warning badge
- User can manually override any mapping
- Must map at least `name` (required) — show error if not mapped

### Step 3: Preview & Validation
- Show first 10 rows in a table with mapped column headers
- Run validation on ALL rows and report:
  - **Errors (blocking):** Missing name, duplicate phone numbers (within CSV and against existing DB)
  - **Warnings (non-blocking):** Missing phone, invalid email format, no state
- Show summary: "X valid, Y errors, Z warnings"
- Display error/warning rows in a separate expandable section with row numbers

### Step 4: Phone Normalization
- Before insert, normalize all phone numbers:
  ```
  Strip spaces, dashes, dots
  If starts with "0" → remove leading 0, prepend "+91"
  If 10 digits → prepend "+91"
  If starts with "91" (12 digits) → prepend "+"
  If starts with "+91" → keep as-is
  Otherwise → flag as warning, import as-is
  ```

### Step 5: Location Parser (semi-auto)
- For each row where `state` is empty but `raw_address` is not empty:
  - Try to extract state from raw_address using a lookup table of Indian state names and abbreviations
  - Try to extract city by taking the first part before comma/state
  - Set `geo_status = 'mapped'` if both found, `'unmapped'` if ambiguous
- Show a summary: "Auto-mapped X of Y addresses. Z remain unmapped."
- Unmapped ones get `geo_status = 'unmapped'` — admin can fix later in contact edit

### Step 6: Confirm & Import
- Show final summary: "Ready to import X contacts"
- Default assignment: admin's own user ID (can change to a specific agent)
- On confirm:
  - Batch insert using `supabase.from('contacts').insert(rows)` in chunks of 100
  - Set `source = 'csv_import'` for all rows
  - Set `call_status = 'New'` for all rows
  - Set `category_id` to the "New" system category
  - Write audit_log entry: `{ action: 'csv_import', entity_type: 'contacts', after_data: { count: X } }`
- Show progress bar during insert
- On complete: "Successfully imported X contacts. Y skipped due to errors."
- Button: "View Contacts" → navigates to `/contacts`

## Error Handling
- If any batch fails → rollback that batch only, report which rows failed
- Show downloadable CSV of failed rows with error reasons added as last column

## Styling
- Step indicator at top (1 → 2 → 3 → 4 → 5 → 6), gold for active/completed, muted for upcoming
- Upload zone: dashed border, bg-hover on drag over, gold accent
- Validation errors: red badges, warnings: yellow badges
- Preview table: same style as contacts table

## Definition of Done
- [ ] CSV file can be uploaded and parsed
- [ ] Column mapping auto-detects common headers
- [ ] Manual mapping override works
- [ ] Phone normalization produces +91XXXXXXXXXX format
- [ ] Location parser extracts state/city from raw addresses
- [ ] Validation catches missing name, duplicate phones
- [ ] Import inserts contacts in batches with progress indication
- [ ] Failed rows downloadable as CSV
- [ ] Audit log records the import event
- [ ] Only admin can access this page
