# Design System & Styling

**Doc 18 of 22** · Audience: a solo full‑stack successor · Prerequisite: `16_frontend_mobile_report_and_dashboard.md`, `14_frontend_core_state_and_app_shell.md`.

Goal of this doc: give you the complete map of SlayHealth's styling layer — **two parallel design‑token systems** (`globals.css` + the scoped `.mshell` mobile shell) sitting on top of **Tailwind v4 defaults**, why the brand green renders as three different greens, the typography split, the mobile‑shell design language, the authored‑but‑dead dark mode, the two icon systems, and the signature gauge/ring formulas — plus the reconciliation backlog and the one AA contrast failure you must not reintroduce.

The single most important framing: **mobile is the locked design reference; the styling layer is functionally complete but as a *design system* it is un‑reconciled.** Nothing here is broken at runtime — fonts load, the mobile shell is coherent, the focus ring exists — but the tokens were never collapsed, so every new screen keeps diverging. Read this before doc 17 (web gaps) so you know what you're reconciling *toward*.

---

## 1. The two‑palette reality

There are **two complete design‑token vocabularies** in this app, with overlapping variable *names* but different *values*, plus Tailwind's own default palette as a de‑facto third. A `var(--teal)` resolves to a **different colour** depending on whether the element is inside a `.mshell` container.

| | **System A — `globals.css :root`** | **System B — `mobile-shell.css .mshell/.mnav`** |
|---|---|---|
| Anchor | `frontend/src/app/globals.css:5-76` | `frontend/src/app/mobile-shell.css:9-33` |
| Governs | Desktop dashboard, report/core‑engine surfaces, wizard, auth/onboarding, dev routes | Mobile dashboard (`MobileHomeView`), profile, add‑prospect wizard shell, the floating bottom nav |
| Scope mechanism | Global `:root` — consumed via `var(--x)` + inline `style={}` | Scoped under `.mshell` / `.mnav` — activated by wrapping `<div className="mshell">` |
| Paper/bg | `--paper #F7F8FA` (cool) | `--bg #F2F0EB` (warm) |
| Brand teal | `--teal #18CC96` (bright mint) | pine ramp `--teal-600 #0D7365` / `--teal-500 #14A38F` |
| Brand pink | `--pink #DE457D` | magenta ramp `--mag-700 #8E1049` / `--mag-600 #B8175F` / `--mag-500 #DC2A76` |
| Radius | `8 / 10 / 12 / 999` (`--radius-*`) | `20 / 26` (`--r` / `--r-lg`) |
| Ink | `--ink #14161A` | `--ink #0E1513` |
| Fonts var | `--font-serif` / `--font-sans` | `--m-serif` / `--m-sans` |

### The three brand greens (UX4‑01, P1)

The single most‑referenced brand colour renders as **three distinct greens** because two token systems were layered without collapsing, and Tailwind was left on its defaults:

| Green | Hex | Where | Anchor |
|---|---|---|---|
| Bright mint (System A) | `#18CC96` | `--primary`, `--teal`, `--success`, `.title` gradients, `var(--teal)` (~29 files) | `globals.css:9,35` |
| Tailwind emerald | `emerald-500 #10b981` / `emerald-600 #059669` | raw utility classes on JSX, **28 usages across 8 files** | e.g. `invite/[token]/page.js`, `core-engine/*/page.js` |
| USG "normal" | `#10b981` again | `--color-normal` (health‑status dot) | `globals.css:61` |
| Pine (System B) | `#0D7365` / `#14A38F` | mshell `--teal-600/500`, `--h-teal`, hero gradient | `mobile-shell.css:14` |

`emerald-*` files (verified by grep): `contexts/CompatibilityContext.js`, `app/chronic/page.js`, `app/core-engine/{chronic,usg,mfr,mental,story}/page.js`, `app/invite/[token]/page.js`.

### The two pinks

`--pink #DE457D` (System A, `globals.css:31`) vs the mshell magenta ramp `#DC2A76` / `#B8175F` / `#8E1049` (`mobile-shell.css:15`). The darkest, `--mag-700 #8E1049`, matters for accessibility — it's the AA‑passing fill you must use when white text sits on pink (§10).

