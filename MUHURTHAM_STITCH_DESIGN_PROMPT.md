# Gayathri Jyothirnidhe (గాయత్రి జ్యోతిర్నిధి) — Master Stitch UI Design Prompt & Architectural Specification

> **Official Design System & Prompt Guide** for generating the high-fidelity UI design templates in **Stitch** (and downstream frontend React / Tailwind / Flutter implementations).  
> **Platform Name**: **Gayathri Jyothirnidhe (గాయత్రి జ్యోతిర్నిధి)**  
> **Brand Symbolism**: Sri Gayatri Devi seated on the sacred swan (Hamsa) atop a divine pink lotus, encircled by the antique bronze and gold 12-Rashi Astrological Zodiac Wheel (Kundali Chakra).  
> **Reference Architecture**: Sri Bhaskara Astro (`sribhaskaraastro.com`) computational model.  
> **Core Specifications**: 31-page Muhurtham UI Data Spec (106 Muhurta ceremonies, 17 categories, 21 Mahadoshas, Kala Vibhajana, Pitru Calendar, Special Yogas, and live Panchangam).  
> **Production Backend Integration**: FastAPI codebase (`backend/app/`) — Auth with WhatsApp OTP, Profile, Multi-device Sessions, AES-GCM Encrypted Family Vault, and Saved Searches.

---

# SECTION 1: Brand Identity & Dual-Theme Color System

### 1.1 Brand Philosophy & Visual Atmosphere
* **Aesthetic**: *Divine Vedic Radiance & Sacred Forest Serenity*. Blends classical Vedic astrological scholarship (*Surya Siddhanta*, *Muhurtha Chintamani*, *Gayatri Upasana*) with high-precision digital computation.
* **App Logo**: The sacred circular medallion featuring **Sri Gayatri Devi** (5 divine faces with luminous golden aura, holding sacred implements, seated on a white swan over a blooming pink lotus), surrounded by the ornate 12-Rashi Zodiac ring and inscribed at the top with **"గాయత్రి జ్యోతిర్నిధి"**.
* **Language Hierarchy**: **Telugu (తెలుగు) is DEFAULT** across the entire application; **English** is available via header toggle and user settings.
* **Theme Support**: **Light Theme is DEFAULT**; **Dark Theme** is fully designed with rich midnight-forest and antique-gold tones.

---

### 1.2 Extracted Color Tokens & Harmonized Palette

The client's exact thick green primary color extracted from the swatch is **`#3C6600`** (*Deep Tulasi & Bilva Forest Green*). Below is the complete color harmony crafted for both Light and Dark themes:

```css
/* ==========================================================================
   GAYATHRI JYOTHIRNIDHE DESIGN TOKENS
   Primary: #3C6600 (Sacred Tulasi Forest Green)
   Accent:  #D4AF37 (Swarna Gold / Gayatri Kundali Ring)
   ========================================================================== */

:root {
  /* Brand Core (Consistent across themes) */
  --color-primary: #3C6600;            /* Client Thick Green / Deep Tulasi */
  --color-primary-dark: #264200;       /* Deep Sacred Bilva Forest */
  --color-primary-light: #4E8200;      /* Fresh Durva Grass Green */
  --color-primary-soft: #EBF3DF;       /* Gentle Sage Tint Wash */

  --color-accent-gold: #D4AF37;        /* Swarna / Metallic Shimmer Gold */
  --color-accent-brass: #C59B27;       /* Antique Temple Brass (Logo Ring) */
  --color-accent-saffron: #C86800;     /* Deep Saffron / Kumkuma Kesari */
  --color-accent-pink: #D84A78;        /* Gayatri Lotus Pink (Logo Lotus) */

  /* Status Bands (Classical Muhurtham Verdicts) */
  --color-uttama: #2E6E00;             /* Uttama (Best 75-100%) Forest Emerald */
  --color-uttama-bg: #EBF7E1;          /* Uttama Light Green Wash */
  --color-madhyama: #A05A00;           /* Madhyama (Middling 50-74%) Amber */
  --color-madhyama-bg: #FFF4E0;        /* Madhyama Warm Cream Wash */
  --color-nishiddha: #B42318;          /* Nishiddha (Avoid 0-49%) Crimson */
  --color-nishiddha-bg: #FEECEB;       /* Nishiddha Soft Rose Wash */
  --color-pariharam: #6B21A8;          /* Divine Remedy Purple */
  --color-pariharam-bg: #F3E8FF;       /* Amethyst Light Wash */
}

/* --------------------------------------------------------------------------
   LIGHT THEME (DEFAULT)
   Atmosphere: Sacred Dew-washed Temple Parchment & Radiant Tulasi
   -------------------------------------------------------------------------- */
[data-theme="light"], :root {
  --color-bg-canvas: #F9FBF6;          /* Sacred Dew Parchment (Hint of sage) */
  --color-bg-surface: #FFFFFF;         /* Crisp White Card Surface */
  --color-bg-subtle: #F1F5EB;          /* Light Bilva Card Wash */

  --color-border: #D5DEC9;             /* Soft Sage Leaf Clay Divider */
  --color-border-gold: #E5C158;        /* Ornamental Gold Border */
  --color-border-active: #3C6600;      /* Primary Focus Border */

  --color-text-main: #1B2412;          /* Deep Forest Espresso Ink (High Contrast) */
  --color-text-muted: #4E5B42;         /* Muted Sage Charcoal */
  --color-text-subtle: #7A896F;        /* Soft Khaki Green Labels */

  --shadow-card: 0 4px 16px rgba(38, 66, 0, 0.06);
  --shadow-elevation: 0 12px 32px rgba(38, 66, 0, 0.12);
}

/* --------------------------------------------------------------------------
   DARK THEME
   Atmosphere: Midnight Forest Hermitage (నిశీథ వనం) with Glowing Gold Aura
   -------------------------------------------------------------------------- */
[data-theme="dark"] {
  --color-bg-canvas: #0E1508;          /* Midnight Forest Canvas */
  --color-bg-surface: #16200F;         /* Deep Moss Velvet Card Surface */
  --color-bg-subtle: #1D2A14;          /* Elevated Moss Container */

  --color-border: #2A3C1D;             /* Deep Evergreen Divider */
  --color-border-gold: #C59B27;        /* Glowing Antique Brass Border */
  --color-border-active: #659E16;      /* Luminous Tulasi Active Border */

  --color-text-main: #EDF3E6;          /* Moonlit Sacred Parchment */
  --color-text-muted: #A3B594;         /* Soft Celestial Sage */
  --color-text-subtle: #6B7D5E;        /* Muted Forest Glow */

  /* Dark Theme Adjusted Status */
  --color-primary: #659E16;            /* Luminous Tulasi Green for Dark Mode */
  --color-primary-soft: #1D2D10;
  --color-uttama: #7CD836;
  --color-uttama-bg: #152B09;
  --color-madhyama: #FBBF24;
  --color-madhyama-bg: #2C1F04;
  --color-nishiddha: #F87171;
  --color-nishiddha-bg: #300C09;
  --color-pariharam: #C084FC;
  --color-pariharam-bg: #220935;

  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.4);
  --shadow-elevation: 0 12px 36px rgba(0, 0, 0, 0.6);
}
```

