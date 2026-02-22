# MotionA Design System - Implementation Guide

## Quick Start Integration

### Step 1: Copy Design System to Project

```bash
# From your project root
cp -r ../.motiona-design-system ./src/motiona-design-system
```

### Step 2: Import Global Styles

In your root layout file (`app/layout.tsx` or `pages/_app.tsx`):

```tsx
import '../motiona-design-system/styles/base.css';
import '../motiona-design-system/styles/components.css';
import '../motiona-design-system/styles/layouts.css';
import '../motiona-design-system/styles/utilities.css';
```

### Step 3: Set Brand Identity

Add `data-brand` attribute to your `<body>` tag:

```tsx
<body data-brand="ironhub">
  {children}
</body>
```

**Available Brands:**
- `argenpos` - Burgundy (#5a1a1a)
- `ironhub` - Industrial Orange (#ff4d00)
- `irontrain` - Athletic Blue (#0066CC)
- `linknexus` - Tech Purple (#7C3AED)
- `nighthub` - Pure Black (#000000)
- `turnopro` - Medical Green (#059669)

---

## Component Migration Guide

### Login Page Migration

**Before (Example):**
```tsx
// Old custom login form
<form onSubmit={handleLogin}>
  <input type="email" />
  <input type="password" />
  <button>Login</button>
</form>
```

**After (Unified System):**
```tsx
import { AccessCard } from '@/motiona-design-system/components';

<AccessCard
  brandName="IronHub"
  initialPanel="login"
  onLogin={async (email, password) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    router.push('/dashboard');
  }}
  onRegister={async (data) => {
    // Handle registration
  }}
  allowRegister={true}
  allowMagicLink={true}
  onMagicLink={async (email) => {
    // Send magic link
  }}
/>
```

### Landing Page Migration

**Before:**
```tsx
<div className="hero">
  <h1>Welcome to IronHub</h1>
  <p>Description...</p>
  <button>Get Started</button>
</div>
```

**After:**
```tsx
<div className="motiona-section">
  <span className="motiona-label">Main Module</span>
  <h1 className="motiona-hero-title">
    Control Total.<br />Sin Fricción.
  </h1>
  <p className="motiona-subtitle">
    La gestión de gimnasios reinventada.
  </p>
  <button className="motiona-btn-primary">
    INICIAR SISTEMA →
  </button>
</div>
```

### Form Components

**Input Fields:**
```tsx
import { Input } from '@/motiona-design-system/components';

<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
  helperText="Usá tu correo corporativo"
  required
/>
```

**Buttons:**
```tsx
import { Button } from '@/motiona-design-system/components';

<Button 
  variant="primary" 
  isLoading={isSubmitting}
  onClick={handleSubmit}
>
  Guardar Cambios →
</Button>

<Button variant="secondary">
  Cancelar
</Button>
```

**Select Dropdown:**
```tsx
import { Select } from '@/motiona-design-system/components';

<Select
  label="País"
  options={[
    { value: 'ar', label: 'Argentina' },
    { value: 'br', label: 'Brasil' },
    { value: 'uy', label: 'Uruguay' }
  ]}
  value={country}
  onChange={(e) => setCountry(e.target.value)}
/>
```

**Checkbox:**
```tsx
import { Checkbox } from '@/motiona-design-system/components';

<Checkbox
  checked={acceptTerms}
  onChange={(e) => setAcceptTerms(e.target.checked)}
  label={
    <>
      Acepto los <a href="/terms">Términos y Condiciones</a>
    </>
  }
/>
```

---

## Layout Implementation

### Header Integration

```tsx
import { Header } from '@/motiona-design-system/components';

<Header
  brandName="IronHub"
  logo={<Image src="/logo.svg" alt="IronHub" width={40} height={40} />}
  navigation={[
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Docs', href: '/docs' }
  ]}
  ctaButton={{ 
    label: 'Acceder', 
    href: '/login' 
  }}
/>
```

### Footer Integration

```tsx
import { Footer } from '@/motiona-design-system/components';

<Footer
  brandName="IronHub"
  sections={[
    {
      title: 'Producto',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Changelog', href: '/changelog' }
      ]
    },
    {
      title: 'Recursos',
      links: [
        { label: 'Documentación', href: '/docs' },
        { label: 'API Reference', href: '/api' },
        { label: 'Status', href: '/status' }
      ]
    },
    {
      title: 'Legal',
      links: [
        { label: 'Términos', href: '/terms' },
        { label: 'Privacidad', href: '/privacy' },
        { label: 'Seguridad', href: '/security' }
      ]
    }
  ]}
  copyright="© 2026 IronHub by MotionA"
/>
```

### Container & Grid Layouts

```tsx
{/* Centered content container */}
<div className="motiona-container motiona-container-xl">
  <div className="motiona-section">
    <h2 className="motiona-section-heading mb-6">Features</h2>
    
    {/* 3-column grid (responsive) */}
    <div className="motiona-grid-3">
      <div className="motiona-card">Feature 1</div>
      <div className="motiona-card">Feature 2</div>
      <div className="motiona-card">Feature 3</div>
    </div>
  </div>
</div>
```

---

## Page Templates

### Landing Page Template

```tsx
export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="motiona-section">
        <div className="motiona-container motiona-container-xl">
          <span className="motiona-badge mb-4">V2.0 STABLE</span>
          <span className="motiona-label">Main Module</span>
          <h1 className="motiona-hero-title mb-6">
            Control Total.<br />
            <span className="motiona-gradient-text">Sin Fricción.</span>
          </h1>
          <p className="motiona-subtitle mb-8">
            La plataforma integral que transforma la manera en que administrás tu negocio.
          </p>
          <div className="flex gap-4">
            <button className="motiona-btn-primary">
              EMPEZAR AHORA →
            </button>
            <button className="motiona-btn-secondary">
              Ver Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="motiona-section">
        <div className="motiona-container motiona-container-xl">
          <h2 className="motiona-section-heading mb-12">
            Todo lo que necesitás
          </h2>
          <div className="motiona-grid-3">
            <FeatureCard
              icon={<UsersIcon />}
              title="Gestión de Usuarios"
              description="Control completo de accesos y permisos"
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Analytics"
              description="Métricas en tiempo real"
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Seguridad"
              description="Encriptación enterprise"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="motiona-section bg-panel">
        <div className="motiona-container motiona-container-xl">
          <div className="motiona-grid-4">
            <div className="motiona-stat">
              <div className="value">99.9%</div>
              <div className="label">Uptime</div>
            </div>
            <div className="motiona-stat">
              <div className="value">12ms</div>
              <div className="label">Latency</div>
            </div>
            <div className="motiona-stat">
              <div className="value">500+</div>
              <div className="label">Clientes</div>
            </div>
            <div className="motiona-stat">
              <div className="value">24/7</div>
              <div className="label">Soporte</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
```

### Login Page Template

```tsx
export default function LoginPage() {
  return (
    <AccessCard
      brandName="IronHub"
      initialPanel="login"
      onLogin={async (email, password) => {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        router.push('/dashboard');
      }}
      onRegister={async ({ email, password, fullName, organizationName }) => {
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              organization_name: organizationName,
            },
          },
        });
        if (error) throw new Error(error.message);
        router.push('/dashboard');
      }}
      allowRegister={true}
      allowMagicLink={true}
      onMagicLink={async (email) => {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw new Error(error.message);
      }}
    >
      <div className="text-center text-xs font-mono opacity-60">
        <div>STATUS: OPERATIVO</div>
        <div className="mt-2">SECURE CONNECTION</div>
      </div>
    </AccessCard>
  );
}
```

---

## CSS Class Reference

### Typography Classes

```css
.motiona-hero-title        /* 74px hero heading */
.motiona-section-heading   /* 48px section heading */
.motiona-subtitle          /* 20px large body text */
.motiona-label             /* Uppercase mono label with brackets */
.motiona-badge             /* System badge (black bg) */
.motiona-meta-text         /* Small monospace metadata */
.motiona-gradient-text     /* Accent color highlight */
```

### Component Classes

```css
.motiona-card              /* Basic bordered panel */
.motiona-panel             /* Alternative panel style */
.motiona-btn-primary       /* Primary CTA button */
.motiona-btn-secondary     /* Secondary/ghost button */
.motiona-input             /* Text input field */
.motiona-select            /* Select dropdown */
.motiona-checkbox          /* Square checkbox */
.motiona-icon-box          /* 40x40 icon container */
.motiona-stat              /* Stat display card */
```

### Layout Classes

```css
.motiona-container         /* Base container */
.motiona-container-xl      /* 1280px max-width */
.motiona-section           /* Section spacing */
.motiona-grid-2            /* 2-column grid */
.motiona-grid-3            /* 3-column grid */
.motiona-grid-4            /* 4-column grid */
.motiona-divider           /* Horizontal line */
```

---

## Best Practices

### 1. Consistent Spacing
Use design tokens for all spacing:
```tsx
<div className="mt-6 mb-8">  {/* Use utilities */}
<div style={{ marginTop: 'var(--space-6)' }}>  {/* Or tokens directly */}
```

### 2. Typography Hierarchy
Maintain clear hierarchy:
```tsx
<span className="motiona-label">Section</span>
<h1 className="motiona-hero-title">Main Title</h1>
<p className="motiona-subtitle">Subtitle</p>
<p className="text-base">Body text</p>
<span className="motiona-meta-text">Metadata</span>
```

### 3. Color Usage
Stick to defined color variables:
```css
/* Good */
background-color: var(--accent);
color: var(--muted);
border-color: var(--line-color);

/* Avoid */
background-color: #ff4d00;  /* Use var(--accent) instead */
```

### 4. Responsive Design
Mobile-first approach:
```tsx
<div className="motiona-grid-3">  {/* Auto-responsive */}
  {/* 3 cols desktop, 2 cols tablet, 1 col mobile */}
</div>
```

### 5. Animations
Use defined transitions:
```css
transition: all var(--transition-base);  /* 200ms */
transition: transform var(--transition-fast);  /* 150ms */
```

---

## Migration Checklist

Per project, complete the following:

- [ ] Copy design system to project
- [ ] Import global styles in root layout
- [ ] Set `data-brand` attribute on body
- [ ] Update login page to use `AccessCard`
- [ ] Update landing page with motiona classes
- [ ] Refactor forms to use `Input`, `Button`, `Select`
- [ ] Implement `Header` and `Footer` components
- [ ] Replace custom cards with `motiona-card`
- [ ] Update typography to use system classes
- [ ] Test responsive layouts (320px, 768px, 1440px)
- [ ] Validate color contrast (WCAG AA)
- [ ] Check Core Web Vitals (LCP, FID, CLS)
- [ ] Remove deprecated custom styles
- [ ] Update component documentation

---

## Troubleshooting

### Issue: Styles not applying
**Solution:** Ensure CSS import order is correct:
```tsx
import '../motiona-design-system/styles/base.css';      // 1. Base first
import '../motiona-design-system/styles/components.css'; // 2. Components
import '../motiona-design-system/styles/layouts.css';    // 3. Layouts
import '../motiona-design-system/styles/utilities.css';  // 4. Utilities last
```

### Issue: Wrong accent color
**Solution:** Verify `data-brand` attribute:
```tsx
<body data-brand="ironhub">  {/* Must match exactly */}
```

### Issue: Components not responsive
**Solution:** Use system grid classes:
```tsx
{/* Replace custom grids */}
<div className="motiona-grid-3">  {/* Auto-responsive */}
```

### Issue: Fonts not loading
**Solution:** Ensure system fonts are available:
```css
/* Helvetica Neue and Courier New are system fonts */
/* No additional font loading needed */
```

---

## Support

For questions or issues:
- Review `DESIGN_SYSTEM_SPEC.md` for complete specifications
- Check `README.md` for component examples
- Refer to existing implementations in NightHub or IronHub

---

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Maintained by:** MotionA Engineering