> **Root cause (UX4‑02, P2):** the brand hue is referenced **4+ ways with no single source of truth** — `var(--teal)` (~29 files), `emerald-*` (28), `var(--primary)` (`error.js`, `usg/page.js`, `db/page.js`), and bare `#18CC96` literals (`story/page.js`, `invite/[token]/page.js:387`, `mentalHealthQuestions.js:48`). Pink splits across `var(--pink)`, `#DE457D`, `var(--magenta)`, and the mshell `--mag-*`. This is guaranteed to recur on any new screen until the tokens are collapsed.

---

## 2. How styling is actually applied

Three mechanisms are in play, often mixed in a single component. You need to know all three and when to reach for each.

```
  ┌─────────────────────── frontend/src/app/layout.js ───────────────────────┐
  │  import "./globals.css";        ← System A tokens + Tailwind + fonts      │
  │  import "./mobile-shell.css";   ← System B tokens (MUST be imported 2nd)  │
  └───────────────────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
   :root { --teal … }                  .mshell { --teal-600 … }
        │                                    │
   consumed via                        consumed via className that
   var(--x) + inline style={}          mobile-shell.css styles + inline
        │                              CSS vars (--tint/--hue/--status)
        │
   ── AND ── raw Tailwind utilities (emerald-500, rounded-xl) pull
             Tailwind's DEFAULT palette because :root is NOT wired
             into Tailwind's theme (no @theme block).
```

### Tailwind v4 is CSS‑first, with no config and no `@theme`

- `frontend/postcss.config.mjs` (7 lines) registers exactly one plugin: `'@tailwindcss/postcss': {}`. **There is no `tailwind.config.js`.**
- `globals.css:2` does `@import "tailwindcss";` — that's the whole Tailwind wiring.
- **Critically, there is no `@theme` block anywhere.** In Tailwind v4 the theme is declared CSS‑first inside `@theme { … }`; without it, your `:root` custom properties are **invisible to Tailwind's utility generator**. So `bg-primary`, `text-teal`, `bg-pink` **do not exist as utilities**. A dev who wants "the brand green" as a class has no branded utility to reach for and types `bg-emerald-500` instead — which is the structural reason the green fragments (§1, UX4‑01).

**Guidance for the successor:**
- Inside a `.mshell` surface (mobile) → use the mshell class names and thread section hues via inline CSS vars. Don't introduce Tailwind colour utilities there.
- On System‑A surfaces (desktop/report/wizard/auth) → prefer `var(--teal)` / `var(--pink)` inline over `emerald-*`. Every `emerald-*` you add deepens UX4‑01.
- The real fix (deferred, doc 21) is to add an `@theme` block that maps the brand tokens into Tailwind so `bg-primary` etc. exist and there's one source of truth.

`MeasurementSlider.js` is the canonical example of the three‑mechanism mix in one small component: a CSS‑Module class (`styles.measurementSlider`), raw Tailwind utilities, **and** inline `var(--teal)`/`var(--ink)` + a `--fill-pct` custom property — all at once.

---

## 3. The complete design‑token reference

### System A — `globals.css :root` (`globals.css:5-76`)

