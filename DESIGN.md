# Muhurtham · Design

How the Muhurtham web app looks and behaves, and the rules for keeping it consistent.
Read this before adding or changing a page in `webapp/`.

- **Scope:** the web app (`webapp/`). The Flutter app (`frontend/`) is not covered here.
- **Source of truth:** `webapp/css/variables.css`. If this file and the CSS disagree, the CSS wins; update this file.
- **Background:** the Experience Plan (steps U1 and U2) set the shared header, tokens, icons and states described below.
- **Unfamiliar words:** see the glossary in section 12.

**Contents**
1. Principles
2. Pages and who sees them
3. Design tokens
4. Layout
5. Components
6. Copy-paste markup
7. The Muhurta Finder result card
8. Writing and wording
9. Do and don't
10. Accessibility, print and sharing
11. Conventions for changes
12. Glossary
13. Known gaps

---

## 1. Principles

1. **Traditional, calm, readable.** Maroon and gold on warm ivory, like a printed panchangam. No gradients, glow or decorative animation.
2. **Bilingual by default.** Every label exists in English and Telugu. Telugu is not an afterthought: it gets its own font, line height and spacing rules.
3. **Colour has one meaning everywhere.** Green means it passes or is good, amber means caution, red means it fails or is avoided, and purple means a remedy (pariharam). Never use these colours for decoration.
4. **Show, don't hide.** The Muhurta Finder lists a window even when a dosha fails, marked "not matched" and with a lower percentage. The design must make the failed checks clear rather than drop the window.
5. **Explain the result.** A score or verdict always comes with its reasons: which checks passed, which failed, and the book rule behind each.
6. **Ask only for what is needed.** Required details are asked for once, in one dialog. Optional details never produce warnings.
7. **No browser pop-ups.** Use `AppShell.toast` and `AppShell.confirm`, never `alert()` or `confirm()`.
8. **Desktop web first.** Pages must not break on a narrow window, but there is no separate phone layout. The mobile plan was dropped.

---

## 2. Pages and who sees them

There are three roles: **user**, **admin** and **super admin**.
The header links come from the `NAV` list in `js/auth.js`. The server enforces the same rules, so hiding a link is not the security boundary.

### 2.1 Everyone signed in

| Page | File | Purpose | Main parts |
|---|---|---|---|
| Home (users only) | `home.html` | Start page | Greeting, announcements, Today card with share bar, quick "Find a muhurta" form, shortcut tiles |
| Panchang | `panchang-lookup.html` | Panchang for any date and place | Day tab (limbs, kalas, lagna schedule, special yogas), Month tab (calendar; clicking a day shows its details), share bar |
| Muhurta Finder | `muhurta-finder.html` | Find muhurtas for an event | Mode switch: "Find for a person" (person cards, one year with load-more) and "Muhurtas by month" (event, year, lunar months, place; no personal details). Cards / Compact list view, summary filters, detail modal. Also Special Yogas (`#yogas`) and the Shraddha calendar (`#pitru`) |
| My family | `family.html` | Saved people (birth details encrypted) | Person list, add/edit form, nakshatra from a name |
| My muhurtas | `saved.html` | Saved searches and muhurtas | Starred items first, "Run again" |
| My account | `account.html` | Profile, home place, devices | Opened from the account menu, not from the header links |
| Sign in | `login.html` | Log in or create an account | Mobile number and OTP. No header links |

### 2.2 Admin and super admin

| Page | File | Who | Purpose |
|---|---|---|---|
| Dashboard | `admin.html` | Admin, super admin | Replaces Home: "People and use", "Needs attention", "Recent activity", shortcut tiles |
| Users | `admin-users.html` | Admin, super admin | Search, disable or enable accounts |
| Content | `admin-content.html` | Admin, super admin | Omen calendar (utpata) and announcements |
| Muhurtas | `admin-muhurtas.html` | Super admin | Hide or show tabs and events |
| Statistics | `admin-stats.html` | Super admin | Use over a chosen period |
| Settings | `admin-settings.html` | Super admin | App settings, admins, alerts, audit log |

- **Admin pages** sit under the "Admin" group in the header and show a breadcrumb ("Dashboard › Users").
- **Alert bell:** shown to the super admin only.
- **New pages:** a page appears in the header only once its file is in the `BUILT` list in `js/auth.js`.

### 2.3 Adding a page

