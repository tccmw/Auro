# Auro Design System

## Brand Direction
- Auro is a light-first desktop focus tracker for people who want to see app usage, limits, and alerts at a glance.
- The product tone is calm, precise, and practical. Avoid generic AI dashboard styling.
- The UI should feel like an operational tool, not a landing page. Prioritize scannable data, clear controls, and compact visual hierarchy.

## Color Tokens
- Background: `#f6f8ff` app canvas, `#eef4ff` soft band, `#ffffff` surfaces.
- Text: `#101828` primary, `#334155` secondary, `#64748b` muted.
- Borders: `#dbe4f0` default, `#c7d7ef` emphasized.
- Brand: `#6366f1` indigo, `#22d3ee` cyan, `#8b5cf6` violet.
- Semantic: `#10b981` success, `#f59e0b` warning, `#fb7185` alert.
- Prefer solid colors. Use gradients only when a data visualization requires it.

## Typography
- Font stack: Inter, system UI, Segoe UI, sans-serif.
- Page title: 30px / 1.1, semibold.
- Section title: 18px / 1.25, semibold.
- Card value: 24px / 1.1, semibold.
- Body: 14px / 1.45. Metadata: 12-13px.
- Letter spacing is always `0`.

## Layout, Radius, Elevation
- Desktop-first minimum width: 920px.
- Shell padding: 24px. Section gap: 18px. Card gap: 12px.
- Cards and controls use 8px radius.
- Surfaces use solid backgrounds and subtle borders. Avoid glassmorphism, glow, blur, and heavy shadows.
- Do not nest cards inside cards. Use top-level panels for tools and repeated cards for metrics/apps.

## Components
- Header: Auro mark, product name, short status copy, date chip, and segmented view control.
- Metric cards: icon, concise label, value, optional status hint.
- App cards: app icon/initial, process name, notification state, limit progress, remaining time, edit/delete icon buttons.
- Usage bars: actual per-app usage only; no fabricated hourly charts.
- Empty states: explain the missing state and provide a direct next action.
- Settings: installed app picker is the primary path; manual form is advanced.

## Icons and Motion
- Use lucide icons for actions and status.
- Icon-only buttons need `title` text.
- Motion should be fast and functional: hover, focus, and progress transitions around 160-200ms.
- Avoid decorative orbs, aurora washes, glossy logo effects, oversized hero layouts, and template-like English labels.