| Token | Value | Notes |
|---|---|---|
| `--background` / `--paper` | `#F7F8FA` | cool page bg |
| `--foreground` / `--ink` | `#14161A` | primary text |
| `--primary` / `--teal` / `--success` | `#18CC96` | "Primary teal brand color" (comment) |
| `--primary-hover` / `--teal-d` | `#0FA377` | hover / text‑bearing teal |
| `--soft-teal` | `#E3F9F0` | tint |
| `--pink` / `--magenta` | `#DE457D` | brand pink (fails AA on white text — §10) |
| `--pink-d` | `#B8305F` | darker pink |
| `--soft-pink` | `#FCE8EF` | tint |
| `--amber` / `--warning` | `#F4A100` | caution |
| `--amber-d` | `#A66C00` | text‑bearing amber |
| `--soft-amber` | `#FEF1DA` | tint |
| `--danger` / `--error` | `#E0555B` | error |
| `--danger-d` / `--red-d` | `#A83338` | text‑bearing danger |
| `--info` | `#185FA5` | info blue |
| `--muted` | `#5B6472` | secondary text |
| `--line` | `#E7E9EE` | hairline border |
| `--surface` | `#FFFFFF` | card bg |
| `--gradient-primary` | `linear-gradient(135deg,#DE457D 0%,#18CC96 100%)` | pink→teal brand gradient |
| `--glass-bg` | `rgba(255,255,255,.7)` | frosted glass |
| `--glass-border` | `rgba(20,22,26,.08)` | glass edge |
| `--glass-shadow` | `0 8px 32px 0 rgba(20,22,26,.06)` | glass shadow |

**Radius (System A):** `--radius-sm:8px` / `--radius-md:10px` / `--radius-lg:12px` / `--radius-pill:999px` (`globals.css:55-58`).

**USG health‑status colours** (`globals.css:61-65`) — `[interim]` clinical severity mapping, house values pending clinical review: `--color-normal:#10b981` · `--color-mild:#f59e0b` · `--color-moderate:#f97316` · `--color-severe:#ef4444` · `--color-not-assessed:#6b7280`.

**USG partner colours** (`globals.css:68-69`): `--partner-a:#14b8a6` · `--partner-b:#8b5cf6`.

**Organ accents** (`globals.css:72-75`): `--liver-color:#854d0e` · `--kidney-color:#1d4ed8` · `--ovary-color:#be185d` · `--prostate-color:#1e40af`.

### System B — `mobile-shell.css .mshell/.mnav` (`mobile-shell.css:9-33`)

| Group | Tokens |
|---|---|
| Neutrals | `--bg:#F2F0EB` · `--bg-soft:#FBFAF8` · `--card:#FFFFFF` · `--ink:#0E1513` · `--ink-2:#414D49` · `--ink-3:#79847F` · `--line:rgba(14,21,19,.09)` · `--line-2:rgba(14,21,19,.05)` |
| Teal ramp | `--teal-900:#052A26` · `--teal-800:#083E37` · `--teal-700:#0A554C` · `--teal-600:#0D7365` · `--teal-500:#14A38F` |
| Magenta ramp | `--mag-700:#8E1049` · `--mag-600:#B8175F` · `--mag-500:#DC2A76` |
| Glass/shadow | `--glass:rgba(255,255,255,.76)` · `--glass-line:rgba(14,21,19,.07)` · `--shadow-s` · `--shadow-m` |
| Radius | `--r:20px` · `--r-lg:26px` |
| Fonts | `--m-serif:'Source Serif 4',…` · `--m-sans:'Hanken Grotesk',…` |

### The five section triples (`mobile-shell.css:17-24`)

Each health section carries a **tint** (`--t-*`, background), a **hue** (`--h-*`, text/icon at accessible depth), and a **ring hue** (`--r-*`, the bright stroke used by the gauge/mini‑ring). These are threaded from JS into the CSS via inline vars `--tint` / `--hue` / `--status` / `stroke: var(--r-${tone})`.

| Tone | Tint `--t-*` | Hue `--h-*` | Ring `--r-*` | Section identity |
|---|---|---|---|---|
| `mag` | `#FBE1EC` | `#B8175F` | `#FF7DAE` | About You / brand / nav |
| `teal` | `#DCF0EB` | `#0D7365` | `#3FE0C1` | Lifestyle / verified data |
| `sea` | `#DEEAF5` | `#2E6F9E` | `#71C7F2` | (blue) |
| `moss` | `#DEF0E3` | `#2F7A46` | `#6FD98F` | (green) — also `statusToneFor` "done" |
| `gold` | `#F8EED9` | `#A9711A` | `#F3C572` | — also `statusToneFor` "in progress" |
| `mute` | `rgba(14,21,19,.05)` | `#79847F` | — | neutral/disabled |

