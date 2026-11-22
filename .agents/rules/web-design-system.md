# Web Design & Frontend Engineering Rules

Apply these rules whenever creating, updating, or styling websites, landing pages, HTML files, or UI components.

## 1. Visual Aesthetics & Polish
* **Theme**: Modern Dark Mode is the default for SaaS and B2B products unless the user requests light mode. Use rich dark tones (`#070B14`, `#090D1A`, `#0F172A`), never flat raw `#000000`.
* **Glassmorphism**: Use translucent surfaces (`bg-slate-900/70 backdrop-blur-xl`), paired with hairline light borders (`border border-white/[0.08]`).
* **Ambient Lighting**: Place large, blurred radial gradient background orbs (`bg-indigo-600/15 blur-[140px] pointer-events-none -z-10`) to create a high-end glowing atmosphere.
* **Typography**: Always import and apply Google Fonts (`Plus Jakarta Sans` or `Inter` for body/headings, `JetBrains Mono` for data and technical stats).
* **Headings**: Use heavy weights (`font-black` or `font-extrabold`) with tight tracking (`tracking-tight` or `tracking-[-0.03em]`).

## 2. Component & Layout Standards
* **Grid Hierarchy**: Use Bento Grids (`grid md:grid-cols-2 lg:grid-cols-4 gap-6`) with asymmetric weights rather than repetitive identical boxes.
* **Buttons & CTAs**:
  * Primary CTAs: Solid high-contrast gradients (e.g., `bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition-all`).
  * Secondary CTAs: Bordered glass (`bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800`).
* **Zero Placeholders**: Never use "Lorem Ipsum" or "Company XYZ". Write authentic, high-converting copy relevant to the product.
* **Interactive Element**: Every landing page MUST include at least one working interactive widget (e.g., live table search/filter, ROI slider, calculator, or interactive audit simulator).

## 3. Responsive & Accessibility Rules
* **Mobile First**: Test all layouts across mobile (`w-full flex-col`), tablet (`grid-cols-2`), and desktop (`lg:grid-cols-4`).
* **Touch Targets**: Buttons and clickable elements must be at least 44px tall (`py-2.5 px-4` minimum).
* **Semantic HTML**: Always use `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, and `<footer>`.
* **Contrast**: Ensure text colors pass WCAG AA standards (minimum 4.5:1 contrast against dark backgrounds).
