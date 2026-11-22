---
name: web-design-mastery
description: Elite instructions, design tokens, micro-interactions, and conversion-rate optimization (CRO) architecture for crafting world-class, production-grade websites and landing pages.
---

# 🚀 Web Design & UI/UX Mastery Skill

This skill governs the end-to-end design, architecture, and implementation of high-converting, aesthetically stunning, and production-ready websites and landing pages.

---

## 🧠 1. The Core Philosophy: "No AI Clichés"

Generic AI prompts produce generic, washed-out websites with vague headlines, centered icons, and uninspired layouts. To achieve elite status (Stripe, Linear, Raycast, Vercel caliber), every design must follow 5 non-negotiable laws:

1. **Specific, Punchy Micro-Copy**: Never use generic filler like "Empowering your business with innovative solutions". State the exact problem, the exact mechanism, and the exact payoff.
2. **Asymmetric Visual Weight**: Do not make every card 1/3 width with an icon on top. Use Bento Grid patterns, varying card spans (`col-span-2`, `col-span-1`), horizontal feature highlights, and interactive live previews.
3. **Intentional Depth & Glassmorphism**: Use translucent surfaces (`bg-slate-900/70 backdrop-blur-xl`), ultra-subtle border strokes (`border border-white/10`), inner glow effects, and radial gradient ambient lights (`blur-[140px]`).
4. **Interactive Utility (Show, Don't Tell)**: Every great SaaS page has a working interactive widget—a live ROI calculator, a data table preview, an audit simulator, a real-time slider, or an embedded sandbox.
5. **Obsessive Micro-Interactions**: Every button, card, and row must have tactile feedback: `hover:scale-[1.02] active:scale-95 transition-all duration-200 ease-out`, glowing hover borders, and fluid tab switches.

---

## 🎨 2. Standard Design Tokens

### Color Palette (Dark Theme Default)
* **Background Surface**: `#070B14` or `#090D1A` (Deep navy-slate, richer than raw black).
* **Card / Glass Surface**: `rgba(15, 23, 42, 0.70)` with `backdrop-blur-md` and `border border-white/[0.08]`.
* **Primary Brand Accent**: Electric Indigo (`#6366F1` / `rgb(99, 102, 241)`).
* **Secondary Action**: Emerald Mint (`#10B981` / `rgb(16, 185, 129)`) for purchase/conversion actions.
* **Tertiary Highlight**: Electric Cyan (`#06B6D4` / `rgb(6, 182, 212)`) for technical badges and audit stats.
* **Text Hierarchy**:
  * Headings: `#FFFFFF` (Weight: 800 or 900, `tracking-tight`).
  * Subheadings / Body: `#94A3B8` (Slate-400, `leading-relaxed`).
  * Meta / Labels: `#64748B` (Slate-500, uppercase, `tracking-wider`).

### Typography Scale
* **Headings**: `Plus Jakarta Sans`, `Inter`, or `Outfit` via Google Fonts.
* **Technical Readouts / Numbers / Code**: `JetBrains Mono` or `Fira Code`.
* **Headlines**: `text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.08]`.

---

## 📐 3. Landing Page Section Architecture

Every high-converting landing page built under this skill MUST include these 7 sections in order:

### 1. Announcement Pill & Sticky Glass Header
* Top announcement banner with live release status or zero-bounce guarantee.
* Sticky navigation bar (`backdrop-blur-lg bg-[#070B14]/85 border-b border-slate-800/80`).
* Brand logo with gradient icon, clean navigation anchor links, and an instant access CTA.

### 2. High-Impact Hero Section
* Eyebrow badge with glowing status dot (`w-2 h-2 rounded-full bg-emerald-400 animate-pulse`).
* Maximum 8-word high-impact headline using gradient text clipping for the key punchline.
* Value proposition subheadline stating the target customer and core mechanism.
* Dual CTA: Primary high-contrast button + Secondary outline button.
* Proof strip: 4 key validation badges (e.g., DNS MX Verified, Speed Audited, Pixel Tracked, Instant XLSX).

### 3. Live Interactive Showcase / Sandbox
* Never ask the user to take your word for it—put the product directly on the page!
* Interactive lead table with real-time category filtering (Texas, Florida, California, etc.).
* Live search input, "Copy to Clipboard" lead actions, and "Export Sample CSV" capability.

### 4. Bento Grid Features / Flagship Catalog
* Multi-card asymmetric grid with card thumbnails, badge tags, price points, and 1-click checkout buttons.
* Hover zoom effects on images (`group-hover:scale-105 transition duration-300`).

### 5. Interactive ROI / Value Calculator
* Dynamic slider allowing visitors to model their deal size, meeting conversion rate, and pipeline ROI.
* Instant visual proof of mathematical value.

### 6. Technical Audit / Problem Teardown
* Side-by-side or tabbed technical analysis showing speed flaws (ms response times) and missing tracking pixels.
* Equips buyers with the exact pitch scripts they need.

### 7. Conversion FAQ & Sticky Footer
* Accordion-style FAQ addressing objections (refunds, deliverability, freshness, custom scraping).
* High-converting bottom CTA banner with instant checkout link.
* Clean footer with legal, contact, and copyright details.

---

## ⚡ 4. Execution Workflow

When tasked with creating or enhancing a website:
1. **Analyze Target Persona**: Determine who is visiting (e.g., agency owners, SDRs, B2B founders) and what pain point causes them to pull out a credit card.
2. **Draft Design Blueprint**: Select color tokens, fonts, and the interactive centerpiece.
3. **Implement Full Code**: Write fully functional, responsive HTML/JS/Tailwind code without placeholders.
4. **Audit in Browser**: Test viewport responsiveness across desktop, tablet, and mobile. Verify button clicks, search filters, and checkout redirects.
5. **Deploy & Provide Live URLs**: Launch local server and public HTTPS tunnel for immediate stakeholder review.