> **Gotcha:** a bad `tone` string yields an **invisible arc/dot**, not an error — `var(--r-xyz)` simply resolves to nothing. Tone must be one of the five `--r-*` / `--h-*` keys.

### The four radius vocabularies (UX4‑03, P2)

| System | Values | Reality |
|---|---|---|
| System A tokens | `8 / 10 / 12 / 999` | barely consumed |
| Tailwind defaults | `rounded-lg 8px`, `rounded-xl 12px`, `rounded-2xl 16px` | **dominant** — `rounded-xl` appears ~116×, `rounded-lg` ~38× |
| mshell | `--r:20px` / `--r-lg:26px` | mobile cards |
| `.glass-panel` | hardcoded `16px` | `globals.css:151` |

`--radius-md:10px` is an **orphan** — it matches no Tailwind step and is essentially unused. The same conceptual "card" is 16px on desktop and 20–26px on mobile.

---

## 4. Typography

Two real UI fonts, delivered via a single render‑blocking `@import`; several dead or never‑loaded font declarations layered around them.

| Font | Role | How applied | Loaded? |
|---|---|---|---|
| **Hanken Grotesk** (300–800) | UI / body — everything not a display heading | `--font-sans` (System A) / `--m-sans` (mshell) | ✅ Google Fonts `@import` (`globals.css:1`) |
| **Source Serif 4** (opsz 8..60, incl. italics) | Display / headings / narrative prose | `--font-serif` / `.serif` (System A) / `--m-serif` / `.mshell .serif` (`mobile-shell.css:64`) | ✅ same `@import` |
| Geist / Geist_Mono | — (intended, **dead**) | `next/font/google` → `--font-geist-sans/-mono` on `<html>` | Loaded but **consumed by nothing** |
| Newsreader / Inter | dev‑route "paper" theme | `chronic/page.module.css:5,20`, `mfr/page.module.css` | ❌ never loaded → falls back to Georgia / system‑ui |
| Times New Roman | `.latexDoc` academic theme | `page.module.css` `.latexDoc` | ❌ (relies on OS font) |

### The render‑blocking delivery (UX4‑05, P3)

`globals.css:1` is a `@import url('https://fonts.googleapis.com/css2?…')` for both real fonts. This is **render‑blocking**, and if the Google Fonts CDN is slow or blocked, the *entire app* silently falls back to `system-ui` / Georgia. Meanwhile `layout.js:9-17` loads Geist/Geist_Mono via `next/font/google`, binds them to `--font-geist-sans/-mono` on the `<html>` element (`layout.js:36`) — and **nothing consumes those variables**. A runtime probe confirms `document.fonts.check('16px "Geist"') === false` in practice: dead weight shipped on every page.

> **Recommended fix (deferred):** delete Geist, self‑host Hanken + Source Serif via `next/font/google` (which gives you `display:swap` + preloading and removes the third‑party render‑block), and drop the `@import`. See doc 21.

The `.serif` class is the switch that opts a block into Source Serif 4 — used for headline numerals (`.mshell .gauge-n serif`), the narrative "story" prose (`mobile-shell.css:293`), and display headings.

---

## 5. The mobile‑shell design language

`mobile-shell.css` (387 lines) is the **entire mobile look**, ported *verbatim* from `contexts/ui_mobile_update.html` — that HTML mockup is the **source of truth** for the mobile reference. The file header (`mobile-shell.css:1-7`) says so explicitly. Device‑frame chrome (phone bezel/island/status bar) from the mockup is intentionally dropped — "the real device is the frame."

### Scoping model

Everything is scoped under two class names so the generic names (`.card`, `.pill`, `.row`, `.tile`) never leak into the rest of the app or collide with Tailwind:

- `.mshell` — page content. Activated by a component rendering `<div className="mshell" data-mtheme="light">`. Three mount points: `dashboard/MobileHomeView.js:72`, `profile/page.js:206`, `add-prospect/page.js:1756`.
- `.mnav` — the floating bottom tab bar (`MobileBottomNav.js`), a separate scope that also carries the tokens (`mobile-shell.css:9`).

### `data-mtheme` mechanism