---

### 1.3 Typography Stack & Telugu-First Font Engineering

#### 1.3.1 Google Fonts Web Embed Specification
To guarantee that Telugu glyphs, conjunct matras (దీర్ఘాలు, కొమ్ములు, ఒత్తులు), and Sanskrit ligatures render with 100% typographic fidelity across all web browsers and Stitch UI previews without clipping, the following fonts must be embedded:

**HTML `<head>` Embed**:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Mandali&family=Noto+Sans+Telugu:wght@300;400;500;600;700;800&family=Noto+Serif+Telugu:wght@400;600;700;800&family=Suranna&family=Cinzel:wght@500;600;700;800&family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**CSS `@import` Embed**:
```css
@import url('https://fonts.googleapis.com/css2?family=Mandali&family=Noto+Sans+Telugu:wght@300;400;500;600;700;800&family=Noto+Serif+Telugu:wght@400;600;700;800&family=Suranna&family=Cinzel:wght@500;600;700;800&family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
```

#### 1.3.2 CSS Typography Tokens & Font Stacks
```css
:root {
  /* Primary Telugu Body Stack (Default UI Font) */
  --font-family-telugu: 'Noto Sans Telugu', 'Noto Sans Telugu UI', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* Traditional Telugu Classical Heading Stack (Shlokas, Temple Titles, Banners) */
  --font-family-heading: 'Noto Serif Telugu', 'Mandali', 'Suranna', 'Cinzel', serif;

  /* Display & Logo Typography */
  --font-family-display: 'Mandali', 'Suranna', 'Noto Serif Telugu', serif;

  /* Ephemeris & Numerical Data (Tabular alignment for degrees, ghatis, times) */
  --font-family-mono: 'Inter', 'Noto Sans Telugu', -apple-system, monospace;
}
```

#### 1.3.3 Essential Telugu Script Rendering Engine Rules
Telugu script has unique complex text layout (CTL) requirements. The following 4 rules MUST be enforced in CSS and Stitch prompt components:

1. **Line-Height Safety Guard (`line-height: 1.65` to `1.75`)**:
   - Telugu vowel diacritics (e.g. `ీ` deergham, `ై` aitvam, `ౌ` autvam) rise above the Latin cap-height, while sub-joined consonant conjuncts (e.g. `్త్య`, `్మ`, `్క`, `్ర`) extend far below the baseline.
   - Standard Latin line-height (`1.2` – `1.4`) **will clip** these vital letters. All body, headings, and lists must use minimum `line-height: 1.65`.

2. **Vertical Padding in Controls (`py-2` to `py-2.5` / `padding: 8px 16px`)**:
   - Buttons, badge pills, category chips, and table cells must have at least `6px` to `8px` top and bottom padding so bottom conjuncts (`ఒత్తులు`) never touch the borders.

3. **Word Wrap & Hyphenation Guard (`word-break: keep-all; overflow-wrap: break-word`)**:
   - Prevents breaking Telugu syllables (అక్షరాలు) awkwardly in the middle of a word across two lines.

4. **Kerning & Ligature Shaping**:
   - `font-feature-settings: "kern" 1, "liga" 1;`
   - `-webkit-font-smoothing: antialiased;`
   - `text-rendering: optimizeLegibility;`

#### 1.3.4 Bilingual Display Contract
- **Primary Script**: Telugu (`తెలుగు`) is the dominant, top-level text.
- **Secondary Subtitle**: English is displayed in smaller muted text underneath (e.g., `వివాహ మహోత్సవము · Vivaha Muhurtham`, `గృహప్రవేశం · Griha Pravesha`).
- **Settings Switcher**: Users can flip the dominant language between Telugu and English in settings, with Telugu as the system default.

---

# SECTION 2: Architecture & Capabilities Overview

### 2.1 The 17 Muhurta Categories (106 Events Total)
1. **వివాహ ముహూర్తాలు (Marriage - 4 events)**: Vivaha, Nisheka, Nutana Vadhu, Lagna Patrika/Invitation.
2. **ఉపనయన ముహూర్తాలు (Upanayana - 1 event)**: Vatu Brahmopadesham (Age window 5–11).
3. **విద్యా ముహూర్తాలు (Education - 11 events)**: Aksharabhyasa, School Admission, Vedic Study, Exams.
4. **గృహ & వాస్తు ముహూర్తాలు (House & Vastu - 20 events)**: Land/Site, Construction, House Entry.
5. **గర్భ సంస్కారాలు (Pregnancy - 3 events)**: Garbhadhana, Pumsavana, Seemantonnayana.
6. **శిశు సంస్కారాలు (Child Samskaras - 6 events)**: Namakarana, Annaprashana, Karnavedha, Chaula.
7. **ఉద్యోగ ముహూర్తాలు (Career - 6 events)**: Job Application, Interview, Joining, Promotion.
8. **వ్యాపార ముహూర్తాలు (Business - 12 events)**: Business Start, Expansion, Office Opening, Contracts.
9. **ప్రయాణ ముహూర్తాలు (Travel - 1 event)**: Prayana with Disha Shula and purpose rules.
10. **ఆరోగ్య ముహూర్తాలు (Health - 5 events)**: Medicine, Treatment, First Bath after Illness.
11. **దేవతా కార్యాలు (Spiritual - 14 events)**: Vigraha Pratishtha, Temple Entry, Yajna, Vrata, Diksha.
12. **పితృ కర్మ (Pitru Karma - 3 events + Calendar Tool)**: Asthisanchayana, Sapindikarana, Abhyanga.
13. **కొనుగోలు · ఆర్థిక (Purchase & Finance - 10 events)**: Vehicles, Gold, Property Agreements.
14. **వ్యవసాయ ముహూర్తాలు (Agriculture - 3 events)**: Sowing, Cultivation, Farm Work.
15. **వ్యక్తిగత ముహూర్తాలు (Personal - 5 events)**: Haircut, Clothes & Jewelry, First Use.
16. **సాధారణ ముహూర్తాలు (General - 2 events)**: Contests, Lotteries.
17. **ప్రత్యేక ముహూర్తాలు (Special Yogas Tool)**: Standalone tool for Siddhi Yogas.

### 2.2 Built Backend Functionalities Verified
* **Auth**: Mobile login (`+91`), WhatsApp OTP verification, signup with consent, password reset.
* **Sessions**: Multi-device management (`GET /me/sessions`, `DELETE /me/sessions/{id}`).
* **Family Vault**: Encrypted birth details (`GET /me/family`, `POST /me/family`) with AES-GCM for 1-click participant selection.
* **Saved Muhurthams**: Favorites, notes, rerun search, PDF certificates (`/me/saved`).
* **Panchang & Muhurtha**: 37 Panchang properties, 21 Mahadosha evaluation, 12-Lagna schedule, South Indian 4x4 chart.

---

# SECTION 3: The 11 Production Stitch UI Prompts (3-Part Contract)

