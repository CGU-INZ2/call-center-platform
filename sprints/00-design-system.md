# Design System — Ministry Call Center Platform
# Thinking: LOW (paste these tokens, no decisions needed)

## Color Tokens

```css
/* Backgrounds */
--bg-root: #0f1117;
--bg-surface: #1a1d25;
--bg-elevated: #22252f;
--bg-hover: #282c38;

/* Borders */
--border-default: #2a2d38;
--border-subtle: #1f222b;

/* Primary — Royal Gold */
--gold-50: #fdf8eb;
--gold-100: #f9edcc;
--gold-200: #f0d68a;
--gold-300: #e4bc4a;
--gold-400: #d4a853;
--gold-500: #c49a3d;
--gold-600: #a37e2e;
--gold-700: #7d6023;

/* Text */
--text-primary: #e8e9ed;
--text-secondary: #8b8fa3;
--text-muted: #5a5e72;
--text-inverse: #0f1117;

/* Semantic */
--success: #34d399;
--success-muted: #064e3b;
--warning: #fbbf24;
--warning-muted: #78350f;
--danger: #f87171;
--danger-muted: #7f1d1d;
--info: #60a5fa;
--info-muted: #1e3a5f;
```

## Typography
- **Font family:** `'Inter', system-ui, sans-serif`
- **Heading weight:** 600 (semibold, not bold — avoids heaviness)
- **Body weight:** 400
- **Mono:** `'JetBrains Mono', monospace` (stats/numbers only)
- Import: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`

## Spacing Scale (rem)
`0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4`

## Border Radius
- `--radius-sm: 6px`
- `--radius-md: 8px`
- `--radius-lg: 12px`
- `--radius-xl: 16px`
- `--radius-full: 9999px`

## Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
--shadow-glow: 0 0 20px rgba(212,168,83,0.15);
```

## Component Patterns
- **Cards:** bg-surface, border-default, radius-lg, shadow-sm
- **Buttons primary:** bg gold-400, text inverse, hover gold-500, radius-md
- **Buttons secondary:** bg transparent, border gold-400, text gold-400, hover bg-hover
- **Inputs:** bg-root, border-default, text-primary, focus border gold-400
- **Tables:** bg-surface for header, alternating bg-root/bg-surface rows
- **Badges/Tags:** radius-full, small text, category color as bg with 15% opacity + full color text
- **Sidebar nav:** bg-surface, 260px wide, gold-400 active indicator (left border 3px)

## Animation
- **Transitions:** 150ms ease for interactions, 300ms ease for page transitions
- **Hover lift:** `transform: translateY(-1px); box-shadow: var(--shadow-md);`
- **Page enter:** Framer Motion `opacity: 0 → 1, y: 8 → 0` over 300ms
- **Skeleton loaders:** Pulse animation on bg-hover → bg-surface

## Layout
- **Sidebar + main content** layout (not top nav)
- Sidebar: fixed left, 260px, collapsible to 64px (icons only) on mobile
- Main content: scrollable, max-width 1400px, centered with padding 1.5rem
- **Mobile breakpoint:** 768px — sidebar becomes bottom sheet / hamburger