The `data-mtheme` attribute on the shell root is what *would* switch light/dark (§6). Today all three mounts hardcode `="light"`.

### The primitive inventory

| Primitive | Class | Anchor |
|---|---|---|
| Sticky glass app bar + avatar | `.appbar` / `.av` | `mobile-shell.css:80-93` |
| Signature weighted‑gauge hero | `.hero` / `.gauge` / `.g-fill` / `.g-legend` | `119-161` |
| Match band (pink CTA) | `.match` / `.m-go` | `164-182` |
| Section list rows | `.list` / `.item` / `.row` / `.tile` / `.bar` | `205-231` |
| Mini progress ring | `.mring` / `.mr-f` | `199-202` |
| "Care" dark card | `.care` | `234-245` |
| Progress‑to‑target bar | `.target` / `.tbar` | `255-263` |
| Analysis big ring + dims | `.bigring` / `.dim` | `269-289` |
| AI chat bubbles + composer | `.bub` / `.qchip` / `.composer` | `303-315` |
| Profile head + plan card | `.phead` / `.plan` / `.plist` | `318-339` |
| Bottom tab bar | `.mnav` / `.tab` / `.fab` | `342-371` |
| Paper grain overlay | `.grain::after` (inline SVG noise) | `72-77` |

The `.mshell` scope also redefines `:focus-visible` locally (`mobile-shell.css:69`, `outline:2px solid var(--h-teal)`) — a darker‑teal ring than the global one (§10).

---

## 6. Dark mode status — authored but dead (UX4‑04, P2)

The mobile shell ships a **complete, well‑considered dark palette** (`mobile-shell.css:35-52`) — dark neutrals, inverted tints, brightened hues, adjusted shadows. It **can never activate**:

```
@media (prefers-color-scheme: dark) {
  .mshell[data-mtheme="auto"], .mnav[data-mtheme="auto"] { … dark tokens … }
}
        ▲                              ▲
        │                              └── requires data-mtheme="auto"
        │
   BUT all 3 mounts hardcode data-mtheme="light":
     MobileHomeView.js:72 · profile/page.js:206 · add-prospect/page.js:1756
```

So the dark block is gated on `[data-mtheme="auto"]` **AND** `prefers-color-scheme: dark`, and the first condition is never met. Separately, **`globals.css` has no `prefers-color-scheme` rule at all** — the System‑A (desktop/report/wizard/auth) surfaces are light‑only with no dark palette authored.

> **Do not assume changing the OS theme does anything.** The decision the successor owes: either **wire it up** (flip the three mounts to `data-mtheme="auto"` and author a `globals.css` dark palette — low effort for the mobile half since the palette already exists) **or delete the dead block** so it stops implying a feature that isn't there. Documented for the roadmap in doc 21.

---

## 7. Signature visualization formulas

These three are the product's visual identity on mobile. Cross‑ref doc 16 for how they're fed data; the formulas themselves are canonical here.

### WeightedGauge (`components/mobile/WeightedGauge.js`)

A multi‑arc donut where each arc's **length encodes a section's weight** and its **fill encodes real progress**, colored by the section's ring hue, with an animated count‑up centre percentage and a wrapping legend.

| Constant | Value | Anchor |
|---|---|---|
| `R` (radius) | `54` | `WeightedGauge.js:8` |
| `C` (circumference) | `2 * Math.PI * R` | `:9` |
| `GAP` (inter‑arc gap) | `16` | `:10` |
| per‑section arc length | `len = (s.weight/100) * C` | `:44` |
| visible track segment | `seg = Math.max(len - GAP, 2)` | `:45` |
| dash offset | `off = -(start + GAP/2)` | `:46` |
| fill length | `fill = Math.max((seg * s.pct)/100, 1)` | `:52` |
| stroke colour | `var(--r-${s.tone})` | `:55` |
| count‑up easing | `Math.round(target * (1 - Math.pow(1 - p, 3)))` (cubic ease‑out) | `:22` |