1. Copy the page frame from 6.1.
2. Add it to `NAV` (with `roles` and, for admin pages, `group: "admin"`) and to `BUILT` in `js/auth.js`.
3. Give it a `<title>` in the form `Name · Muhurtham`.
4. Add its row to the table above.

---

## 3. Design tokens

All tokens are in `webapp/css/variables.css` and are loaded through `common.css`.
**Use tokens; never hand-write hex values, shadows or font sizes in page CSS.**

### 3.1 Colour

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#6f1725` (maroon) | Primary buttons, selected chips |
| `--color-primary-strong` | `#4d0d17` | Brand, titles, links, hover of primary |
| `--color-accent` | `#b98219` (marigold) | Eyebrow labels, highlights. Use sparingly |
| `--color-bg` | `#fbfaf8` (ivory) | Page background |
| `--color-surface` | `#ffffff` | Cards, panels, dialogs |
| `--color-surface-muted` | `#f5f1ea` | Quiet cards, hover rows, current nav item |
| `--color-text` | `#211a18` | Body text |
| `--color-text-muted` | `#655c57` | Hints, secondary text, footers |
| `--color-border` | `#ded6cc` | All borders and dividers |
| `--color-on-strong` | `#ffffff` | Text on maroon, red or green fills |

**Status colours.** Each comes as a set: text, background tint and border.

| Meaning | Text | Background | Border |
|---|---|---|---|
| Good / passes | `--color-success` `#1f7a45` | `--color-success-bg` | `--color-success-border` |
| Caution / partial | `--color-warning` `#a65b00` | `--color-warning-bg` | `--color-warning-border` |
| Bad / fails / avoid | `--color-danger` `#b42318` | `--color-danger-bg` | `--color-danger-border` |
| Information | `--color-info` `#175cd3` | `--color-info-bg` | `--color-info-border` |
| Remedy (pariharam) | `--color-remedy` `#6a1b9a` | `--color-remedy-bg` | `--color-remedy-border` |

- **Status box:** the tint is the background, the border token is the border and the strong colour is used for the title or badge.
- **Remedy colour:** purple on purpose, so that a remedy is not read as good or bad.
- **Legacy aliases:** `--maroon`, `--gold`, `--ivory`, `--ink`, `--line`, `--good`, `--bad` and similar still exist while older pages are migrated. Don't use them in new code; use the `--color-*` names.

### 3.2 Typography

| Token | Value |
|---|---|
| `--font-sans` | Outfit, Inter, system sans |
| `--font-telugu` | Noto Sans Telugu, Outfit, Georgia |
| `--text-xs` / `sm` / `base` / `lg` / `xl` / `2xl` | 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 rem |

- **Fonts:** every page loads Outfit, Inter and Noto Sans Telugu from Google Fonts (see 6.1).
- **Brand mark:** "ముహూర్తం" uses `--font-telugu`, weight 800, in `--color-primary-strong`.
- **Page titles:** `--color-primary-strong`, using `clamp(1.5rem, 3vw, 2rem)` on portal pages.
- **Section titles:** about 1.1rem in `--color-primary-strong`.
- **Small labels:** English eyebrow labels are uppercase with letter spacing. Telugu text never gets letter spacing.
- **Weights:** 400 for body, 600 or 700 for labels and buttons, 800 only for the brand and the avatar initial.
- **Numbers:** use `font-variant-numeric: tabular-nums` for times and percentages in lists so the columns line up.

**Telugu rules** (in `base.css`, keyed on `html[lang="te"]`):
- body line height 1.75; labels, buttons and chips 1.6;
- `letter-spacing: normal` on everything, because spacing letters apart breaks Telugu words;
- Telugu text runs about 20–40% wider than English. Leave room in buttons and chips, and never give them a fixed width.

### 3.3 Spacing, radius and elevation

| Group | Tokens |
|---|---|
| Spacing | `--space-1` 4px · `2` 8px · `3` 12px · `4` 16px · `6` 24px · `8` 32px · `12` 48px |
| Radius | `--radius-sm` 4px (buttons, nav items) · `md` 8px (cards, inputs, menus) · `lg` 14px (dialogs) · `pill` (chips, badges) |
| Shadow | `--shadow-sm` (resting card) · `md` (hover, menus, toasts) · `lg` (dialogs). All are maroon-tinted |

**Spacing rhythm:**
- `--space-1` or `2` inside a chip or between an icon and its text;
- `--space-3` between fields in a form;
- `--space-4` inside a card;
- `--space-6` between sections of a page.

