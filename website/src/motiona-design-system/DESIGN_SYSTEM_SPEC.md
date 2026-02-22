# MotionA Enterprise Design System
**Version:** 1.0.0  
**Last Updated:** February 2026  
**Author:** MotionA Engineering

---

## Executive Summary

Unified enterprise frontend framework for all MotionA products (ArgenPOS, IronHub, IronTrain, LinkNexus, NightHub, TurnoPro). Industrial-technical aesthetic with focus on clarity, functionality, and zero visual debt.

---

## Design Philosophy

### Core Principles
1. **Industrial Clarity**: Technical precision over decorative elements
2. **Grid Supremacy**: Visible, rigid grid structures guide all layouts
3. **Zero Decoration**: No gradients, shadows, or rounded corners (exceptions documented)
4. **Typographic Hierarchy**: Monospace for system, Sans-serif for content
5. **Functional Animation**: Mechanical transitions <300ms, purpose-driven
6. **Mobile-First**: All components responsive from 320px to 1920px

### Visual Identity
- **Aesthetic**: Swiss/Brutalist industrial design
- **Primary Font**: Helvetica Neue, Arial (content)
- **Monospace Font**: Courier New, Consolas (labels, technical)
- **Geometry**: 90-degree angles, 1px borders, zero border-radius
- **Color Philosophy**: Neutral base + single accent color per brand

---

## Design Tokens

### Color System

```css
:root {
  /* Base Colors - Universal */
  --line-color: #000000;           /* Primary borders and dividers */
  --bg-color: #f4f4f0;             /* Warm cream background */
  --panel-color: #e8e8e8;          /* Secondary panel background */
  --ink: #000000;                  /* Primary text color */
  --muted: #333333;                /* Secondary text */
  --muted-2: #5a5a5a;              /* Tertiary text */
  
  /* Brand Accents - Per Project Override */
  --accent: #ff4d00;               /* Default: Industrial orange */
  --accent-hover: #e64400;
  
  /* Semantic Colors */
  --success: #16A34A;
  --success-fg: #FFFFFF;
  --warning: #CA8A04;
  --warning-fg: #FFFFFF;
  --error: #DC2626;
  --error-fg: #FFFFFF;
  --info: #0284C7;
  --info-fg: #FFFFFF;
}
```

### Brand-Specific Accents
- **ArgenPOS**: `--accent: oklch(0.40 0.14 15)` (Burgundy)
- **IronHub**: `--accent: #ff4d00` (Industrial Orange)
- **IronTrain**: `--accent: #0066CC` (Athletic Blue)
- **LinkNexus**: `--accent: #7C3AED` (Tech Purple)
- **NightHub**: `--accent: #000000` (Pure Black)
- **TurnoPro**: `--accent: #059669` (Medical Green)

### Typography Scale

```css
--font-sans: 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'Courier New', Consolas, monospace;

/* Type Scale */
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
--text-5xl: 3rem;        /* 48px */
--text-6xl: 4rem;        /* 64px */
--text-hero: 4.6rem;     /* 74px - Landing hero */

/* Line Heights */
--leading-none: 0.9;
--leading-tight: 1.1;
--leading-normal: 1.4;
--leading-relaxed: 1.6;

/* Letter Spacing */
--tracking-tight: -2px;   /* Large headings */
--tracking-normal: 0;
--tracking-wide: 0.5px;   /* Mono labels */
--tracking-wider: 1px;    /* System labels */
```