Honors `prefers-reduced-motion` by zeroing the animation duration (`WeightedGauge.js:16-21`). The `sections` array is in **journey order** (About → Lifestyle → Mental → Pathology → Radiology); the legend (`:84-92`) re‑labels each arc with its weight because a QA reviewer read the biggest slice (Pathology 35% **[interim]** weight) as "first" — the legend fixes the misread without changing the weight encoding. Note: the section weights themselves are `[interim]` house values (their canonical home is the scoring docs, doc 09/10).

### MobileMiniRing (`components/mobile/MobileMiniRing.js`)

Small stroked progress ring for recent‑match score / section completion.

| Constant | Value | Anchor |
|---|---|---|
| `r` | `17` | `MobileMiniRing.js:14` |
| `c` | `2 * Math.PI * r` | `:15` |
| done threshold | `Math.round(pct) >= 100` → renders a **checkmark** | `:17-18,26-27` |
| stroke colour | `var(--h-${tone})` | `:23` |

Prefers a concrete `answered/total` centre label (e.g. "20/21") over an abstract `%` when the caller passes counts (`:28-31`) — a tangible number of fields left reads better than a percentage. The checkmark exists because "100%" is wider than the ring's clear inner space at this font size, and the mockup's demo data never actually reached 100%.

### statusToneFor (`components/mobile/MobileSectionList.js:20-22`)

```
statusToneFor(pct) = pct >= 100 ? 'moss' : 'gold'   // green when done, amber in progress
```

**Deliberately decoupled** from section‑identity tone. The icon tile uses the section's own identity hue (`--t-${s.tone}` / `--h-${s.tone}`), but the completion ring/bar uses this separate status tone — so a finished "About You" card stops showing a magenta/red ring that read as an *error* rather than *success* (`MobileSectionList.js:11-19` comment). `RowEnd` (`:24-29`) renders: Locked pill / "Notify me" ghost / mini‑ring (when `pct > 0`) / neutral "Start" pill (when `0%`).

> **The desktop reinvention problem (UX4‑07/08/09/10/11, P1):** desktop does **not** responsively reflow these — it reimplements each as a different one‑off. Mobile weighted arc‑gauge → desktop flat progress bar (UX4‑07); mobile mshell profile hub → desktop raw edit form (UX4‑09); stroked mini‑ring → flat filled chip (UX4‑10); mshell gradient rounded‑square avatar → flat pink circle (UX4‑11). The decided direction is **one‑directional: reconcile desktop toward mobile** (doc 17), ideally by componentising these primitives (OPP‑UX‑W4‑3).

---

## 8. The two icon systems

| System | What | Where used | Anchor |
|---|---|---|---|
| **`Ico.js`** (custom) | Hand‑rolled SVG sprite, 30 line icons (stroke 1.7), ported from the mockup | **`.mshell` surfaces only** — MobileHomeView, profile, add‑prospect, MobileSectionList, MobileBottomNav | `components/mobile/Ico.js` |
| **`lucide-react`** | Third‑party icon set | **App‑wide** — 42 files (everything else) | e.g. `mentalHealthQuestions.js:30` |

`Ico.js` renders `<svg viewBox="0 0 24 24">{PATHS[name]}</svg>` and returns **`null` for an unknown name** (`Ico.js:41`) — no fallback glyph, so a typo silently vanishes. The 30 names: `home, clip, chat, chart, user, gear, bell, chev, down, arrow, check, pencil, lock, pulse, mind, flask, scan, dna, shield, clock, heart, plus, dl, share, send, globe, file, out, trash`. Styling comes from `.mshell .ico` / `.ico.sm` (`mobile-shell.css:66-67`) and `.mnav .ico` (`:353`).

**Convention:** match the surface. Editing a mobile‑shell screen → use `Ico` (and add a path to the sprite if you need a new glyph). Anywhere else → `lucide-react`. Don't mix them within one surface.

---

## 9. CSS‑file inventory and cascade

### Import order is load‑bearing

