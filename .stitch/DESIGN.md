# DESIGN.md — Gayathri Jyothirnidhe (గాయత్రి జ్యోతిర్నిధి) Design System

> Source of Truth for Stitch UI Template Generation, Screen Mockups, and Frontend Component Architecture.

## 1. Design Tokens & Theme Specification

### 1.1 Color Tokens (Semantic Palette)
```css
:root {
  /* Brand Core */
  --color-primary: #3C6600;            /* Client Thick Green / Deep Tulasi */
  --color-primary-dark: #264200;       /* Sacred Bilva Deep Forest */
  --color-primary-light: #4E8200;      /* Fresh Durva Grass */
  --color-primary-soft: #EBF3DF;       /* Sage Tint Wash */

  --color-accent-gold: #D4AF37;        /* Swarna Metallic Gold (Logo Ring) */
  --color-accent-brass: #C59B27;       /* Antique Temple Brass */
  --color-accent-saffron: #C86800;     /* Deep Kumkuma Kesari */
  --color-accent-pink: #D84A78;        /* Gayatri Lotus Pink */

  /* Status Bands */
  --color-uttama: #2E6E00;             /* Uttama (Best 75-100%) Forest Emerald */
  --color-uttama-bg: #EBF7E1;
  --color-madhyama: #A05A00;           /* Madhyama (Middling 50-74%) Amber */
  --color-madhyama-bg: #FFF4E0;
  --color-nishiddha: #B42318;          /* Nishiddha (Avoid 0-49%) Crimson */
  --color-nishiddha-bg: #FEECEB;
  --color-pariharam: #6B21A8;          /* Divine Remedy Purple */
  --color-pariharam-bg: #F3E8FF;
}

/* Light Mode (Default) */
[data-theme="light"], :root {
  --color-bg-canvas: #F9FBF6;          /* Sacred Dew Parchment Canvas */
  --color-bg-surface: #FFFFFF;         /* Crisp White Card Surface */
  --color-bg-subtle: #F1F5EB;          /* Light Bilva Card Wash */

  --color-border: #D5DEC9;             /* Soft Sage Leaf Clay Divider */
  --color-border-gold: #E5C158;        /* Ornamental Gold Border */
  --color-border-active: #3C6600;      /* Primary Focus Border */

  --color-text-main: #1B2412;          /* Deep Forest Espresso Ink */
  --color-text-muted: #4E5B42;         /* Muted Sage Charcoal */
  --color-text-subtle: #7A896F;        /* Soft Khaki Green Labels */

  --shadow-card: 0 4px 16px rgba(38, 66, 0, 0.06);
  --shadow-elevation: 0 12px 32px rgba(38, 66, 0, 0.12);
}

/* Dark Mode */
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

### 1.2 Typography Stack
- **Default Regional Script**: `"Noto Sans Telugu"`, sans-serif (line-height: 1.6)
- **Display & Headings**: `"Cinzel"`, `"Outfit"`, `"Noto Sans Telugu"`, serif
- **Body & Tabular Numerical Data**: `"Inter"`, `"Noto Sans Telugu"`, -apple-system, sans-serif

---

## 2. Master Screen Templates
1. **Today's Live Panchangam Home Card** (`/dashboard/today`): 4-Anga Grid, 24-hour visual period bar, Sun/Moon times, next good window.
2. **Comprehensive Day Panchangam** (`/panchang/day-summary`): 8-fold Kala Vibhajana, 12-Lagna schedule, Panchaka Rahitam pill.
3. **17-Category Muhurta Catalog Grid** (`/muhurta/catalog`): 106 events divided across 17 traditional categories.
4. **Dynamic Event List & Sub-groups**: Land, Construction, Entry for Griha; purpose tags.
5. **Universal Dynamic Muhurta Search Form** (`/muhurta/find`): Common settings, family member shortcut, dynamic person cards, event-specific inputs (`tab_inputs`).
6. **Ranked Muhurtham Candidate Results Stream**: Candidate cards with score meter, Pushkara highlight, Uttama/Madhyama/Nishiddha verdict tags.
7. **Detailed Candidate Sheet / Modal**: 21 Mahadosha checklist, South Indian 4x4 chart widget, Cut-By timeline, book citation.
8. **Special Yogas Finder Tool** (`/muhurta/yogas`): Siddhi, Amrita Siddhi, Sarvartha Siddhi filter chips.
9. **Pitru Karma Calendar Tool** (`/muhurta/pitru-calendar`): Annual Shraddha, After-Death timeline, Shannavati 96 Shraddhas.
10. **Authentication & WhatsApp OTP Verification** (`/auth/login`, `/auth/verify-otp`, `/auth/signup`): Secure mobile onboarding with encrypted privacy.
11. **Profile, Multi-Device Sessions & Family Vault** (`/user/profile`, `/me/sessions`, `/me/family`): Confidential AES-GCM sealed birth vault for 1-click muhurta participants.
12. **Saved Muhurthams & Export Workspace** (`/me/saved`, `/me/export`): Favorite picks, rerun checks, PDF certificates, and notes.
