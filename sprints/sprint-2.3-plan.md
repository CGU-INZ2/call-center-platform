# CSV Import Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a robust, admin-only multi-step CSV import wizard to bulk-upload and map contact records with client-side parsing, duplicate verification, phone normalization, location auto-parsing, and detailed audit logs.

**Architecture:** Create an admin-only route at `/settings/import` verified on the server-side, rendering a client-side wizard with 6 guided steps (Upload, Mapping, Preview & Validation, Normalization, Address Parsing, and Bulk Insert). Database operations are processed in sequential chunks of 100 on the client, with failures captured and generated as a downloadable error CSV.

**Tech Stack:** Next.js (App Router), Supabase JS Client, Papaparse (CSV parsing), Framer Motion (animated steps transitions), Lucide Icons, and Tailwind CSS.

---

## User Review Required

> [!IMPORTANT]
> **RLS Policies & Permissions:** The bulk inserts and audit log writes will be executed directly via the client-side Supabase SDK. The user must be authenticated and have the `admin` role in the `profiles` table to satisfy RLS policies for writes to `contacts` and `audit_log`.

## Open Questions

> [!NOTE]
> There are no open questions as the Sprint 2.3 specification is fully comprehensive.

---

## Proposed Changes

### [Dashboard Layout & Navigation]

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/vbans/Documents/Call%20Center%20Web%20App/src/components/layout/Sidebar.tsx)
Add an "Import Contacts" navigation link under Settings (or as a standalone admin link) so admins can access `/settings/import` directly.

#### [MODIFY] [ContactsClient.tsx](file:///c:/Users/vbans/Documents/Call%20Center%20Web%20App/src/app/%28dashboard%29/contacts/ContactsClient.tsx)
Render an "Import CSV" button next to the "Add Contact" button in the directory header if `userRole === 'admin'`.

---

### [Import Pages & Components]

#### [NEW] [page.tsx](file:///c:/Users/vbans/Documents/Call%20Center%20Web%20App/src/app/%28dashboard%29/settings/import/page.tsx)
Server Component serving the `/settings/import` route:
- Authenticates user and fetches profile role.
- Redirects to `/login` if unauthenticated.
- Redirects to `/` (home dashboard) if user is not an `admin`.
- Renders the client-side `<ImportClient />` component.

#### [NEW] [ImportClient.tsx](file:///c:/Users/vbans/Documents/Call%20Center%20Web%20App/src/app/%28dashboard%29/settings/import/ImportClient.tsx)
Stateful Client Component managing the 6-step import workflow:

- **State Management:**
  - `step`: Current step number (1 to 6).
  - `csvData`: Parsed row objects from Papaparse.
  - `headers`: Array of detected column headers.
  - `mapping`: Map of database fields to CSV column headers.
  - `validationResults`: Array of rows annotated with validation errors/warnings.
  - `normalizedRows`: Rows prepared for insert.
  - `progress`: Import progress percentage.
  - `errorsList`: Array of rows that failed during batch insert.

- **Step 1: Upload UI**
  - Drag-and-drop region with gold border and drag-over styling.
  - File picker restricted to `.csv` files up to 5MB.
  - Client-side parse via Papaparse:
    ```typescript
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => { ... }
    })
    ```

- **Step 2: Column Mapping UI**
  - Table showcasing target Database Fields vs CSV Column selectors.
  - Pre-fill fields using fuzzy (case-insensitive) matches:
    - `full_name` ⟵ "name", "full name"
    - `phone` ⟵ "phone", "mobile", "contact"
    - `email` ⟵ "email", "e-mail"
    - `raw_address` ⟵ "location", "address", "city" (if city/district is separate, otherwise map to raw_address)
    - `state` ⟵ "state"
    - `district_city` ⟵ "city", "district"
    - `language` ⟵ "language", "lang"
    - `program_name` ⟵ "program", "ministry program"
    - `prayer_day_time` ⟵ "prayer", "wants prayer", "prayer day"
    - `want_ror_daily` ⟵ "ror", "ror daily"
    - `cell_group_name` ⟵ "cell group", "cell", "group"
    - `cell_group_leader` ⟵ "leader", "cell leader"
    - `notes` ⟵ "notes", "comments"
  - Mandatory validation: `full_name` mapping is required to proceed.

- **Step 3: Preview & Validation UI**
  - Render first 10 rows in a formatted grid.
  - Validate all rows:
    - **Errors:** Missing `full_name`, duplicate phone in CSV, duplicate phone in DB.
      - *DB duplicate check:* Query `.in('phone', normalizedPhones)` in chunks of 500.
    - **Warnings:** Missing phone, invalid email format, missing state.
  - Toggle section to review all validation messages grouped by severity.

- **Step 4: Phone Normalization**
  - Strip spaces, dashes, dots, brackets.
  - If starts with `0` (11 digits) ⟵ slice `0` off, prepend `+91`.
  - If exactly 10 digits ⟵ prepend `+91`.
  - If starts with `91` (12 digits) ⟵ prepend `+`.
  - If starts with `+91` ⟵ keep as-is.
  - Else ⟵ trigger non-blocking warning, import as-is.

- **Step 5: Location Parser (semi-auto)**
  - Look up Indian State dictionary matching state names & common codes.
  - If `state` column is empty but `raw_address` is present:
    - Extract state matching dictionary names.
    - Extract city as token before comma/state name.
    - Set `geo_status = 'mapped'` if both succeeded, else `geo_status = 'unmapped'`.

- **Step 6: Confirm & Import**
  - Agent dropdown selector (defaulting to the admin's profile ID).
  - Split rows into batches of 100 and execute sequential `supabase.from('contacts').insert(batch)` calls.
  - If a batch fails, log the failed rows, rollback/skip only that batch, and continue.
  - Insert audit log entry:
    ```typescript
    await supabase.from('audit_log').insert({
      action: 'csv_import',
      entity_type: 'contacts',
      after_data: { count: successCount, failed: failedCount }
    })
    ```
  - Option to download failed rows as a CSV file with an `Error Reason` column appended.

---

## Verification Plan

### Automated Tests
*Write a Playwright verification script to execute in headless mode using the `webapp-testing` skill:*
- Command: `python scripts/with_server.py --server "npm run dev" --port 3000 -- python tests/csv_import_flow.py`
- Test cases:
  1. Accessing `/settings/import` as agent (should redirect to `/`).
  2. Accessing `/settings/import` as admin (should load successfully).
  3. Uploading a mock contact CSV (should parse and extract headers).
  4. Performing custom column mappings and overriding them.
  5. Performing validation checks (catches empty name, flags duplicate phones).
  6. Completing import pipeline, verifying batch progress, and checking audit logs.

### Manual Verification
- Verify drag-and-drop region responsiveness and highlight behavior.
- Validate layout on multiple viewport sizes (responsive sidebar & tables).
- Verify CSV file download behavior for failed imports.