`layout.js:2-3` imports `globals.css` **then** `mobile-shell.css`. This order matters: `mobile-shell.css`'s unconditional `.mnav` rule and Tailwind's `lg:hidden` utility (also carried by `MobileBottomNav`) have **equal selector specificity**, so whichever is later in source order wins. Because mobile‑shell is imported second, the bottom nav was silently staying visible at desktop widths — which is why `mobile-shell.css:380-382` adds an **explicit** `@media (min-width:1024px){ .mnav{ display:none } }`. The long comment at `mobile-shell.css:373-379` documents this belt‑and‑suspenders. Don't reorder the imports.

### Stylesheet inventory

| File | Scope | LOC | Notes |
|---|---|---|---|
| `app/globals.css` | global (System A) | ~220 | tokens, focus ring, `.wizard-bg`, `.brand-scroll`, `.glass-panel`, `.cta-gradient-pink`, `.reveal` |
| `app/mobile-shell.css` | `.mshell`/`.mnav` (System B) | 387 | the whole mobile language |
| `app/page.module.css` | route module | ~1071 | landing/auth/onboarding/portal **+ two legacy off‑brand themes** |
| `components/ReportChatDrawer.module.css` | module | ~324 | AI chat drawer; **copies the mshell bubble gradient by value** |
| `components/wizard/wizard.module.css` | module | 38 | **only** the `.measurementSlider` control |
| `app/chronic/page.module.css` | dev route | ~698 | "paper" theme; requests never‑loaded Newsreader/Inter |
| `app/mfr/page.module.css` | dev route | — | mirror of chronic |

### Orphaned / legacy off‑brand stylesheets (a third+ colour vocabulary)

- **`page.module.css`** carries its **own hardcoded hex palette** — `#28c79a`, `#d94386`, `#007A8C`, `#0f766e` — matching neither System A nor B. It includes a `.latexDoc` Times‑New‑Roman "academic" theme (`page.module.css:299+`) and legacy dark‑glass dropzone blocks that assume a dark background the light app no longer has. Do **not** treat these as canonical.
- **`chronic/page.module.css` / `mfr/page.module.css`** are the bare dev routes `/chronic`, `/mfr` — orphaned dev tools duplicated under `/core-engine`. The decided direction (doc 17) is to **delete the duplicate engine pages** (`/chronic`, `/mfr`, `/usg`) and re‑home `/db` behind the `ADMIN_PHONE_NUMBERS` allowlist — a separate code change, not yet done.
- **`ReportChatDrawer.module.css:118`** references `public/questionare_backdrop.png` and (per the map) copies the mshell `.bub.me` user‑bubble gradient `linear-gradient(150deg,#0D7365,#083E37)` literally rather than via a shared token — visual coupling with no code coupling.

> **Load‑bearing filename gotcha:** the backdrop asset is `public/questionare_backdrop.png` — the misspelling "questionare" is **intentional/referenced** by both `globals.css:116` (`.wizard-bg`) and `ReportChatDrawer.module.css:118`. Don't "fix" the spelling without updating both stylesheets.

---

## 10. Accessibility & contrast constraints

### The AA contrast failure — `--pink` on white text (UX6‑07, P2)

White text on `--pink #DE457D` measures **4.0:1** — below the WCAG AA 4.5:1 minimum for normal text. It appears on:
- the report sidebar's active nav pill ("Partner Sync", `core-engine/layout.js:206-209`), and
- the shared wizard's pink‑variant hero CTA (`QuestionScreen.js:46-49,172-176`, used for the single "hero" button style).

**The token itself is too light.** The fix is **not** to darken `--pink` globally (it's fine as a decorative fill) but to use the mshell **`--mag-700 #8E1049`** for any pink surface that *bears white text*. Remember this whenever you build a new pink CTA.

### Colour‑only signalling (UX6‑05/06/08, P2)

Several states are conveyed by colour alone, invisible to colour‑blind users and screen readers:
- **USG organ health status** — an 8px dot colored `--color-normal/mild/moderate/severe` with **no text or icon label** (UX6‑08). Add a text/icon label.
- **Bottom‑nav active state** — `.mnav .tab.on{ color:var(--h-mag) }` (`mobile-shell.css:356`) is functionally colour‑only and **never exposes `aria-current`** (UX6‑06).
- **Chronic biomarker severity dot** — its text label lives only in a hover `title` attribute (UX6‑08).

### Tap targets (UX5‑06, P2)

No shared minimum tap‑target height. Observed: report nav rows 208×36, wizard back arrow 32×32, hub back‑link 86×19 — all short of the ~44px guideline — versus the bottom nav's correct 91×62. `.mnav .tab.disabled` uses `opacity:.42` (the Analysis tab, `mobile-shell.css:360`) and is kept **tappable‑not‑inert by design** (a tap explains why it's not yet available; intentionally *not* `aria-disabled`).