### Spacing Scale

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.5rem;    /* 24px */
--space-6: 2rem;      /* 32px */
--space-8: 3rem;      /* 48px */
--space-10: 4rem;     /* 64px */
--space-12: 6rem;     /* 96px */
--space-16: 8rem;     /* 128px */
```

### Transitions

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-bounce: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Breakpoints

```css
--breakpoint-xs: 320px;
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1440px;
--breakpoint-2xl: 1920px;
```

---

## Component Library

### Layout Components

#### MasterGrid
Three-column industrial layout with visible borders.

**Structure:**
```
[Sidebar 250px] | [Main 1fr] | [Rail 300px]
```

**Responsive:**
- Desktop (>1024px): 3-column grid
- Tablet/Mobile (<1024px): Stacked single column

#### Container
Max-width content container with responsive padding.

**Variants:**
- `container-sm`: 640px max-width
- `container-md`: 768px max-width
- `container-lg`: 1024px max-width
- `container-xl`: 1280px max-width
- `container-2xl`: 1536px max-width
- `container-full`: 100% width

### Typography Components

#### SystemLabel
Uppercase monospace label with brackets.

**Format:** `[ LABEL TEXT ]`

**Properties:**
- Font: Courier New
- Size: 0.75rem (12px)
- Transform: Uppercase
- Tracking: 1px
- Opacity: 0.7

#### HeroTitle
Large display heading for landing pages.

**Properties:**
- Size: 4.6rem desktop, 3.2rem mobile
- Line height: 0.9
- Letter spacing: -2px
- Font weight: 600

#### SectionHeading
Secondary heading for content sections.

**Properties:**
- Size: 2.8rem
- Line height: 0.95
- Letter spacing: -2px
- Font weight: 600

### Form Components

#### Input
Industrial text input with borders.

**States:**
- Default: 1px solid black border
- Focus: 1px ring, no border-radius
- Disabled: Opacity 0.5
- Error: Red border
- Success: Green border

**Types:**
- Text
- Email
- Password
- Number
- Tel
- URL
- Search
- Textarea

#### Button
Primary action trigger with mechanical hover.

**Variants:**
1. **Primary (CTA)**
   - Background: var(--accent)
   - Color: White
   - Hover: translateY(-4px) + 10px shadow

2. **Secondary (Ghost)**
   - Background: Transparent
   - Border: 1px solid black
   - Hover: Black background, white text

3. **Danger**
   - Background: var(--error)
   - Color: White

4. **Disabled**
   - Opacity: 0.5
   - Cursor: not-allowed

#### Select
Dropdown selector with industrial styling.

**Properties:**
- Border: 1px solid black
- Background: var(--panel-color)
- No rounded corners
- Custom arrow icon

#### Checkbox / Radio
Square checkboxes, no rounded radio buttons.

**Properties:**
- Size: 16px x 16px
- Border: 1px solid black
- Checked: Black fill + white checkmark

### Card Components

#### Panel
Basic container with border.

**Properties:**
- Border: 1px solid var(--line-color)
- Background: var(--panel-color)
- Padding: 1.5rem
- No shadow, no border-radius

#### FeatureCard
Card for showcasing features.

**Structure:**
- Icon box (40px x 40px bordered)
- Title (bold, 1.125rem)
- Description (0.875rem, muted)

#### StatCard
Metric display card.

**Structure:**
- Value (large, bold)
- Label (small, monospace, uppercase)

### Navigation Components

#### Header
Top navigation bar with brand and links.

**Structure:**
- Logo/Brand
- Navigation links
- CTA button

**Properties:**
- Border-bottom: 1px solid black
- Background: var(--bg-color)
- Sticky positioning

#### Footer
Bottom site information.

**Structure:**
- Multiple columns on desktop
- Stacked on mobile
- Legal links, social, contact

#### Breadcrumbs
Navigation trail with separators.

**Format:** `Home / Section / Page`

**Properties:**
- Font: Monospace
- Size: 0.75rem
- Separator: `/` or `>`

### Authentication Components

#### AccessCard
Login/Register unified component.

**Features:**
- Tab switching (Login/Register)
- Email + Password fields
- Magic link option (optional)
- Remember me checkbox
- Forgot password link
- Social auth buttons (optional)

**States:**
- Loading (spinner)
- Error (red banner)
- Success (green banner)

#### MagicLinkSent
Confirmation screen after magic link sent.

**Structure:**
- Success icon
- Confirmation message
- Resend option
- Back to login link

### Feedback Components

#### Toast
Temporary notification overlay.

**Variants:**
- Success (green)
- Error (red)
- Warning (yellow)
- Info (blue)

**Properties:**
- Position: Bottom-right
- Duration: 3-5 seconds
- Animation: Slide in from right

#### Modal
Centered overlay dialog.

**Properties:**
- Backdrop: Black 50% opacity
- Container: White, bordered
- Close button: Top-right X
- Escape key to close

#### Banner
Full-width informational bar.

**Variants:**
- Info (blue)
- Warning (yellow)
- Error (red)
- Success (green)

---

## Animation Guidelines

### Principles
1. **Purpose-Driven**: Every animation serves UX purpose
2. **Fast**: Max 300ms for all transitions
3. **Mechanical**: Industrial feel, not organic
4. **Consistent**: Same timing across similar actions

### Standard Animations

#### Hover Effects
```css
/* Button CTA */
transform: translateY(-4px);
box-shadow: 0 10px 0 var(--line-color);
transition: transform 200ms ease;

