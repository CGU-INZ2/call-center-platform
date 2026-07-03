# Sprint 4.1 — Agent Dashboard
# Thinking: MEDIUM — Recharts, aggregation queries, responsive cards

## What to Build
The home `/` page for agents showing their personal KPIs and activity.

## Route: `/` (dashboard home)

### KPI Cards Row (4 cards, responsive grid)
| Card | Query | Icon |
|---|---|---|
| My Contacts | `SELECT count(*) FROM contacts WHERE assigned_agent_id = uid` | Users |
| Calls Today | `SELECT count(*) FROM calls WHERE agent_id = uid AND started_at >= today` | Phone |
| Pending Follow-ups | `SELECT count(*) FROM followups WHERE agent_id = uid AND status = 'pending'` | Clock |
| Overdue | `SELECT count(*) FROM followups WHERE agent_id = uid AND status = 'pending' AND due_at < today` | AlertTriangle (red) |

Card style: bg-surface, large stat number in text-primary, label in text-secondary, icon in gold. Hover shadow-glow.

### Chart: Calls This Week (Bar Chart)
- Last 7 days on X axis, call count on Y axis
- Query: `SELECT date_trunc('day', started_at) as day, count(*) FROM calls WHERE agent_id = uid AND started_at >= now() - interval '7 days' GROUP BY day ORDER BY day`
- Use Recharts: `<BarChart>` with gold fill bars, bg-surface background
- Tooltip on hover showing exact count

### Chart: Status Distribution (Donut Chart)
- Show contact statuses as a donut/pie chart
- Query: `SELECT call_status, count(*) FROM contacts WHERE assigned_agent_id = uid GROUP BY call_status`
- Colors match status badge colors from Sprint 2.1
- Legend below chart

### Recent Activity Feed (last 10 interactions)
- Query: union of latest 10 calls + followups for this agent, sorted by created_at DESC
- Each entry: icon, "Called [Contact Name]" or "Follow-up due for [Name]", relative timestamp
- Clickable → navigate to contact detail

### Layout
- KPI cards: 4-column grid on desktop, 2x2 on tablet, 1-column on mobile
- Charts: 2-column on desktop (bar left, donut right), stacked on mobile
- Activity feed: full width below charts

## Definition of Done
- [ ] 4 KPI cards with live data
- [ ] Bar chart shows last 7 days of calls
- [ ] Donut chart shows status distribution
- [ ] Activity feed shows recent interactions
- [ ] All data scoped to current agent (RLS)
- [ ] Responsive layout on mobile

---

# Sprint 4.2 — Admin Dashboard
# Thinking: MEDIUM — More complex aggregation, multi-agent view

## What to Build
Admin-specific dashboard with org-wide KPIs and per-agent performance.

## Route: `/` — Admin sees different dashboard than agent (check role from UserContext)

### Global KPI Cards (6 cards, 3x2 grid)
| Card | Query |
|---|---|
| Total Contacts | `SELECT count(*) FROM contacts` |
| Total Calls Today | `SELECT count(*) FROM calls WHERE started_at >= today` |
| Total Calls This Week | `SELECT count(*) FROM calls WHERE started_at >= start_of_week` |
| Contacts Needing Follow-up | `SELECT count(*) FROM followups WHERE status = 'pending'` |
| Unmapped Locations | `SELECT count(*) FROM contacts WHERE geo_status = 'unmapped'` |
| Prayer Requests | `SELECT count(*) FROM prayer_requests` |

### Agent Leaderboard Table
| Column | Source |
|---|---|
| Agent Name | profiles.full_name |
| Contacts Assigned | count of contacts per agent |
| Calls Today | count of calls today per agent |
| Calls This Week | count of calls this week per agent |
| Pending Follow-ups | count of pending followups per agent |

Query: Join profiles with aggregated counts from contacts, calls, followups.
Sort by "Calls This Week" DESC by default. Allow clicking column headers to re-sort.

### Charts
1. **Calls Trend (Line Chart):** Last 30 days, all agents combined. Gold line.
2. **Contacts by State (Horizontal Bar):** Top 10 states by contact count. Useful for coverage insights.
3. **Status Pipeline (Stacked Bar):** One bar per agent, stacked by call_status. Shows pipeline distribution per agent.

### Recent Org Activity Feed
- Same as agent feed but across all agents
- Show agent name prefix: "Agent [Name] called [Contact Name]"

### Layout
- KPI cards: 3x2 grid
- Leaderboard: full width, below KPIs
- Charts: 2-column grid below leaderboard
- Activity feed: full width at bottom

## Definition of Done
- [ ] 6 global KPI cards with live data
- [ ] Agent leaderboard with sortable columns
- [ ] Line chart, horizontal bar chart, stacked bar chart rendering
- [ ] Only admin sees this dashboard (agents see Sprint 4.1 dashboard)
- [ ] Responsive layout

---

# Sprint 4.3 — India Geo Heatmap (Deferred — Phase 5)
# Thinking: HIGH — Choropleth rendering, GeoJSON, drill-down
# NOTE: Moved to Phase 5 to reduce Phase 4 scope.
# Can be built with react-simple-maps + India TopoJSON.
# Detailed spec will be provided when Phase 5 begins.

---

# Sprint 4.4 — Data Quality Dashboard (Optional — Phase 5)
# Thinking: MEDIUM — Aggregation + bulk update UI
# NOTE: Moved to Phase 5. Summary:
# - Show counts of unmapped geo, missing phone, missing category
# - Bulk tag contacts by filter
# - Agent-scoped mini-map showing their contact distribution