### What is already FIXED — the global focus ring (closed UX6‑01)

`globals.css:103-107` is a **true global** `:focus-visible { outline:2px solid var(--teal-d); outline-offset:2px; border-radius:8px; }`. This was promoted from the mshell‑local ring because the login/onboarding/add‑prospect field inputs and `wizard.module.css` both strip the native outline and weren't wrapped in `.mshell`, so no ring covered them. Every focusable element now gets a visible ring regardless of shell. **Don't reintroduce an outline‑stripping rule without a replacement.**

---

## 11. The reconciliation backlog

These are the open review‑corpus findings that own this area. Doc 21 is the authoritative ledger; this is a pointer list.

| ID | Sev | One‑liner |
|---|---|---|
| UX4‑01 | P1 | Brand teal is three greens across two palettes + Tailwind emerald |
| UX4‑02 | P2 | Brand hue referenced 4+ ways, no single source of truth |
| UX4‑03 | P2 | Four fragmented radius vocabularies; `--radius-md:10px` orphan |
| UX4‑04 | P2 | Dark mode authored (`mobile-shell.css:35-52`) but dead behind hardcoded `data-mtheme="light"` |
| UX4‑05 | P3 | Render‑blocking `@import` fonts + dead Geist `next/font` |
| UX4‑06 | P3 | Two‑colour brand semantic diluted where teal/magenta become 2‑of‑5 section hues (observation, deliberate) |
| UX4‑07/08/09/10/11/12 | P1/P2 | Desktop is a parallel design, not a responsive reflow — reconcile desktop→mobile |
| UX6‑07 | P2 | White‑on‑`--pink` text = 4.0:1, fails AA (use `--mag-700`) |
| UX6‑05/06/08 | P2 | Colour‑only severity signalling (USG dot, nav active, chronic dot) |
| UX5‑06 | P2 | No shared minimum tap‑target height |
| UX6‑01 | — | **FIXED** — global `:focus-visible` at `globals.css:103` |

---

## Open items (see doc 21 for the authoritative list)

- **Collapse the palettes / wire Tailwind.** Add a `@theme` block mapping the brand tokens so `bg-primary`/`text-teal` exist, reconcile System A + mshell into one green and one pink, and stop the `emerald-*` leakage (UX4‑01/02). This is the root cause that makes every new screen diverge.
- **Decide dark mode: wire or delete.** The mshell dark palette is complete but permanently dead; `globals.css` has none. Either flip the three mounts to `data-mtheme="auto"` + author a System‑A dark palette, or remove the dead block (UX4‑04).
- **Fix the AA fail before shipping any new pink CTA.** White‑on‑pink is 4.0:1 — use `--mag-700` for text‑bearing pink fills, and add text/icon labels to colour‑only severity states (UX6‑07, UX6‑05/06/08).
- **Font delivery + dead weight.** Self‑host Hanken + Source Serif via `next/font`, drop the render‑blocking `@import`, delete unused Geist (UX4‑05).
- **Orphaned dev‑route stylesheets.** `/chronic`, `/mfr`, `/usg` page modules (and the `.latexDoc`/legacy blocks in `page.module.css`) carry a third off‑brand palette; slated for deletion alongside the `/db` re‑home (doc 17).

---

*Next: `17_frontend_web_desktop_status_and_gaps.md` — what remains on the web/desktop surface and the reconcile‑to‑mobile backlog you now know the design language for.*