There is no `--space-5`; one rule uses it with a 20px fallback. Prefer `--space-4` or `--space-6`.

---

## 4. Layout

### 4.1 Page frame

Every signed-in page has the same frame:
- the skip link;
- the header (brand, links, language switch, account menu);
- `<main id="mainContent">`.

The full markup is in 6.1.

- **Header contents:** `js/auth.js` fills the nav links, the "Admin" group, the account menu and the super admin's alert bell. Don't hand-write nav links in a page.
- **Breadcrumb:** admin pages show "Dashboard › Users" with `.crumbs`.
- **Print:** the header and breadcrumb are hidden when printing.

### 4.2 Widths

| Container | Max width | Used on |
|---|---|---|
| `.portal`, header | 1120px | Home, account, family, saved, admin pages |
| `.portal--narrow` | 44rem | Single-form pages |
| `.wrap` | 660px | Older single-column pages |

- **Side padding:** `--space-4`.
- **Tile grids:** `repeat(auto-fit, minmax(13rem, 1fr))`, so tiles reflow without breakpoints.
- **Forms:** keep a single form column to 26rem or less (`.portal-form`). Long lines of inputs are hard to scan.

### 4.3 Breakpoints

There is no breakpoint scale. Existing rules use 640px (header and portal), 600px and 520px (finder), 560px (month calendar) and 480px (cards).
New rules should use **640px**, and only to stop overflow. No phone-specific layouts.

### 4.4 Order of a page

Top to bottom:
1. **Title:** what this page is.
2. **One line of help, if needed:** what the user can do here.
3. **The main action:** a form, search or list.
4. **Results or content.**
5. **Secondary or "coming soon" content:** use `.portal-card--quiet`.

---

## 5. Components

Shared components live in `webapp/css/components.css`. Page-specific ones are in `muhurta-finder.css`, `panchang.css`, `panchang-month.css`, `dashboard.css` and `portal.css`.
Reuse these before writing a new class. Ready-to-copy markup is in section 6.

### 5.1 Actions

| Class | Use |
|---|---|
| `.btn` | Base shape, padding and states only. Always add a colour variant |
| `.btn--primary` / `.btn--maroon` | Main action (maroon fill). One per form or section |
| `.btn--gold` | Highlighted action (marigold fill). At most one per view |
| `.btn--ghost` | Transparent button; its hover is made for dark or maroon backgrounds |
| `.btn--sm`, `.btn--block` | Size and full-width modifiers |
| `.app-dialog__btn` (`--primary`, `--danger`) | Buttons inside the confirm dialog only |
| `.lang-btn` in `.lang-toggle` | English / తెలుగు switch |
| `.share-bar` + `.share-bar__btn` | PDF · Image · Text row (Panchang month panel, Today card) |
| `.filter-chip`, `.view-btn` | Toggle filters and view switches. Set `aria-pressed` |

**Button labels** say what happens: "Find muhurtas", "Save person", "Run again". Not "Submit", "OK" or "Go".

### 5.2 Containers

| Class | Use |
|---|---|
| `.portal-card` | Main section card on portal pages |
| `.portal-card--quiet` | Muted card for hints and "coming soon" notes |
| `.portal-tile` in `.portal-grid` | Shortcut links on Home and the Dashboard |
| `.card` in `.grid` | Label/value tiles (panchang limbs) |
| `.detail-card` + `.detail-card__title` | Titled block inside a result or modal |
| `.modal-overlay` / `.modal-content` | Large detail views (muhurta details) |
| `.app-dialog` | Small confirm dialogs, created by `AppShell.confirm` |
| `.tab-container` / `.tab-item` | Tabs, with an optional `.tab-badge` count |
| `.portal-list` | Simple lists with an action on the right (devices, admins) |

### 5.3 Status and meaning

| Class | Use |
|---|---|
| `.pill--pass` / `.pill--fail` | Short pass / fail labels |
| `.audit-banner--green` / `--amber` / `--red` | Dosha summary at the top of a result card |
| `.dosha-item--pass`, `--fail-maha`, `--fail-dasha`, `--muted` | One dosha row; muted means not evaluated (data missing) |
| `.dosha-item__badge--excepted` | A dosha cancelled by an exception (doshapavada) |
| `.dosha-panel--maha` / `--dasha` / `--pariharam` | Grouped dosha sections (red / amber / purple) |
| `.bala--ok` / `--warn` / `--bad` | Personal strength (tarabala, chandrabala, age) |
| `.eval-dot.pass` / `.fail` | Compact check marks on a result card |
| `.rule-chip`, `.rule-chip--caution` | Event rules on a result card |
| `.amsha-badge--pushkara` / `--vargottama` | Lagna amsha (green / blue) |
| `.apavada-chip--all` / `--partial` | Dosha exceptions applied |
| `.yoga-item--good` / `--bad` / `--info` | Special yogas |
| `.abhijit-strip--auspicious` / `--inauspicious` | The Abhijit muhurta line |
| `.custom-kala-note` | Rahu kalam, Yamagandam or Gulika overlap: information only |

