# MotionA Enterprise Design System

**Version 1.0.0** - Unified frontend framework for all MotionA products.

## Overview

Industrial-technical design system with focus on clarity, functionality, and zero visual debt. Implements Swiss/Brutalist aesthetic with rigid grid structures, monospace typography, and mechanical interactions.

## Products Using This System

- **ArgenPOS** - POS Management System (Burgundy accent)
- **IronHub** - Gym Management Platform (Industrial Orange accent)
- **IronTrain** - Fitness Training App (Athletic Blue accent)
- **LinkNexus** - Link Management System (Tech Purple accent)
- **NightHub** - Nightlife Management Platform (Pure Black accent)
- **TurnoPro** - Appointment Management System (Medical Green accent)

## Installation

### In Your Project

```bash
# Copy design system to your project
cp -r .motiona-design-system ./src/design-system

# Or symlink for shared development
ln -s ../.motiona-design-system ./src/design-system
```

### Import Styles

```tsx
// In your root layout or _app file
import './design-system/styles/base.css';
import './design-system/styles/components.css';
import './design-system/styles/layouts.css';
import './design-system/styles/utilities.css';
```

### Set Brand Accent

```tsx
// In your root layout
<body data-brand="ironhub">
  {children}
</body>
```

Available brands: `argenpos`, `ironhub`, `irontrain`, `linknexus`, `nighthub`, `turnopro`

## Components

### Forms

```tsx
import { Input, Button, Select, Checkbox } from './design-system/components';

<Input 
  label="Email" 
  type="email" 
  error="Email requerido" 
/>

<Button variant="primary" isLoading={loading}>
  Enviar →
</Button>

<Select 
  label="País" 
  options={[
    { value: 'ar', label: 'Argentina' },
    { value: 'br', label: 'Brasil' }
  ]} 
/>

<Checkbox 
  label="Acepto términos y condiciones" 
  checked={accepted}
  onChange={(e) => setAccepted(e.target.checked)}
/>
```

### Authentication

```tsx
import { AccessCard } from './design-system/components';

<AccessCard
  brandName="IronHub"
  initialPanel="login"
  onLogin={async (email, password) => {
    // Handle login
  }}
  onRegister={async (data) => {
    // Handle registration
  }}
  allowRegister={true}
  allowMagicLink={true}
/>
```

### Layout

```tsx
import { Header, Footer } from './design-system/components';

<Header
  brandName="IronHub"
  navigation={[
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' }
  ]}
  ctaButton={{ label: 'Acceder', href: '/login' }}
/>

<Footer
  brandName="IronHub"
  sections={[
    {
      title: 'Producto',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' }
      ]
    }
  ]}
/>
```

### Display

```tsx
import { Card, FeatureCard } from './design-system/components';

<Card hover>
  <h3>Título</h3>
  <p>Contenido...</p>
</Card>

<FeatureCard
  icon={<DumbbellIcon />}
  title="Gestión de Socios"
  description="Control completo de membresías y pagos"
/>
```

## CSS Classes

### Typography

```html
<h1 class="motiona-hero-title">Hero Title</h1>
<h2 class="motiona-section-heading">Section Heading</h2>
<p class="motiona-subtitle">Subtitle text</p>
<span class="motiona-label">System Label</span>
<span class="motiona-badge">V2.0</span>
<span class="motiona-meta-text">Metadata</span>
```

### Layout

```html
<div class="motiona-container motiona-container-xl">
  <div class="motiona-grid-3">
    <div class="motiona-card">Card 1</div>
    <div class="motiona-card">Card 2</div>
    <div class="motiona-card">Card 3</div>
  </div>
</div>
```

### Components

```html
<button class="motiona-btn-primary">Primary Action</button>
<button class="motiona-btn-secondary">Secondary Action</button>
<input class="motiona-input" />
<select class="motiona-select"></select>
<div class="motiona-panel">Panel content</div>
<div class="motiona-stat">
  <div class="value">99.9%</div>
  <div class="label">Uptime</div>
</div>
```

## Design Tokens

### Colors

```css
var(--line-color)     /* #000000 */
var(--bg-color)       /* #f4f4f0 */
var(--panel-color)    /* #e8e8e8 */
var(--ink)            /* #000000 */
var(--muted)          /* #333333 */
var(--accent)         /* Brand-specific */
var(--success)        /* #16A34A */
var(--warning)        /* #CA8A04 */
var(--error)          /* #DC2626 */
```

### Typography

```css
var(--font-sans)      /* Helvetica Neue, Arial */
var(--font-mono)      /* Courier New, Consolas */
var(--text-xs)        /* 0.75rem */
var(--text-hero)      /* 4.6rem */
```

### Spacing

```css
var(--space-1)        /* 0.25rem / 4px */
var(--space-4)        /* 1rem / 16px */
var(--space-8)        /* 3rem / 48px */
```

### Transitions

```css
var(--transition-fast)  /* 150ms */
var(--transition-base)  /* 200ms */
var(--transition-slow)  /* 300ms */
```

## Responsive Breakpoints

```css
320px   /* xs - Mobile */
640px   /* sm - Large phones */
768px   /* md - Tablets */
1024px  /* lg - Laptops */
1440px  /* xl - Desktops */
1920px  /* 2xl - Large monitors */
```

## Design Principles

1. **Zero Visual Debt**: No gradients, shadows, or rounded corners
2. **Grid Supremacy**: Visible borders, rigid structures
3. **Monospace Labels**: System text in Courier New
4. **Mechanical Animations**: Fast (<300ms), purpose-driven
5. **Mobile-First**: Design from 320px upward
6. **Accessibility**: WCAG 2.1 AA compliant

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Targets

- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

## Documentation

- [Full Design System Spec](./DESIGN_SYSTEM_SPEC.md)
- Component examples in `/docs/examples/`
- Tokens reference in `/docs/tokens.md`

## License

MIT - MotionA Engineering © 2026
