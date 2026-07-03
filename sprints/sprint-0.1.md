# Sprint 0.1 — Repo Init & Empty Shell Deploy
# Thinking: LOW — Pure boilerplate, zero design decisions

## What to Build
Scaffold a Next.js 15 app with TypeScript, Tailwind CSS, shadcn/ui, and deploy an empty shell to Vercel. Connect to a new Supabase project.

## Step-by-Step

### 1. Create Next.js App
```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

### 2. Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion recharts react-simple-maps papaparse
npm install -D @types/papaparse @types/react-simple-maps
```

### 3. Init shadcn/ui
```bash
npx -y shadcn@latest init
```
When prompted: Style = Default, Base color = Slate, CSS variables = Yes.
Then install core components:
```bash
npx -y shadcn@latest add button card input label table badge dialog dropdown-menu select separator sheet tabs toast avatar command popover calendar
```

### 4. Folder Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← sidebar + main content shell
│   │   ├── page.tsx            ← dashboard home (placeholder)
│   │   ├── contacts/page.tsx   ← placeholder
│   │   ├── calls/page.tsx      ← placeholder
│   │   ├── analytics/page.tsx  ← placeholder
│   │   └── settings/page.tsx   ← placeholder
│   ├── layout.tsx              ← root: font imports, providers
│   ├── globals.css             ← design tokens from 00-design-system.md
│   └── page.tsx                ← redirect to /login or /dashboard
├── components/
│   ├── ui/                     ← shadcn components (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── SidebarItem.tsx
│   │   └── TopBar.tsx
│   └── shared/
│       └── PageHeader.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← browser client
│   │   ├── server.ts           ← server component client
│   │   └── middleware.ts       ← auth middleware helper
│   └── utils.ts                ← shadcn cn() utility
├── types/
│   └── database.ts             ← placeholder, generated later
└── middleware.ts                ← Next.js middleware for auth redirect
```

### 5. Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
```
Create `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 6. Supabase Client Setup

**`src/lib/supabase/client.ts`:**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/supabase/server.ts`:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component read-only */ }
        },
      },
    }
  )
}
```

### 7. globals.css
Paste ALL CSS custom properties from `00-design-system.md` into `:root {}` in `globals.css`. Set `body { background: var(--bg-root); color: var(--text-primary); }`.

### 8. Sidebar Shell
Build a minimal sidebar with these nav items (all link to placeholder pages):
- Dashboard (LayoutDashboard icon)
- Contacts (Users icon)
- Calls (Phone icon)
- Analytics (BarChart3 icon)
- Settings (Settings icon)

Use Lucide React icons. Active item gets a left gold border. Sidebar bg = `var(--bg-surface)`.

### 9. Deploy to Vercel
```bash
npx -y vercel --yes
```
Set environment variables in Vercel dashboard manually.

## Definition of Done
- [ ] App runs locally on `localhost:3000`
- [ ] Sidebar navigation visible with placeholder pages
- [ ] Dark theme with gold accents applied
- [ ] Deployed to a Vercel URL (even if pages are empty)
- [ ] `.env.example` committed, `.env.local` in `.gitignore`
- [ ] No console errors