/* Link */
opacity: 0.7;
transition: opacity 150ms ease;
```

#### Page Transitions
```css
/* Fade In */
opacity: 0 → 1
duration: 200ms

/* Slide Up */
transform: translateY(20px) → translateY(0)
opacity: 0 → 1
duration: 300ms
```

#### Loading States
```css
/* Spinner */
border: 2px solid var(--line-color)
border-top: transparent
animation: spin 1s linear infinite
```

---

## Responsive Design

### Mobile-First Approach
Design for 320px first, enhance upward.

### Breakpoint Strategy
```css
/* xs: 320px - Default (mobile) */
/* sm: 640px - Large phones */
/* md: 768px - Tablets */
/* lg: 1024px - Laptops */
/* xl: 1440px - Desktops */
/* 2xl: 1920px - Large monitors */
```

### Grid Adjustments
- **Mobile**: Single column, stacked
- **Tablet**: 2 columns
- **Desktop**: 3-4 columns

### Typography Scaling
- Hero: 3.2rem mobile → 4.6rem desktop
- Section: 2rem mobile → 2.8rem desktop
- Body: 0.875rem mobile → 1rem desktop

---

## Accessibility Standards

### WCAG 2.1 Level AA Compliance

#### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

#### Keyboard Navigation
- All interactive elements focusable
- Visible focus indicators
- Logical tab order
- Escape key closes modals

#### Screen Readers
- Semantic HTML (nav, main, article, aside)
- ARIA labels where needed
- Alt text for images
- Form labels associated with inputs

#### Focus Management
- Focus ring: 2px solid, high contrast
- Skip to main content link
- Focus trap in modals

---

## Performance Optimization

### Core Web Vitals Targets
- **LCP** (Largest Contentful Paint): <2.5s
- **FID** (First Input Delay): <100ms
- **CLS** (Cumulative Layout Shift): <0.1

### Strategies
1. **Lazy Loading**: Images and below-fold components
2. **Code Splitting**: Route-based chunks
3. **Critical CSS**: Inline above-fold styles
4. **Font Loading**: font-display: swap
5. **Image Optimization**: WebP format, responsive sizes

### Asset Optimization
- Logos: SVG (preferred) or PNG with 2x/3x versions
- Images: WebP with fallback
- Icons: Inline SVG or icon font
- Minified CSS/JS in production

---

## Testing Requirements

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Device Testing
- iPhone SE (320px)
- iPhone 12 (390px)
- iPad (768px)
- Desktop 1080p (1920px)
- Desktop 4K (3840px)

### Automated Testing
- Unit tests: Component functionality
- E2E tests: Critical user flows
- Visual regression: Component snapshots
- Accessibility: axe-core automated checks

---

## Implementation Checklist

### Per-Project Integration
- [ ] Install shared design tokens (CSS variables)
- [ ] Implement component library
- [ ] Refactor existing pages to new system
- [ ] Update theme configuration
- [ ] Test responsive breakpoints
- [ ] Validate accessibility
- [ ] Measure Core Web Vitals
- [ ] Document project-specific customizations

### Quality Gates
- [ ] All components use design tokens
- [ ] Zero !important in CSS
- [ ] No inline styles in components
- [ ] All interactive elements keyboard accessible
- [ ] Color contrast ratios validated
- [ ] Mobile layouts tested on real devices
- [ ] Load time <3s on 3G

---

## File Structure

```
.motiona-design-system/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   └── transitions.css
├── components/
│   ├── layout/
│   │   ├── MasterGrid.tsx
│   │   ├── Container.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── forms/
│   │   ├── Input.tsx
│   │   ├── Button.tsx
│   │   ├── Select.tsx
│   │   └── Checkbox.tsx
│   ├── auth/
│   │   ├── AccessCard.tsx
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── feedback/
│   │   ├── Toast.tsx
│   │   ├── Modal.tsx
│   │   └── Banner.tsx
│   └── display/
│       ├── Card.tsx
│       ├── FeatureCard.tsx
│       └── StatCard.tsx
├── styles/
│   ├── base.css          (Normalize + base styles)
│   ├── utilities.css     (Utility classes)
│   └── responsive.css    (Media queries)
├── utils/
│   ├── validation.ts     (Form validation)
│   ├── api.ts           (API helpers)
│   └── hooks.ts         (React hooks)
└── docs/
    ├── components.md     (Component documentation)
    ├── tokens.md        (Design token reference)
    └── examples/        (Live examples)
```

---

## Version History

- **1.0.0** (Feb 2026): Initial release, unified system across 6 products