**Muhurta score bands.** Use these everywhere a percentage is shown:

| Band | Range | Colour | Card class |
|---|---|---|---|
| Excellent (ఉత్తమ) | ≥ 75% | success | `highly_favorable` |
| Medium (మధ్యమ) | 50–74% | warning | `favorable` |
| Avoid (నిషిద్ధ) | < 50% | danger | `unfavorable` |

The summary boxes on the Finder are also filters (`.summary-stat--filter`, with `aria-pressed`). Clicking one again clears the filter.

### 5.4 Forms

- **Fields:** `.field` wraps a `<label for>` and its input. Every input has a visible label, never a placeholder alone.
- **Optional fields:** add "(optional)" / "(ఐచ్ఛికం)" to the label. Required fields are not marked; most fields are required.
- **Location inputs** must be searchable: type ahead with `.suggestions-container` and `.suggestion-item`, using OpenStreetMap search. Don't add new fixed region lists.
- **Choice chips:** multi-choice options such as lunar months use checkbox chips (`.lunar-months__chips`); the checked chip is filled maroon.
- **Dates and times:** use native `<input type="date">` and `<input type="time">`.
- **Missing information:** if a required detail is missing, show one dialog listing what is needed. Optional people (for example the mother or guru for Upanayana) never trigger a message.
- **Errors:** say what is wrong next to the field or in a toast, and keep what the user typed.

### 5.5 Feedback and states

| Need | Use |
|---|---|
| Short confirmation or error | `AppShell.toast(message, "success" \| "error")`. Errors stay 9s, others 5s |
| Ask before a destructive action | `await AppShell.confirm(message, opts)`, which returns `true` or `false` |
| Loading | `.skeleton` with `--line`, `--tile` or `--card`, plus `role="status"` and an `aria-label` |
| Nothing to show | `.empty-state`: say what belongs here and give the next step when there is one |
| Long lists | Load more as the user scrolls (the Finder loads 60 days at a time over a year), with a "Load more" button as fallback |
| No results from a search | `.empty-state` with the most common rejection reasons and what to try next |

Every list or result area has all four states designed: loading, empty, error and filled.

### 5.6 Icons

- **Source:** use `js/icons.js` line icons, never emoji. They are drawn in the current text colour.
- **In HTML:** `<span data-icon="calendar"></span>`, with `data-icon-filled` for the solid form.
- **In JS:** `Icon("calendar")`.
- **Available names:** bell, users, user, landmark, clock, pin, lamp, search, sun, sunrise, sunset, moon, alert, sparkle, wheel, leaf, hourglass, chart, scroll, flame, zap, shield, printer, calendar, briefcase, plane, car, star.
- **New icons:** add them to `icons.js` in the same 24×24 stroke style.
- **Pass / fail marks:** use the text symbols ✓ ✕ ! inside status chips. They work in PDFs and screen readers too.
- **PDFs:** the PDF cleaner strips SVG, so exported PDFs have no icons. Never put meaning in an icon alone.

| Icon | Meaning in this app |
|---|---|
| `calendar` | Dates, month view |
| `clock` | Times, muhurta windows |
| `pin` | Place, exact moments |
| `lamp` | Lunar month, festivals |
| `landmark` | Lagna, muhurta window |
| `scroll` | Book rules |
| `users` / `user` | People, family |
| `sparkle` | Special yogas |
| `alert` | Warnings |
| `search` | Find, details |
| `printer` | Print / PDF |

### 5.7 Astrology views

- **South Indian chart:** `.south-chart` and `.chart-cell`, with `.chart-retro` and `.chart-combust` markers on planets.
- **Panchang sections:**
  - `.kv-*`: the five-part day;
  - `.lagna-*`: the lagna schedule;
  - `.padas-*`: nakshatra padas;
  - `.cm-banner`: samvatsara, ayana, ritu, masa and paksha;
  - `.inauspicious-card`: Rahu kalam, Yamagandam and Gulika.