Copy and paste these prompts directly into **Stitch** to generate the pixel-perfect design templates.

> **CRITICAL STITCH TYPOGRAPHY INSTRUCTION**:  
> In every generated template, include:  
> `@import url('https://fonts.googleapis.com/css2?family=Mandali&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Serif+Telugu:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');`  
> Use `font-family: 'Noto Sans Telugu', sans-serif;` for body, `font-family: 'Noto Serif Telugu', 'Mandali', serif;` for headings, and set `line-height: 1.65;` with `word-break: keep-all;` to prevent vowel/conjunct clipping.

```markdown
<!-- ============================================================================== -->
<!-- STITCH PROMPT 1: AUTHENTICATION, WHATSAPP OTP & ONBOARDING                    -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1280px) and Mobile Responsive (390px).
Persona: Devout user or family head signing into "Gayathri Jyothirnidhe" (గాయత్రి జ్యోతిర్నిధి).
Purpose: Secure onboarding via Mobile & WhatsApp OTP with authentic Vedic green & gold aesthetics.
Typography: Primary UI Font 'Noto Sans Telugu'; Classical Headings 'Noto Serif Telugu' / 'Mandali'. Enforce line-height: 1.65 and py-2.5 on all buttons.
Tokens:
- Light Mode (Default): Canvas: #F9FBF6; Card: #FFFFFF; Primary: #3C6600; Gold: #D4AF37; Lotus Pink: #D84A78; Text: #1B2412.
- Dark Mode: Canvas: #0E1508; Card: #16200F; Primary: #659E16; Gold: #C59B27; Text: #EDF3E6.
Default Language: Telugu (తెలుగు) with English switcher.

[Layout]
Centered sacred authentication portal card (max-width: 480px) with 1px gold filigree border and soft shadow.
Top brand header with deep Tulasi green (#3C6600) gradient background, featuring the circular medallion logo of Sri Gayatri Devi on a white swan surrounded by the 12-Rashi astrological wheel.

[Components]
1. Branding Header:
   - Centered circular emblem logo: Goddess Gayatri with 5 divine heads on a swan/lotus, inside the 12-Zodiac bronze ring with "గాయత్రి జ్యోతిర్నిధి".
   - Primary Title (Telugu): "గాయత్రి జ్యోతిర్నిధి"
   - Subtitle: "వేద ముహూర్త దర్శిని · Gayathri Jyothirnidhe Vedic Muhurtham"
   - Language selector pill: [తెలుగు (ప్రధానం)] | [English]
   - Theme toggle icon: [☀️ Light] / [🌙 Dark]
2. Auth Mode Switcher:
   - Segmented tab: "పాస్‌వర్డ్ లాగిన్ (Password)" | "వాట్సాప్ ఓటీపీ (WhatsApp OTP)"
3. Form Controls:
   - Mobile Number: Prefix "+91" with Indian flag chip, input field for 10 digits.
   - Password Field: Secured input with eye show/hide icon and "పాస్‌వర్డ్ మర్చిపోయారా? (Forgot Password?)".
   - Primary Action Button: "ప్రవేశించండి (Sign In)" in rich green (#3C6600) with gold border shimmer.
   - Secondary Link: "కొత్త ఖాతా తెరవండి (Create Account)".
4. WhatsApp OTP Verification Dialog (Active State):
   - Modal with WhatsApp badge: "మీ వాట్సాప్ నంబర్‌కు 6 అంకెల ఓటీపీ పంపబడింది (+91 98480 •••••)".
   - 6 segmented PIN boxes with auto-focus and golden outline (#D4AF37).
   - Resend timer: "00:27 సెకన్లలో మళ్ళీ పంపవచ్చు (Resend OTP)".
   - Button: "ధృవీకరించండి (Verify & Continue)".
5. Security Seal:
   - Lock icon with text: "AES-GCM ఎన్‌క్రిప్టెడ్ పవిత్ర జ్యోతిష్య భద్రత (Encrypted Vedic Privacy)".


<!-- ============================================================================== -->
<!-- STITCH PROMPT 2: PROFILE, MULTI-DEVICE SESSIONS & FAMILY VAULT                -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1440px) 3-column portal and Mobile Drawer.
Persona: Registered Yajamana managing account settings, language preferences, active devices, and family birth profiles.
Purpose: Profile settings, theme/language toggles, multi-device session revocation, and confidential Family Vault for 1-click muhurtha pre-fill.
Tokens:
- Light Mode: Canvas: #F9FBF6; Card: #FFFFFF; Primary: #3C6600; Border: #D5DEC9; Gold: #D4AF37.
- Dark Mode: Canvas: #0E1508; Card: #16200F; Primary: #659E16; Border: #2A3C1D; Gold: #C59B27.
Default Language: Telugu (తెలుగు).

[Layout]
Left Sidebar (260px): Navigation list (నా ప్రొఫైల్ / Profile, కుటుంబ వివరాలు / Family Vault, పరికరాలు / Sessions, సెట్టింగ్స్ / Settings, డేటా ఎక్స్‌పోర్ట్ / Export).
Right Workspace: Fluid card deck with gold corner accents.

[Components]
1. Profile & Preferences Section:
   - User Avatar with gold zodiac ring trim (#D4AF37) and "యజమాని (Yajamana)" badge.
   - Full Name input, verified WhatsApp number badge, and Home City selector ("హైదరాబాద్ · Hyderabad").
   - Language Preference: Radio chips with [తెలుగు (Default)] and [English].
   - Theme Mode Selector: Radio chips with [☀️ వెలుగు (Light - Default)], [🌙 చీకటి (Dark)], [💻 సిస్టమ్ (System)].
   - Save button: "మార్పులను భద్రపరచండి (Save Preferences)" (#3C6600).
2. Family Vault (కుటుంబ సభ్యుల జన్మ వివరాల ఖజానా):
   - Header with CTA: "నా కుటుంబం (My Family)" + Button "+ కుటుంబ సభ్యుడిని చేర్చండి (+ Add Member)" (#3C6600).
   - Confidentiality Banner: "జన్మ వివరాలు AES-GCM తో సురక్షితంగా సీల్ చేయబడ్డాయి (Birth details sealed with encryption)."
   - Family Cards Grid:
     - Card 1: "వెంకటరావు (Venkat Rao)" · సంబంధం: తండ్రి (Father) · గోత్రం: కశ్యపస (Kashyapa) · జ్యేష్ఠ పుత్రుడు (Eldest).
       - Computed Star Pill: "జన్మ నక్షత్రం: పూర్వాషాఢ 2వ పాదం · ధనుస్సు రాశి · మిథున లగ్నం".
     - Action icons: ఎడిట్ (Edit), తొలగించు (Delete), "ముహూర్తంలో వాడు (Use in Search)".
   - Add/Edit Member Modal:
     - Choice Toggle: "జన్మ వివరాలు నమోదు చేయండి (DOB/TOB/POB)" vs "నక్షత్రం నేరుగా ఎంచుకోండి (Pick Stars)".
     - Inputs: పేరు (Name), సంబంధం (Relationship dropdown: భార్య, కుమారుడు, కుమార్తె, తండ్రి, తల్లి, etc.), లింగం (Gender), గోత్రం (Gotra), పెద్ద సంతానం (Eldest child checkbox).
     - Geocoded Place Picker for birth town with lat/lon auto-fill.
3. Active Device Sessions Table (క్రియాశీల పరికరాలు):
   - Table columns: పరికరం (Device), ఐపీ అడ్రస్ (IP), స్థితి (Active Now), లాగౌట్ (Revoke).
   - Danger Action: "అన్ని పరికరాల నుండి లాగౌట్ అవ్వండి (Log Out Everywhere)" (#B42318).


<!-- ============================================================================== -->
<!-- STITCH PROMPT 3: TODAY'S PANCHANGAM DASHBOARD CARD (/dashboard/today)         -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1440px) and Mobile Responsive (390px).
Persona: Daily practitioner checking today's auspiciousness and real-time running muhurthams.
Purpose: Real-time visual display of Panchanga 5 Limbs, live bad times, next good window, and Telugu Samvatsara.
Tokens:
- Light Mode: Canvas: #F9FBF6; Card: #FFFFFF; Primary: #3C6600; Gold: #D4AF37; Uttama: #2E6E00 (#EBF7E1); Bad Time: #B42318 (#FEECEB).
- Dark Mode: Canvas: #0E1508; Card: #16200F; Primary: #659E16; Gold: #C59B27; Uttama: #7CD836 (#152B09); Bad Time: #F87171 (#300C09).
Default Language: Telugu (తెలుగు) with English subtitles.

[Layout]
Top brand navigation with circular Gayatri logo, followed by Telugu Samvatsara Almanac Banner, 4-Anga Grid, 24-Hour Color-Coded Timeline, and Good/Bad Activity Stream.

[Components]
1. Header Bar:
   - Circular Gayatri Jyothirnidhe logo medallion on left.
   - Title: "గాయత్రి జ్యోతిర్నిధి · నేటి పంచాంగం (Today's Panchangam)".
   - City Picker: "హైదరాబాద్ ▾ (17.38° N, 78.48° E)".
   - Live Date: "సోమవారం, 9 నవంబర్ 2026 (Somavaram)".
2. Traditional Telugu Almanac Banner:
   - Inscription: "పరాభవ నామ సంవత్సరం · దక్షిణాయనం · శరద్ ఋతువు · ఆశ్వయుజ మాసం · కృష్ణ పక్షం (30వ రోజు)".
   - Live Status Alert:
     - Rahu Kalam active: Red banner (#FEECEB, border #B42318) "⚠️ ప్రస్తుతం రాహుకాలం నడుస్తోంది: ఉదయం 07:44 – 09:10 వరకు".
     - Abhijit active: Emerald banner (#EBF7E1, border #2E6E00) "✨ అభిజిత్ ముహూర్తం నడుస్తోంది: మధ్యాహ్నం 11:37 – 12:24 వరకు".
3. 4-Anga Limb Cards Grid:
   - తిథి (Tithi): "అమావాస్య #15" · సమయం: 12:37 (-1) → 12:32 · కృష్ణ పక్షం.
   - నక్షత్రం (Nakshatra): "స్వాతి 4వ పాదం" · సమాప్తి: 14:19 · అధిపతి: రాహువు · దేవత: వాయువు.
   - యోగం (Yoga): "సౌభాగ్య యోగం" · 03:02 → 02:49 (+1).
   - కరణం (Karana): "నాగ కరణం" · సమాప్తి: 12:32.
4. సూర్యోదయ & చంద్రాస్తమయ పట్టిక (Sun & Moon):
   - సూర్యోదయం: 06:21:32 AM (☉) · సూర్యాస్తమయం: 17:37:59 PM (☽).
   - చంద్ర స్థితి: క్షీణ చంద్రుడు (1% ప్రకాశం).
5. 24-గంటల కాల విభజన టైమ్‌లైన్ (24-Hour Visual Timeline):
   - Horizontal bar showing 24 hours color-coded: Red blocks for రాహుకాలం, యమగండం, గుళిక, వర్జ్యం; Green block for అభిజిత్ & అమృత ఘడియలు.
   - Vertical golden needle marking the current live time.
6. తదుపరి శుభ ముహూర్తం (Next Good Window):
   - Card: "తదుపరి ఉత్తమ సమయం: రేపు ఉదయం 11:37 – 12:24 (అభిజిత్ ముహూర్తం)".


<!-- ============================================================================== -->
<!-- STITCH PROMPT 4: COMPREHENSIVE DAY PANCHANGAM & KALA VIBHAJANA                 -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1440px) or Tablet (1024px).
Persona: Vedic astrologer or devotee auditing the complete day's astrological structure (/panchang/day-summary).
Purpose: 8-fold Kala Vibhajana intervals, 12 Lagna schedule, and Panchaka Rahitam breakdown.
Tokens: Primary: #3C6600; Gold: #D4AF37; Surface: #FFFFFF; Sage Canvas: #F9FBF6; Dark Surface: #16200F.
Language: Telugu (తెలుగు) with English subtitles.

[Layout]
Header with Date Switcher and View Toggle ("రోజు వీక్షణ (Day)" | "నెల వీక్షణ (Month)"), followed by a 2-column layout (60% Kala Vibhajana & Lagna Schedule; 40% Panchaka Rahitam & Activities).

[Components]
1. దిన / ప్రదేశ ఎంపిక (Date & Place Navigator):
   - Steppers: "< నిన్న" | "నేడు" | "రేపు >" with Telugu calendar date popup.
   - City Presets: హైదరాబాద్, విజయవాడ, విశాఖపట్నం, తిరుపతి, బెంగళూరు.
2. 8-విధ కాల విభజన (8-Fold Kala Vibhajana Accordion):
   - ప్రాతః కాలం (06:21 – 08:35): సంధ్యావందనం, ప్రాతః పూజలు.
   - సంగవ కాలం (08:35 – 10:49): వేదాధ్యయనం, నిత్య కర్మలు.
   - మధ్యాహ్నిక కాలం (10:49 – 13:03): అభిజిత్ ముహూర్త కాలం.
   - అపరాహ్న కాలం (13:03 – 15:17): పితృ కర్మలు, శ్రాద్ధ సమయం.
   - సాయాహ్న కాలం (15:17 – 17:38): సాయంత్ర సంధ్యా కాలం.
   - ప్రదోష కాలం (17:38 – 20:02): శివ పూజ, ప్రదోష వ్రత కాలం.
   - నిశీథ కాలం (23:40 – 00:30): దేవీ ఆరాధన, నిశీథ సాధన.
   - బ్రాహ్మీ ముహూర్తం (04:45 – 05:33): ఉషఃకాలం, ఉత్తమ ధ్యాన సమయం.
3. 12 లగ్న చక్ర పట్టిక (12-Sign Lagna Schedule Table):
   - Table columns: రాశి సంఖ్య, లగ్నం పేరు ("7. తులా లగ్నం · Tula"), ప్రారంభం, ముగింపు, పుష్కర నవాంశ స్థితి.
   - Golden star badge (✦) for Pushkara Navamsa intervals.
4. పంచక రహిత పరిశీలన (Panchaka Rahitam Calculator):
   - Formula Display: `(తిథి 15 + వారం 2 + నక్షత్రం 19 + లగ్నం 7) % 9 = శేషం 7`
   - Verdict Pill: "శుభ పంచకం (Shubha Panchakam - Auspicious)" in Green (#2E6E00) or warning pill ("మృత్యు పంచకం", "అగ్ని పంచకం" etc. with necessary pariharam).
5. నేటి అనుకూల & వర్జ్య కార్యాలు (Favorable vs Avoid Activities):
   - Split tabs: "అనుకూలమైనవి (7)" | "వర్జ్యమైనవి (5)".
   - Row with green tick: మంత్ర సిద్ధి, నూతన వస్తు సంగ్రహం.


<!-- ============================================================================== -->
<!-- STITCH PROMPT 5: 17-CATEGORY MUHURTA CATALOG GRID (/muhurta/catalog)           -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1440px) Grid and Mobile Cards.
Persona: User seeking an auspicious Muhurtham for a specific life event.
Purpose: Visual discovery of 106 classical Muhurta ceremonies divided into 17 authoritative Vedic categories.
Tokens: Primary: #3C6600; Gold Accent: #D4AF37; Light Surface: #FFFFFF; Dark Surface: #16200F; Lotus Pink: #D84A78.
Language: Telugu (తెలుగు) primary with English labels.

[Layout]
Header with universal search input and category filter chips, followed by a responsive 3x6 / 4x4 Grid of 17 Category Cards.

[Components]
1. Search & Filter Bar:
   - Universal search input: "106 ముహూర్తాలలో వెతకండి (ఉదా: వివాహం, గృహప్రవేశం, ఉపనయనం, బోరు బావి)..."
   - Quick Category Chips: అన్నీ (All), వివాహం, గృహ & వాస్తు, సంస్కారాలు, వ్యాపారం, సాధనాలు.
2. 17 Category Cards:
   Each card features a subtle antique gold border (#D4AF37), sacred icon, Telugu title, English subtitle, event counter badge, and hover green lift.
   1. వివాహ ముహూర్తాలు · Marriage (4 events: వివాహం, నిషేకము, నూతన వధూ ప్రవేశం, లగ్న పత్రిక)
   2. ఉపనయన ముహూర్తాలు · Upanayana (1 event: వటువు ఉపనయనం)
   3. విద్యా ముహూర్తాలు · Education (11 events: అక్షరాభ్యాసం, విద్యాభ్యాసం, వేదాధ్యయనం)
   4. గృహ & వాస్తు ముహూర్తాలు · House & Vastu (20 events: భూమిపూజ, శంకుస్థాపన, గృహప్రవేశం)
   5. గర్భ సంస్కారాలు · Pregnancy (3 events: గర్భాధానం, పుంసవనం, సీమంతం)
   6. శిశు సంస్కారాలు · Child Samskaras (6 events: నామకరణం, అన్నప్రాశన, కర్ణవేధ)
   7. ఉద్యోగ ముహూర్తాలు · Career (6 events: ఉద్యోగ దరఖాస్తు, ఇంటర్వ్యూ, పదవీ స్వీకారం)
   8. వ్యాపార ముహూర్తాలు · Business (12 events: వ్యాపారారంభం, భాగస్వామ్యం, రిజిస్ట్రేషన్)
   9. ప్రయాణ ముహూర్తాలు · Travel (1 event: ప్రయాణము · దిశా శూల పరిశీలన)
   10. ఆరోగ్య ముహూర్తాలు · Health (5 events: ఔషధ సేవన, శస్త్రచికిత్స, మొదటి స్నానం)
   11. దేవతా కార్యాలు · Spiritual (14 events: విగ్రహ ప్రతిష్ఠ, దేవాలయ ప్రవేశం, యజ్ఞం, హోమం)
   12. పితృ కర్మ · Pitru Karma (3 events + ప్రత్యేక పితృ క్యాలెండర్ సాధనం)
   13. కొనుగోలు · ఆర్థిక · Purchase & Finance (10 events: వాహన కొనుగోలు, బంగారం, ఆస్తి ఒప్పందం)
   14. వ్యవసాయ ముహూర్తాలు · Agriculture (3 events: విత్తనాలు జల్లుట, పంటల సాగు)
   15. వ్యక్తిగత ముహూర్తాలు · Personal (5 events: కేశఖండనం, నూతన వస్త్రధారణ)
   16. సాధారణ ముహూర్తాలు · General (2 events: పోటీలు, లాటరీ)
   17. ప్రత్యేక ముహూర్తాలు · Special Yogas Tool (సిద్ధి యోగాలు, అమృత సిద్ధి సాధనం)
3. Hover State:
   - Card elevates with warm shadow, border glows in gold (#D4AF37), and green button "ముహూర్తం కనుగొనండి" appears.


<!-- ============================================================================== -->
<!-- STITCH PROMPT 6: UNIVERSAL DYNAMIC MUHURTA FINDER FORM (/muhurta/find)         -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop Dual-Column Portal (Form 45% left, Live Info 55% right).
Persona: Seeker customizing inputs to find an auspicious window for a selected ceremony.
Purpose: Dynamic multi-section form that adapts inputs depending on the selected event from the catalog.
Tokens: Primary: #3C6600; Gold: #D4AF37; Canvas: #F9FBF6; Card: #FFFFFF; Saffron: #C86800.
Language: Telugu (తెలుగు) primary with English labels.

[Layout]
Dual-column split workspace:
Left Panel: Stepped form with 3 clear sections: (A) సాధారణ ఎంపికలు (Common Parameters), (B) వ్యక్తుల వివరాలు (Person Cards), (C) ఈవెంట్ వివరాలు (Event Details).
Right Panel: Sticky summary card showing selected ceremony rules, book reference citation, and "ముహూర్తాలను శోధించండి (Scan Muhurtams)" CTA.

[Components]
1. Section A — సాధారణ శోధన పారామితులు (Common Parameters):
   - Selected Activity Banner: Breadcrumb "గృహ & వాస్తు > నూతన గృహప్రవేశము (Griha Pravesha)".
   - ప్రారంభ తేదీ (Start Date Picker): Telugu/Gregorian date picker.
   - శోధన వ్యవధి (Scan Duration Chips): [15 రోజులు], [30 రోజులు], [45 రోజులు], [60 రోజులు].
   - ప్రదేశం (Location Autocomplete): GPS బటన్ ("ప్రస్తుత ప్రాంతం") + తెలుగు నగరాల జాబితా.
   - సమయ ప్రాధాన్యత (Time Preference): [ఏ సమయమైనా], [ఉదయం: సూర్యోదయం–మధ్యాహ్నం], [మధ్యాహ్నం], [సాయంత్రం], [రాత్రి].
   - నియమ ఖచ్చితత్వం (Strictness Toggle):
     - [కఠినమైనది (Strict - Recommended)]: ఏ మహాదోషం ఉన్నా ముహూర్తాన్ని వదిలివేస్తుంది.
     - [మితమైనది (Lenient)]: హెచ్చరికలు మరియు పరిహారాలతో చూపుతుంది.
2. Section B — వ్యక్తుల వివరాల కార్డులు (Dynamic Participant Cards):
   - Top CTA: "కుటుంబ ఖజానా నుండి ఎంచుకోండి (Choose from My Family)" shortcut button.
   - Mode Toggle per card: "నక్షత్రం నేరుగా ఎంచుకోండి (Pick Stars)" vs "జన్మ వివరాల ఆధారంగా (From Birth Details)".
   - Contextual Cards:
     - For Vivaha: వరుడు (Groom) & వధువు (Bride) కార్డులు (జన్మ నక్షత్రం 1–27, పాదం 1–4, రాశి 1–12, జ్యేష్ఠ సంతానం చెక్‌బాక్స్).
     - For Upanayana: వటువు (Vatu with DOB, Gender) + తండ్రి, తల్లి, గురువు కార్డులు.
     - For Griha / Business: యజమాని (Owner Nama-Nakshatra) + భాగస్వామి కార్డు.
3. Section C — ఈవెంట్ ప్రత్యేక వివరాలు (Event-Specific Form Group via `tab_inputs`):
   - For Griha: ప్రధాన ద్వార దిశ (Door Facing: తూర్పు, ఉత్తరం, పడమర, దక్షిణం), ప్లాట్ దిశ, ఇంటి రకం (నూతన / పాత / అద్దె).
   - For Travel: ప్రయాణ దిశ (8 దిశలు), ప్రయాణ ఉద్దేశం, వాహన రకం.
   - For Vehicle: వాహన రకం (ద్విచక్ర / నాలుగు చక్రాల / వాణిజ్య), డెలివరీ vs కొనుగోలు.
   - For Garbhadhana: చివరి ఋతుస్రావ మొదటి రోజు (Period start date).
   - For Dependent Events (Nutana Vadhu, Ankurarpana, Pitru): ప్రధాన ఈవెంట్ తేదీ (Main event date).
4. Action Bar:
   - "శుభ ముహూర్తాలను శోధించండి (Scan Auspicious Muhurtams)" button in thick green (#3C6600) with gold glow.


<!-- ============================================================================== -->
<!-- STITCH PROMPT 7: RANKED MUHURTAM CANDIDATE RESULTS STREAM                     -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1440px) or Mobile (390px).
Persona: Seeker reviewing the computed auspicious windows returned by the algorithm.
Purpose: Display ranked list of candidate windows with score dials, grade badges, and Pushkara highlights.
Tokens:
- Uttama (Best 75-100%): Forest Green #2E6E00 (Bg: #EBF7E1, Dark Bg: #152B09)
- Madhyama (Middling 50-74%): Amber #A05A00 (Bg: #FFF4E0, Dark Bg: #2C1F04)
- Nishiddha (Avoid 0-49%): Crimson #B42318 (Bg: #FEECEB, Dark Bg: #300C09)
- Accent Gold: #D4AF37
Language: Telugu (తెలుగు) primary.

[Layout]
Header with search metrics ("హైదరాబాద్‌లో 30 రోజులు శోధించబడింది · 14 శుభ ముహూర్తాలు లభించాయి"), filter chips, and a vertical list of rich Candidate Cards.

[Components]
1. శోధన సారాంశం (Search Overview Header):
   - ఈవెంట్: "నూతన గృహప్రవేశము · Griha Pravesha"
   - మెట్రిక్స్: శోధించిన కాలం ("12 నవంబర్ – 12 డిసెంబర్ 2026") · పద్ధతి: దృక్సిద్ధాంతం · గరిష్ఠ స్కోరు: 98%.
   - Filter Chips: అన్ని ముహూర్తాలు (14) · ఉత్తమ ముహూర్తాలు (9) · ఉదయ కాలం (6) · పుష్కర లగ్నం (4).
2. ముహూర్త కార్డు నిర్మాణం (Candidate Window Card Anatomy):
   - ఎడమ కాలమ్ (తేదీ & వారం):
     - పెద్ద సంఖ్య ("12"), నెల ("నవంబర్ 2026"), వారం ("గురువారం · Thursday").
     - సూర్యోదయ దినం ట్యాగ్.
   - మధ్య కాలమ్ (లగ్న సమయం & జ్యోతిష్య వివరాలు):
     - సమయ వ్యవధి: "ఉదయం 06:43:15 – 07:47:16".
     - వ్యవధి: "64 నిమిషాలు · 2.67 ఘడియలు".
     - లగ్నం: "వృశ్చిక లగ్నం (0°13') · నవాంశ: మీన నవాంశ".
     - అత్యుత్తమ క్షణం (Gold Highlight ✦): "ఉదయం 07:12 కు పుష్కర భాగ లగ్నం — అమృత ఘడియలు".
     - శుభ అంశాలు: "తారాబలం: క్షేమ తార (ఉత్తమం)", "చంద్రబలం: 11వ ఇల్లు (ఉత్తమం)", "సిద్ధి యోగం (+2 పాయింట్లు)".
   - కుడి కాలమ్ (స్కోరు & తీర్పు):
     - వృత్తాకార స్కోరు మీటర్: "98%".
     - గ్రేడ్ బ్యాడ్జ్:
       - 75–100%: "ఉత్తమ ముహూర్తం (Uttama - Best)" in Green (#2E6E00).
       - 50–74%: "మధ్యమ ముహూర్తం (Madhyama)" in Amber (#A05A00).
       - 0–49%: "నిషిద్ధం (Avoid)" in Crimson (#B42318).
     - Action Button: "సంపూర్ణ కుండలి & దోష నివారణ వివరాలు ➔".
3. Empty State (ముహూర్తాలు లభించనప్పుడు):
   - Panel showing `rejection_summary`: "47 లగ్నాలు కర్తరీ దోషం వల్ల తిరస్కరించబడ్డాయి; 18 మంగళ/శనివారాల వల్ల రద్దు చేయబడ్డాయి".


<!-- ============================================================================== -->
<!-- STITCH PROMPT 8: CANDIDATE DETAIL AUDIT SHEET & D1 CHART DRAWER               -->
<!-- ============================================================================== -->

[Context]
Viewport: Slide-over Drawer (Desktop 640px) or Full Modal (Mobile).
Persona: Astrologer or meticulous seeker inspecting the planetary Kundali and 21 Mahadosha clearances before finalizing.
Purpose: Complete technical audit including South Indian 4x4 chart, dosha checklist, and PDF export.
Tokens: Primary: #3C6600; Gold: #D4AF37; Uttama: #2E6E00; Danger: #B42318; Pariharam: #6B21A8; Card: #FFFFFF.
Language: Telugu (తెలుగు) primary with Sanskrit/Telugu shlokas.

[Layout]
Header with window timestamp and action buttons, followed by 5 scrollable panels:
(1) Verdict & Planetary Strengths, (2) Cut-by Timeline, (3) 21 Mahadoshas Audit Table, (4) South Indian D1 Chart Widget, (5) Pariharas & Shlokas.

[Components]
1. Header & Actions:
   - Title: "వృశ్చిక లగ్న ముహూర్త పరిశీలన · 12 నవంబర్ 2026".
   - Action Buttons: "నా ముహూర్తాలలో భద్రపరచు (Save to My Muhurthas)" · "అధికారిక పీడీఎఫ్ డౌన్‌లోడ్ (PDF Certificate)" · "వాట్సాప్‌లో పంచుకోండి (Share)".
2. ప్యానెల్ 1 — గ్రహ బలాలు & స్థితి:
   - Summary: "ఉత్తమ ముహూర్తం: ప్రధాన నియమాలు ఉత్తీర్ణత; 0 తీవ్ర దోషాలు; లగ్నం పుష్కర నవాంశలో కలదు."
   - గురు & శుక్ర స్థితి: గురుడు (శుద్ధ స్థితి - మౌఢ్యమి లేదు), శుక్రుడు (శుద్ధం), చంద్రుడు (శుక్ల పక్షం - 84% ప్రకాశం).
3. ప్యానెల్ 2 — వర్జ్య సమయాల పరిశీలన (Cut-By Timeline):
   - Visual bar showing the overlap with Yamagandam or Durmuhurtam with red strikethrough.
4. ప్యానెల్ 3 — 21 మహాదోషాల సమగ్ర పరిశీలన (21 Mahadosha Audit Table):
   - Table rows for all 21 classical doshas:
     - 1. పంచాంగ శుద్ధి-హీన: [ఉత్తీర్ణం ✔]
     - 2. కర్తరీ దోషం (పాప గ్రహాలు 2/12 లో లేవు): [ఉత్తీర్ణం ✔]
     - 3. లగ్నాష్టమ శుద్ధి (8వ ఇంట్లో గ్రహాలు లేవు): [అష్టమ శుద్ధి నిర్ధారితం ✔]
     - 4. భృగు షట్క దోషం (6వ ఇంట్లో శుక్రుడు లేడు): [ఉత్తీర్ణం ✔]
     - 5. కుజాష్టమ దోషం (8వ ఇంట్లో కుజుడు లేడు): [ఉత్తీర్ణం ✔]
     - 6. గండాంత / త్రికోణ దోషం: [ఉత్తీర్ణం ✔]
   - Icons: ఆకుపచ్చ టిక్ (Pass), ఎరుపు హెచ్చరిక (Fail), ఊదా కమలం (Pariharam Relieved).
5. ప్యానెల్ 4 — దక్షిణ భారత కుండలి చక్రం (South Indian 4x4 D1 Chart Widget):
   - Traditional 4x4 Grid (Pisces Meena top-left to Aries Mesha, Taurus, Gemini... clockwise).
   - Center Box: Gayatri Jyothirnidhe watermark with "D1 లగ్న కుండలి · వృశ్చిక లగ్నం".
   - Planetary labels: రవి ☉, చంద్ర ☽, కుజ ♂, బుధ ☿, గురు ♃, శుక్ర ♀, శని ♄, రాహు ☊, కేతు ☋.
   - Indicators: (వ) వక్ర గ్రహాలు (Retrograde), (మౌ) మౌఢ్య గ్రహాలు (Combust).
6. ప్యానెల్ 5 — దోష పరిహార శ్లోకాలు (Parihara Shlokas):
   - Telugu/Sanskrit script verse: "కేంద్రే దేవగురుః స్థితః సర్వదోష హరం శ్రేష్ఠం..."
   - వివరణ: "కేంద్రంలో గురువు ఉండటం వల్ల లక్ష దోషాలు నివారించబడతాయి."
   - గ్రంథ ప్రమాణం: ముహూర్త దీపిక, 4వ అధ్యాయం, 118వ పుట.


<!-- ============================================================================== -->
<!-- STITCH PROMPT 9: STANDALONE SPECIAL YOGAS DISCOVERY TOOL (/muhurta/yogas)       -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1200px) and Mobile.
Persona: Seeker looking for auspicious yogas (Siddhi, Amrita Siddhi, Sarvartha Siddhi) for general success without choosing a single activity.
Purpose: Search and display windows where divine yogas form.
Tokens: Primary: #3C6600; Gold: #D4AF37; Canvas: #F9FBF6; Card: #FFFFFF.
Language: Telugu (తెలుగు) primary with English labels.

[Layout]
Top configuration bar with Yoga multi-select chips and Condition checkboxes; bottom stream of Date-grouped yoga result cards.

[Components]
1. యోగాల ఎంపిక (Yoga Multi-Select Chips):
   - [సిద్ధి యోగం · Siddhi Yoga] (Selected)
   - [అమృత సిద్ధి యోగం · Amrita Siddhi Yoga] (Selected)
   - [సర్వార్థ సిద్ధి యోగం · Sarvartha Siddhi Yoga] (Selected)
   - [ద్విపుష్కర యోగం · Dvipushkara Yoga]
   - [త్రిపుష్కర యోగం · Tripushkara Yoga]
2. అనుకూల షరతులు (Favorable Condition Checkboxes):
   - [✔] అభిజిత్ ముహూర్తమై ఉండాలి
   - [✔] పుష్కర నవాంశ కలిగి ఉండాలి
   - [✔] పంచక రహితమై ఉండాలి (Panchaka-free)
   - [✔] రాహు, యమ, గుళిక కాలాలు లేనిదిగా ఉండాలి
   - [ ] నా నక్షత్రానికి తారాబలం అనుకూలంగా ఉండాలి (ఎంచుకోండి)
   - [ ] చంద్రబలం అనుకూలంగా ఉండాలి
3. ఫలితాల జాబితా (Results Stream):
   - Date-grouped cards (e.g. "బుధవారం, 11 నవంబర్ 2026").
   - Time window bar: "ఉదయం 06:22 – 07:46 (84.4 నిమిషాలు)".
   - Badges: అమృత సిద్ధి యోగం బ్యాడ్జ్ (ఆకుపచ్చ) + రాహు/యమ రహిత టిక్.


<!-- ============================================================================== -->
<!-- STITCH PROMPT 10: STANDALONE PITRU KARMA CALENDAR TOOL (/muhurta/pitru-calendar)-->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1200px).
Persona: Karta (eldest son/family representative) scheduling Shraddha and memorial rites with precision.
Purpose: 3 distinct modes for computing death anniversaries, after-death 12-day ceremonies, and 96 Shannavati Shraddhas.
Tokens: Canvas: #F9FBF6; Card: #FFFFFF; Primary: #3C6600; Dark Sage: #4E5B42; Border: #D5DEC9.
Language: Telugu (తెలుగు) primary.

[Layout]
3-Way Segmented Control at top, dynamic inputs based on mode, and timeline/calendar visualization below.

[Components]
1. మోడ్ ఎంపిక (3-Way Mode Switcher):
   - [విధానం 1: సాంవత్సరిక శ్రాద్ధం (Annual Shraddha)]
   - [విధానం 2: అపర కర్మల కాలక్రమం (After-Death Rites 12 Days & Masikas)]
   - [విధానం 3: షణ్ణవతి శ్రాద్ధ దినాలు (96 Shannavati Shraddhas Calendar)]
2. వివరాల నమోదు (Inputs):
   - స్వర్గస్తులైన తేదీ & ఖచ్చితమైన సమయం (Date & Time of passing).
   - సంవత్సరాల సంఖ్య (1 నుండి 10 సంవత్సరాలు).
   - ప్రదేశం (అపరాహ్న కాల గణన కొరకు).
3. విధానం 1 ఫలితం — సాంవత్సరిక శ్రాద్ధ పట్టిక:
   - అమాంత మాసం, తిథి పేరు, మరియు అపరాహ్న వ్యాప్తి అత్యధికంగా ఉన్న గ్రెగోరియన్ తేదీల జాబితా.
4. విధానం 2 ఫలితం — 25+ అపర కర్మల నిలువు టైమ్‌లైన్:
   - మొదటి 12 రోజులు: తిలోదక, వాసోదక దినాలు (1–10వ రోజు), ఏకాదశాహం (11వ రోజు), సపిండీకరణం (12వ రోజు).
   - మాసికములు (1 నుండి 12వ మాసికం).
   - మొదటి ఆబ్దికం (ప్రథమ వర్ధంతి శ్రాద్ధం).
5. విధానం 3 ఫలితం — షణ్ణవతి 96 శ్రాద్ధ దినాల క్యాలెండర్:
   - Filterable Month-by-month calendar view with count tags: అమావాస్య (13), సంక్రాంతి (12), మహాలయ (15), వ్యతీపాత (14), వైధృతి (14), యుగాది (4), అష్టక (5).


<!-- ============================================================================== -->
<!-- STITCH PROMPT 11: SAVED MUHURTHAMS & REPORT EXPORT WORKSPACE (/me/saved)       -->
<!-- ============================================================================== -->

[Context]
Viewport: Desktop (1200px) and Tablet.
Persona: User managing saved searches, favorite Muhurthams, notes, and printing certificates.
Purpose: Personal repository of chosen auspicious times with 1-click re-calculation and PDF export.
Tokens: Canvas: #F9FBF6; Card: #FFFFFF; Primary: #3C6600; Gold: #D4AF37; Uttama: #2E6E00.
Language: Telugu (తెలుగు) primary with English labels.

[Layout]
Header with search/filter, followed by a responsive grid of Saved Muhurtham Cards with pinned favorites first.

[Components]
1. సెర్చ్ & ఫిల్టర్ టూల్‌బార్:
   - శోధన ఇన్‌పుట్: "నా ముహూర్తాలలో వెతకండి (కార్యం లేదా వ్యక్తి పేరు)..."
   - ఫిల్టర్ చిప్స్: అన్నీ (8) · అభిమాన ముహూర్తాలు ⭐ (3) · వివాహం (2) · గృహప్రవేశం (3) · వాహనం (1).
2. భద్రపరచిన ముహూర్తం కార్డు (Saved Muhurtham Card):
   - బంగారు నక్షత్రం (Favorite Star Toggle).
   - శీర్షిక: "నూతన గృహప్రవేశం — జూబ్లీహిల్స్ స్వగృహం".
   - ఎంచుకున్న ముహూర్తం: "12 నవంబర్ 2026, ఉదయం 06:43 – 07:47 (ఉత్తమ ముహూర్తం 98%)".
   - ప్రధాన వ్యక్తులు: "వెంకటరావు (యజమాని) & లక్ష్మి (భార్య)".
   - గమనికలు: "శర్మగారి ఆధ్వర్యంలో గృహప్రవేశం; ఉదయం 07:12 పుష్కర భాగ సమయంలో సింహద్వార ప్రవేశం."
   - బటన్లు:
     - "మళ్ళీ లెక్కించండి (Rerun Search)" — గ్రహ సంచారం మారలేదని నిర్ధారించడానికి.
     - "పీడీఎఫ్ పత్రం (Download PDF Certificate)".
     - "వాట్సాప్ సందేశం (Share via WhatsApp)".
     - "తొలగించు (Delete)".
3. డేటా ఎక్స్‌పోర్ట్ & ఖాతా భద్రత:
   - "నా సమగ్ర డేటాను డౌన్‌లోడ్ చేసుకోండి (Download My Data JSON)" (`GET /me/export`).
   - "ఖాతాను పూర్తిగా తొలగించండి (Delete My Account & Sealed Vault)" (`POST /me/delete`).
```

