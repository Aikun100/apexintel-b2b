# 🎨 UI/UX Design System & Architectural Blueprint

This document specifies the design tokens, visual hierarchy, glassmorphism recipes, component patterns, and responsive behavior for all web applications and landing pages built in this project.

---

## 🌈 1. Color System & Semantic Tokens

### Primary Theme: Modern Dark Obsidian
We avoid pure black (`#000000`) because it causes visual fatigue and harsh contrast. Instead, we use a deep, blue-tinted obsidian slate that provides depth and elegance.

| Token | CSS / Tailwind Class | Hex Value | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `bg-[#070B14]` | `#070B14` | Primary page background |
| **Surface Card** | `bg-slate-900/75` | `rgba(15, 23, 42, 0.75)` | Translucent glass cards |
| **Card Border** | `border-white/[0.08]` | `rgba(255, 255, 255, 0.08)` | Hairline container borders |
| **Brand Accent (Indigo)**| `bg-indigo-600` / `text-indigo-400` | `#6366F1` | Primary action buttons, badges |
| **Conversion (Emerald)** | `bg-emerald-600` / `text-emerald-400`| `#10B981` | Purchase buttons, verified badges |
| **Audit / Tech (Cyan)** | `bg-cyan-600` / `text-cyan-400` | `#06B6D4` | Speed audit metrics, tech tags |
| **Warning / Alert** | `bg-amber-500` / `text-amber-400` | `#F59E0B` | Unoptimized site flags, notices |
| **Headings Text** | `text-white` | `#FFFFFF` | Headlines, card titles (font-black) |
| **Muted Body Text** | `text-slate-400` | `#94A3B8` | Subheadlines, descriptions |
| **Meta / Labels** | `text-slate-500` | `#64748B` | Table headers, timestamps |

---

## 🪟 2. Glassmorphism & Elevation Recipe

To achieve realistic, high-end depth, combine a translucent background, backdrop blur, hairline borders, and glowing ambient drop shadows:

```css
/* Glass Card Definition */
.glass-card {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
}

/* Ambient Radial Glow */
.ambient-glow-indigo {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 400px;
  background: rgba(99, 102, 241, 0.15);
  filter: blur(140px);
  pointer-events: none;
  z-index: -10;
}
```

---

## 🔤 3. Typography Hierarchy

Import the following Google Fonts in the document `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
```

### Type Scale:
1. **Hero Headline**: `text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]`
2. **Section Heading**: `text-3xl sm:text-4xl font-black tracking-tight text-white`
3. **Card Title**: `text-lg sm:text-xl font-extrabold text-white leading-snug`
4. **Body Copy**: `text-sm sm:text-base text-slate-400 leading-relaxed font-normal`
5. **Eyebrow / Badge**: `text-xs font-bold uppercase tracking-wider`
6. **Data / Code**: `font-mono text-xs sm:text-sm text-cyan-300 font-semibold`

---

## 🎛️ 4. Interactive Components Library

### 1. High-Contrast Primary CTA Button
```html
<button class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-2">
  <span>Explore Live Previews</span>
  <span>&rarr;</span>
</button>
```

### 2. Live Status Badge
```html
<span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
  100% DNS MX Verified
</span>
```

### 3. Interactive Range Slider (ROI Calculator)
```html
<input 
  type="range" 
  min="10" 
  max="200" 
  value="50" 
  class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
  oninput="updateROI(this.value)"
>
```

### 4. 1-Click Clipboard Copy Button
```javascript
function copyLead(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = '✓ Copied!';
    buttonElement.classList.add('bg-emerald-600', 'text-white');
    setTimeout(() => {
      buttonElement.innerHTML = originalText;
      buttonElement.classList.remove('bg-emerald-600', 'text-white');
    }, 2000);
  });
}
```

---

## 📱 5. Responsive Breakpoint Rules

| Device | Breakpoint | Container Width | Layout Pattern |
| :--- | :--- | :--- | :--- |
| **Mobile** | `< 640px` (`sm`) | `w-full px-4` | 1-column vertical stack, horizontal scrolling tables |
| **Tablet** | `640px - 1024px` (`md`) | `max-w-2xl px-6` | 2-column grid, compact navigation |
| **Desktop**| `1024px+` (`lg`, `xl`)| `max-w-7xl px-8` | 4-column Bento grid, full table view, sticky header |

---

## 🛡️ 6. Pre-Flight Quality Checklist

Before finalizing any web build:
- [ ] Are all headlines tightly tracked (`tracking-tight`) with zero generic clichés?
- [ ] Do all buttons have distinct `hover:`, `focus:`, and `active:` micro-interactions?
- [ ] Does every image have an `onerror` fallback?
- [ ] Does the page function completely offline or with local assets?
- [ ] Does the live public tunnel return `HTTP 200 OK`?
- [ ] Does the interactive widget (calculator, search, table) execute without console errors?