- **Month calendar:** `panchang-month.css`. Clicking a day opens its details.

---

## 6. Copy-paste markup

These are the shapes to start from. Text always carries both languages (see 8.1).

### 6.1 Page frame

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/common.css?v=YYYYMMDD">
  <link rel="stylesheet" href="css/portal.css?v=YYYYMMDD">
  <title>Page name · Muhurtham</title>
</head>
<body>
  <a class="skip-link" href="#mainContent">Skip to main content</a>
  <nav class="app-shell__nav portal-nav" aria-label="Primary navigation">
    <a class="app-shell__brand" href="/">ముహూర్తం</a>
    <div class="app-shell__links"></div>
    <div class="lang-toggle">
      <button class="lang-btn active" id="langEn" onclick="setLang('en')">English</button>
      <button class="lang-btn" id="langTe" onclick="setLang('te')">తెలుగు</button>
    </div>
    <div class="account-slot" id="accountSlot"></div>
  </nav>
  <main id="mainContent" class="portal">
    <h1 class="portal__title" data-en="Page name" data-te="పేజీ పేరు">Page name</h1>
    <!-- sections -->
  </main>
  <script src="js/config.js"></script>
  <script src="js/icons.js?v=YYYYMMDD"></script>
  <script src="js/app-shell.js?v=YYYYMMDD"></script>
  <script src="js/i18n.js?v=YYYYMMDD"></script>
  <script src="js/auth.js?v=YYYYMMDD"></script>
  <script src="js/your-page.js"></script>
</body>
</html>
```

The script order matters: `config.js` defines the API base, `i18n.js` defines `setLang`, and `auth.js` fills the header.

### 6.2 Section card with a form

```html
<section class="portal-card" aria-labelledby="addTitle">
  <h2 id="addTitle" data-en="Add a person" data-te="వ్యక్తిని చేర్చండి">Add a person</h2>
  <p class="portal-hint" data-en="Enter each person once." data-te="ప్రతి వ్యక్తిని ఒక్కసారి నమోదు చేయండి.">Enter each person once.</p>
  <form class="portal-form" id="addForm">
    <div class="field">
      <label for="pName" data-en="Name" data-te="పేరు">Name</label>
      <input id="pName" required maxlength="80" autocomplete="off">
    </div>
    <div class="field">
      <label for="pGotra" data-en="Gotra (optional)" data-te="గోత్రం (ఐచ్ఛికం)">Gotra (optional)</label>
      <input id="pGotra" maxlength="60" autocomplete="off">
    </div>
    <button type="submit" class="btn btn--primary" data-en="Save person" data-te="వ్యక్తిని భద్రపరచండి">Save person</button>
  </form>
</section>
```

### 6.3 Searchable location field

```html
<div class="field" style="position: relative;">
  <label for="placeInput" data-en="Place" data-te="ప్రదేశం">Place</label>
  <input id="placeInput" type="search" autocomplete="off" role="combobox"
         aria-autocomplete="list" aria-expanded="false" aria-controls="placeList">
  <div id="placeList" class="suggestions-container" role="listbox" hidden>
    <div class="suggestion-item" role="option">Vijayawada, Andhra Pradesh</div>
  </div>
</div>
```

The Finder's place search (OpenStreetMap, with the town from the browser's location and a remembered choice) is the reference. Reuse its code; don't write a new search.

### 6.4 Status box

```html
<div class="portal-card" style="background: var(--color-warning-bg); border-color: var(--color-warning-border);" role="note">
  <strong style="color: var(--color-warning);" data-en="Check the birth time" data-te="జనన సమయం సరిచూడండి">Check the birth time</strong>
  <p data-en="Without it, lagna checks are skipped." data-te="అది లేకుండా లగ్న పరిశీలనలు చేయము.">Without it, lagna checks are skipped.</p>
</div>
```

Use the matching `success`, `danger`, `info` or `remedy` tokens for the other meanings.
If the same box appears on more than one page, add a class for it to `components.css` instead of repeating inline styles.

### 6.5 Pass / fail chips

```html
<span class="pill pill--pass">✓ Tarabala</span>
<span class="pill pill--fail">✕ Chandrabala (8th)</span>
<span class="bala bala--warn">! Age: 10 years (if needed)</span>
```

These classes are in `muhurta-finder.css`. To use them on another page, move them to `components.css` first.

### 6.6 Loading, empty and error

```html
<!-- loading -->
<span class="skeleton skeleton--card" role="status" aria-label="Loading saved muhurtas"></span>