---

# SECTION 4: Component Architecture & Technical Contracts

### 4.1 South Indian Astrological Chart (D1 Kundali Grid)
The chart MUST be implemented as a responsive 4x4 CSS grid:
```css
.d1-kundali-chart {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  aspect-ratio: 1 / 1;
  max-width: 440px;
  border: 2px solid var(--color-accent-gold);
  background-color: var(--color-bg-canvas);
  position: relative;
}
.d1-center-box {
  grid-column: 2 / span 2;
  grid-row: 2 / span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-gold);
  background: radial-gradient(circle, var(--color-primary-soft) 0%, var(--color-bg-canvas) 100%);
  text-align: center;
}
.d1-rashi-cell {
  border: 1px solid var(--color-border);
  padding: 6px;
  font-size: 11px;
  background-color: var(--color-bg-surface);
}
```

### 4.2 Score Badge & Verdict Matrix
| Score Range | Verdict (Telugu) | Verdict (English) | Light Badge Background | Dark Badge Background | Text / Border |
|---|---|---|---|---|---|
| **75 – 100** | ఉత్తమ ముహూర్తం | Uttama (Best) | `#EBF7E1` | `#152B09` | `#2E6E00` / `#7CD836` |
| **50 – 74** | మధ్యమ ముహూర్తం | Madhyama (Middling) | `#FFF4E0` | `#2C1F04` | `#A05A00` / `#FBBF24` |
| **0 – 49** | నిషిద్ధం | Nishiddha (Avoid) | `#FEECEB` | `#300C09` | `#B42318` / `#F87171` |

---

# SECTION 5: How to Use this Prompt in Stitch

1. Open Stitch or your AI design assistant.
2. Set the Design Style to **Custom / Gayathri Jyothirnidhe Vedic Green & Gold** using the color tokens defined in Section 1.2:
   - Primary: `#3C6600` (Thick Tulasi Green)
   - Secondary / Accent: `#D4AF37` (Swarna Gold)
   - Light Canvas: `#F9FBF6` (Dew Parchment)
   - Dark Canvas: `#0E1508` (Midnight Forest)
3. Set the application logo to the attached circular **Gayathri Jyothirnidhe** medallion (`gayathri_jyothirnidhe_logo.jpg`).
4. Set default language to **Telugu (`te`)** and default theme to **Light (`light`)**, while ensuring dark mode tokens are enabled.
5. Sequentially input Prompts 1 through 11 from Section 3 to build the complete, high-fidelity responsive UI template suite.
