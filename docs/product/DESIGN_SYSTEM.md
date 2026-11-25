# ApexIntel B2B — Design System & Visual Architecture
**Document ID:** `DESIGN-SYS-2026-V1`  
**Phase:** Phase 2 Brand & Design System  
**Date:** November 24, 2026  

---

## 1. Visual Direction & Philosophy

ApexIntel is a high-conviction B2B sales intelligence platform. It conveys rigor, speed, precision, and enterprise trust.

### Core Directives:
- **Canvas:** Midnight Charcoal (`#070B14`, `#0B111E`), elevated by translucent slate layers (`#0E1626`).
- **Typography:** Modern editorial authority using **Plus Jakarta Sans** for headlines and interface elements, paired with **JetBrains Mono** for forensic metrics, latency readouts, and timestamps.
- **Color Accents:** Electric Cyan (`#06B6D4`) for diagnostics and actions, Apex Emerald (`#10B981`) for verified status badges, and Indigo (`#6366F1`) for opportunity scoring.
- **Restraint Over Noise:** Eliminate superfluous glowing borders, chaotic gradients, and decorative animations. Every element must communicate genuine business intelligence.

---

## 2. Design Tokens Reference

All design tokens are standardized in [public/css/apex-tokens.css](file:///c:/laragon/www/browser-agent/public/css/apex-tokens.css).

### 2.1 Color Palette

| Token Name | CSS Variable | Hex / RGBA | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--apex-canvas` | `#070B14` | Primary viewport background |
| **Deep Surface** | `--apex-surface-deep` | `#0B111E` | Input fields, table header bands |
| **Surface** | `--apex-surface` | `#0E1626` | Card background, drawer panels |
| **Elevated Surface** | `--apex-surface-elevated`| `#152238` | Hover states, elevated modal bodies |
| **Hairline Border** | `--apex-border-hairline`| `rgba(255, 255, 255, 0.07)` | Standard card/divider borders |
| **Medium Border** | `--apex-border-medium` | `rgba(255, 255, 255, 0.12)` | Active/hovered card borders |
| **Focus Border** | `--apex-border-focus` | `rgba(6, 182, 212, 0.5)` | Focused form inputs |
| **Cyan Accent** | `--apex-cyan` | `#06B6D4` | Primary CTAs, diagnostic links |
| **Emerald Success** | `--apex-emerald` | `#10B981` | Verified status, paid orders, confirmed MX |
| **Indigo Brand** | `--apex-indigo` | `#6366F1` | Brand accents, workspace badges |
| **Amber Warning** | `--apex-amber` | `#F59E0B` | Slow latency warnings, unoptimized sites |
| **Rose Alert** | `--apex-rose` | `#F43F5E` | Critical speed gaps, missing pixels |

---

## 3. UI Component Patterns

### 3.1 Buttons
- **Primary CTA (`.apex-btn-primary`):** High-contrast cyan gradient (`#06B6D4` to `#0284C7`), subtle box shadow, 1px top border highlight.
- **Secondary CTA (`.apex-btn-secondary`):** Translucent slate background, hairline white border, transitions to elevated surface on hover.
- **Conversion CTA (`.apex-btn-emerald`):** Emerald gradient (`#10B981` to `#059669`) reserved for instant dataset purchasing and checkout actions.

### 3.2 Badges & Indicators
- `.apex-badge-cyan`: Used for opportunity scores (`Score 92`) and technology tags (`Tailwind`, `Shopify`).
- `.apex-badge-emerald`: Used strictly for verified data attributes (`MX-Verified`, `Live 200 OK`).
- `.apex-badge-amber`: Used for review/in-progress states (`Reviewing`, `Mining`).
- `.apex-badge-slate`: Used for metadata tags and territory labels (`Dallas, TX`, `HVAC`).

### 3.3 Data Tables
- Header: Dark surface, uppercase 11px font, bold letter spacing (`tracking-wider`).
- Rows: Hairline separator, subtle background hover highlight (`rgba(21, 34, 56, 0.4)`), zero jitter.

### 3.4 Modals & Overlays
- `.apex-modal-overlay`: 85% opacity dark backdrop with `backdrop-filter: blur(8px)`.
- Center-aligned card with `var(--apex-shadow-elevated)` and clean close trigger.

---

## 4. Motion & Performance Standards

1. **Duration:** Micro-interactions use `150ms` to `200ms` with `cubic-bezier(0.16, 1, 0.3, 1)`.
2. **GPU Acceleration:** Only transform `transform` and `opacity` properties to prevent DOM layout repaints.
3. **Accessibility:** Strictly implements `@media (prefers-reduced-motion: reduce)` to disable transitions for sensitive users.