<!-- empty -->
<div class="empty-state">
  <p data-en="No saved muhurtas yet." data-te="ఇంకా భద్రపరచిన ముహూర్తాలు లేవు.">No saved muhurtas yet.</p>
  <a class="btn btn--primary btn--sm" href="muhurta-finder.html" data-en="Find a muhurta" data-te="ముహూర్తం కనుగొనండి">Find a muhurta</a>
</div>
```

```js
// error
AppShell.toast(T("Could not load saved muhurtas. Try again.", "భద్రపరచిన ముహూర్తాలు తేలేకపోయాము. మళ్ళీ ప్రయత్నించండి."), "error");

// confirm before deleting
if (await AppShell.confirm(T("Remove Ravi from your family?", "రవిని మీ కుటుంబం నుండి తీసివేయాలా?"),
                           { ok: T("Remove", "తీసివేయి"), cancel: T("Keep", "ఉంచు"), danger: true })) { /* … */ }
```

Inside a list, use `<li class="empty-state">`; inside a table, use `<td colspan="…" class="empty-state">`.

### 6.7 Toggle filters

```html
<div role="group" aria-label="Result layout">
  <button type="button" class="view-btn active" data-view="cards" aria-pressed="true">Cards</button>
  <button type="button" class="view-btn" data-view="compact" aria-pressed="false">Compact list</button>
