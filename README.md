# Ministry Call Center Platform

A premium, modern web application for ministry agents and administrators to manage contacts, track follow-ups, coordinate prayer requests, send WhatsApp messages via template-based deep links, and view real-time call performance metrics.

---

## 🌟 Key Features

*   **Contacts Directory**: Server-paginated, filterable, and searchable contacts index with role-based access control.
*   **Duplicate Detection**: Automatic phone number lookup and collision alerts when adding or editing contacts.
*   **CSV Import Wizard**: A stateful 6-step importer with column auto-mapping, data validation, and phone number formatting.
*   **Actionable Queue & Logging**: Log call outcomes immediately and queue up the next contact dynamically.
*   **WhatsApp Deep Linking**: Admin-managed message templates with placeholder replacement (`{name}`) linking to WhatsApp Web/Desktop.
*   **Prayer & Testimony Tracker**: Log prayer requests directly from contact detail view, and access a printer-friendly group prayer coordinator view.
*   **Role-Based Dashboards**: Live dashboard charts using Recharts for call volumes, success rates, trends, and follow-up metrics.
*   **Security & Hardening**:
    *   Strict Content Security Policy (CSP) and HTTP security headers.
    *   Database-backed sliding-window rate limiting on sensitive API routes.
    *   Input sanitization to neutralize HTML and script injections.
    *   Component-level React 19 `ErrorBoundary` fallback layouts.
    *   30-minute idle inactivity auto-logout.
    *   Keyboard Hotkey shortcuts (`/` to search, `Esc` to blur, `N` for new contact).

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 15 (App Router) + TypeScript
*   **Styling**: Tailwind CSS + shadcn/ui
*   **Database & Auth**: Supabase Postgres (with Row-Level Security)
*   **Charts**: Recharts
*   **Icons**: Lucide React
*   **CSV Handling**: PapaParse

---

## 📦 Project Structure

```text
├── next.config.ts          # Next.js config with custom HTTP security headers
├── tailwind.config.ts      # Tailwind configuration and custom tokens
├── supabase/
│   └── migrations/         # Database migrations (RLS, schemas, rate limits)
├── src/
│   ├── app/                # Next.js App Router (Layouts, API routes, pages)
│   │   ├── (auth)/         # Login page and auth routes
│   │   ├── (dashboard)/    # Secure layout, directory, details, follow-ups
│   │   ├── api/            # API endpoints (create-user, contacts, lookup)
│   │   └── error.tsx       # Global root error boundaries
│   ├── components/
│   │   ├── common/         # ErrorBoundary, UI components (Cards, Buttons, Tables)
│   │   ├── dashboard/      # Metrics cards, trends charts
│   │   └── layout/         # TopBar, Sidebar, HotkeyListener
│   ├── lib/
│   │   ├── context/        # UserContext (Session & idle inactivity management)
│   │   ├── supabase/       # Client & admin database helper instances
│   │   ├── rate-limit.ts   # Sliding-window rate limiter utility
│   │   └── sanitize.ts     # Input XSS sanitization utility
│   └── types/              # TypeScript custom interfaces
```

---

## 🔑 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-Only Service Role Key (Used for Rate Limiting & User Management)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

## 🗄️ Database Tables Schema

*   `profiles`: Custom auth profiles extending `auth.users` with roles (`admin`, `agent`).
*   `contacts`: Call contacts database. Enforces agent-specific RLS.
*   `categories`: Contact categorization list (Admin-configurable).
*   `calls`: Interaction logs containing outcomes, notes, and duration.
*   `followups`: Scheduled callbacks and task queues.
*   `whatsapp_templates`: Reusable message templates for agents.
*   `whatsapp_messages`: Audit log for templates clicked and marked sent by agents.
*   `prayer_requests`: Prayer requests and testimonies logs.
*   `rate_limits`: Track identifier and action timestamps for rate limits.
*   `audit_log`: Change tracker capturing JSON differences (before/after) on mutations.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Verify Production Build
To test the production compilation and static page generation:
```bash
npm run build
```

---

## ☁️ Production Deployment

1. Set up a Next.js project on **Vercel** pointing to your repository.
2. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`) in the Vercel project settings.
3. Deploy the project. The build pipeline will compile the production-ready assets automatically.