</div>
```

When the state changes, update both the `active` class and `aria-pressed`.

---

## 7. The Muhurta Finder result card

The result card is the most important view in the app. It is built in `renderResults()` in `js/finder.js`.
The order below is deliberate: the most important facts come first, and supporting details follow.

| # | Part | Class | Shown when | What it says |
|---|---|---|---|---|
| 1 | Card frame | `.day-card.highly_favorable` / `.favorable` / `.unfavorable` | Always | Edge colour from the score band (5.3) |
| 2 | Dosha summary | `.audit-banner--green` / `--amber` / `--red` | Doshas were checked | "Clean", "Clean with exception" or "Mahadosha not matched: <names>", plus "n of 21 mahadoshas · n of 10 dashavidha doshas" |
| 3 | Date line | `.day-date` | Always | Date · weekday |
| 4 | Panchang line | `.day-vaara` | Always | Lunar month · tithi (paksha) · nakshatra |
| 5 | Verdict badge | `.verdict-badge` | Always | "82% · Excellent", plus "· 1 mahadosha not matched" if any |
| 6 | Amsha | `.amsha-badge--pushkara` / `--vargottama` | The lagna has one | Amsha name, "best from <time>", navamsa |
| 7 | Exceptions | `.apavada-chip--all` / `--partial` | Upanayana, when present | ✓ the book's exception that applies |
| 8 | Age | `.bala--ok` / `--warn` / `--bad` | A birth date was given | ✓ preferred age, ! "if needed" age, ✕ outside |
| 9 | Kala note | `.custom-kala-note` | The window overlaps | "Overlaps Rahu kalam 10:30–12:00: a custom, not shastra (book para 1681), so it is not counted." |
| 10 | Window and pushkara | `.pushkara-mini` | Always for lagna events | Muhurta window, lagna, pushkara bhaga / navamsha times |
| 11 | Personal strength | `.personal-bala` | A person's star was given | One row per person: ✓/✕ Tarabala, ✓/✕ Chandrabala (house) |
| 12 | Check marks | `.eval-dot.pass` / `.fail` | Always | Vaara, Tithi, Nakshatra, 8th house, then Tara, Chandra, Panchaka if checked |
| 13 | Special yogas | `.rule-chip` (amber) | Present that day | Amrita siddhi, Sarvartha siddhi and so on |
| 14 | Reasons | `.activity-reasons` | Present | Up to four short reasons |
| 15 | Details button | `.btn--primary.btn--sm` | Always | Opens the detail modal |

**Detail modal** (`openDayModal`), top to bottom:
1. Panchang details.
2. Strength for each person.
3. Lagna and planet strength.
4. Muhurta rules evaluation, with each rule and its book reference.
5. Dosha panels: mahadoshas (red), dashavidha doshas (amber) and remedies (purple).
6. The D1 chart.

**Compact list** (`renderCompactList`): one row per window, showing date, time, lagna, percentage and a mahadosha mark. The "Muhurtas by month" mode with "All main ceremonies" shows each ceremony once per lagna as an event chip.

**Rules for changing the card:**
- **Keep the order.** A new part goes where its importance puts it, usually between 9 and 13.
- **Hide when empty.** A part with nothing to say is left out, not shown empty.
- **Failures are never removed.** In "Show all" mode a failed check is shown as "not matched". The card must not look clean when it isn't.
- **New percentage colours:** use the bands in 5.3, nothing else.

---

## 8. Writing and wording

### 8.1 Two languages

- **Static text:** give each element `data-en` and `data-te` attributes, with the English text inside as the default:
  `<span data-en="Event" data-te="కార్యం">Event</span>`.
- **Switching:** `setLang()` in `js/i18n.js` swaps the text and calls `window.onLangChange` for content drawn by JS.
- **Text built in JS:** use the page's `T(en, te)` helper (the Finder has one) or the name maps in `i18n.js` (rasis, weekdays, paksha).
- **Telugu wording:** write the Telugu as a native speaker would say it, not word for word from the English.
- **Never mix:** don't put half-English, half-Telugu text in one label, except astrology terms that are the same in both.

### 8.2 Tone

- **Plain and respectful.** Short sentences. Address the user as "you" (Telugu: మీరు).
- **Calm about bad results.** "Not matched", not "Failed!" or "Dangerous". Bad muhurtas are "Avoid", never "Bad luck".
- **Honest about limits.** If a check could not be made, say so ("3 checks could not be made with the details given"). Don't hide it.
- **No hype.** No exclamation marks, no "Amazing!", no emoji.

### 8.3 Astrology terms

- **Keep the term:** keep the Sanskrit or Telugu term and explain it in plain words the first time, for example "Tarabala (star strength)".
- **Spellings:** use the same spelling everywhere: muhurta, panchang, nakshatra, tithi, lagna, mahadosha, pariharam, Upanayana, Griha Pravesha.
- **Book rules:** when the UI cites a rule, give the book paragraph where known, for example "(book para 2198)".
- **Customs:** label customs as customs. Rahu kalam is "a custom, not shastra"; it is not counted as a dosha.

### 8.4 Message patterns

| Situation | Pattern | Example |
|---|---|---|
| Empty list | What belongs here + next step | "No saved muhurtas yet." + [Find a muhurta] |
| No results | What happened + why + what to try | "No muhurta for this event in the chosen months. Most common reasons: … Try other months or another year." |
| Error | What failed + what to do | "Could not load saved muhurtas. Try again." |
| Missing details | What is needed, as a list | "To search, add: the vatu's birth star, the father's birth star." |
| Confirm | The action + its object, as a question | "Remove Ravi from your family?" with buttons [Remove] [Cancel] |
| Success | What was done, past tense | "Saved to My muhurtas." |
| Information | The fact + where it comes from | "Kartari applies (Sun in Krittika)." |

---

## 9. Do and don't

| Do | Don't |
|---|---|
| `color: var(--color-danger)` | `color: #c62828` or `style="color:#777"` |
| ✓ Tarabala in green **and** the word "Matched" | A green dot with no text |
| `AppShell.confirm("Remove Ravi?")` | `if (confirm("Are you sure?"))` |
| `<span data-icon="calendar"></span>` | 📅 |
| A searchable place field | A `<select>` of districts |
| "(optional)" on the label of an optional field | A warning that an optional person was not entered |
| One dialog listing every missing required detail | One toast per missing field |
| "1 mahadosha not matched", with the window still listed | Dropping the window without saying why |
| "Rahu kalam overlaps: a custom, not counted" | Cutting the window at Rahu kalam with no note |
| A `<button>` for anything clickable | A clickable `<div>` with `onclick` only |
| Text that can grow 40% for Telugu | `width: 120px` on a button |
| A new class in `components.css` used by three pages | The same inline style copied into three pages |
| Bumping `?v=` after editing a CSS or JS file | Asking users to clear their cache |

---

## 10. Accessibility, print and sharing

### 10.1 Accessibility

- **Skip link and keyboard:** a skip link on every page. `:focus-visible` gives a 2–3px outline on everything clickable. Never remove outlines.
- **Native controls:** use real `<button>` and `<a>`. Toggles set `aria-pressed`; menus set `aria-expanded`; tabs use `role="tab"` and `aria-selected`.
- **Live regions:** use `aria-live="polite"` for announcements and results that change.
- **Colour is never the only signal:** every pass or fail colour comes with a word or a ✓ / ✕ mark.
- **Reduced motion:** honour `prefers-reduced-motion`; the skeleton animation stops.
- **Contrast:** the status text colours were chosen to read on their own tints. Don't put muted text on tinted backgrounds.
- **Language:** set `<html lang>` to the current language so screen readers and the Telugu rules work.

### 10.2 Print, PDF and sharing

- **Printing:** pages print without the header, nav and buttons (`@media print` in each stylesheet; use the `.no-print` class for other controls).
- **PDF export:** the backend renders PDFs (`backend/app/pdf/render.py`) using the same CSS, so a print-safe page is also PDF-safe.
- **Sharing:** the Panchang day and month views offer PDF, Image (PNG) and Text through `.share-bar` and `js/panchang-share.js`.

---

## 11. Conventions for changes

- **Stylesheet order:** `common.css` first (it imports variables, base, components, panchang, app-shell and dashboard), then the page's own stylesheet.
- **Cache busting:** bump the `?v=YYYYMMDD[letter]` on a CSS or JS include whenever that file changes, in every page that includes it.
- **Naming:** BEM-style class names (`block__element--modifier`). Finder-only classes use the `mf-` prefix.
- **Hiding:** use the `hidden` attribute (`common.css` forces it to `display: none`), not inline styles.
- **No new libraries:** no CSS framework or UI library. Plain HTML, CSS and JS.
- **Before adding a class:** search `components.css` for an existing one.
- **Escaping:** text that came from the server or the user is escaped before it is put into HTML (`escapeHtml()` in `finder.js`, `esc()` in `auth.js` and the portal pages), or set with `textContent`.
- **After a change:** check the page in both languages, with a narrow window, and with the keyboard only.

---

## 12. Glossary

**Design and code terms**

| Term | Meaning |
|---|---|
| Token | A named value in `variables.css` (for example `--color-primary`) used instead of a raw colour or size |
| BEM | A naming style: `block__element--modifier`, for example `dosha-item__badge--pass` |
| Skeleton | A grey placeholder bar shown while content loads |
| Empty state | What a list shows when it has nothing in it |
| Toast | A small message in the corner that disappears by itself |
| `aria-pressed` / `aria-expanded` | Attributes that tell screen readers whether a toggle is on or a menu is open |
| Live region | An area whose changes are read out by screen readers (`aria-live`) |
| Cache busting | Changing `?v=` on a file link so browsers load the new version |

**Astrology terms used in the UI**

| Term | Meaning |
|---|---|
| Muhurta | An auspicious time window for an event |
| Panchang | The five limbs of the day: vara, tithi, nakshatra, yoga, karana |
| Lagna | The rising sign at a moment. A muhurta window is one lagna's time span |
| Mahadosha | One of the 21 major faults that can spoil a muhurta |
| Dashavidha dosha | One of the 10 lagna faults |
| Pariharam | A remedy for a dosha |
| Doshapavada | The book's exceptions that cancel doshas |
| Tarabala / Chandrabala | A person's star strength and Moon strength on that day |
| Pushkara / Vargottama amsha | Especially good parts of a lagna |
| Kartari | The Sun's period that blocks some events |
| Rahu kalam, Yamagandam, Gulika | Daily periods kept by custom; shown, not counted |
| Abhijit | The midday muhurta |

---

## 13. Known gaps

These are inconsistencies in the current code, listed so they are not copied into new work:

- **Body font:** `body` in `base.css` uses Inter first, while `--font-sans` puts Outfit first.
- **Hard-coded sizes:** some older rules use px font sizes (11px, 12px, 13px) instead of the `--text-*` tokens.
- **Spacing token:** `--space-5` is used but not defined.
- **Duplicate class names:** several components have both a shared and an `mf-` name (for example `.detail-card` and `.mf-panchang-card`).
- **Breakpoints:** they vary between 480px and 768px (see 4.3).
- **Finder result card:**
  - it uses inline styles with hex colours (`#555`, `#777`, `#444`);
  - the whole card is a clickable `<div>`, which the keyboard cannot reach (the Details button inside it can);
  - some check labels are abbreviated ("Nak", "P.Nav").
- **Fixed place lists:** four location inputs are still `<select>` lists, against 5.4:
  - Panchang page;
  - My account home place;
  - My family birth place;
  - Finder person card birth place.
- **Page subtitle:** the Finder's subtitle still says "30-Day Muhurta Scanner", but it now searches one year.
