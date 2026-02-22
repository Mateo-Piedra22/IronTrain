# Project Integration Roadmap

## Overview

This document outlines the specific integration steps for each of the 6 MotionA systems to adopt the unified enterprise design system.

---

## 1. ArgenPOS (POS Management System)

**Brand:** `argenpos`  
**Accent:** Burgundy (#5a1a1a)  
**Stack:** Next.js 14, React, TailwindCSS, Supabase  
**Priority Pages:** Login, Landing, Dashboard

### Integration Steps

1. **Setup Design System**
   ```bash
   cd frontend
   cp -r ../../.motiona-design-system ./src/motiona-design-system
   ```

2. **Update Root Layout** (`src/app/layout.tsx`)
   ```tsx
   import './motiona-design-system/styles/base.css';
   import './motiona-design-system/styles/components.css';
   import './motiona-design-system/styles/layouts.css';
   import './motiona-design-system/styles/utilities.css';
   import './globals.css'; // Keep existing after design system
   
   <body data-brand="argenpos">
     {children}
   </body>
   ```

3. **Refactor Login Page** (`src/app/login/page.tsx`)
   - Replace current form with `AccessCard` component
   - Maintain Supabase auth logic
   - Keep magic link functionality

4. **Refactor Landing Page** (`src/app/(marketing)/page.tsx`)
   - Update hero section with `motiona-hero-title`
   - Implement feature cards with `FeatureCard` component
   - Use `motiona-grid-3` for features grid

5. **Update Global Styles** (`src/app/globals.css`)
   - Remove conflicting styles
   - Keep brand-specific overrides
   - Maintain existing theme variables that don't conflict

### Custom Considerations
- Preserve POS-specific burgundy color scheme
- Keep existing store/inventory UI components
- Maintain QuickLoginModal for POS terminals

---

## 2. IronHub (Gym Management Platform)

**Brand:** `ironhub`  
**Accent:** Industrial Orange (#ff4d00)  
**Stack:** Python FastAPI backend, Next.js landing, Multi-app architecture  
**Priority Pages:** Landing page (`apps/landing`)

### Integration Steps

1. **Setup Design System**
   ```bash
   cd apps/landing
   cp -r ../../../.motiona-design-system ./src/motiona-design-system
   ```

2. **Update Landing Globals** (`apps/landing/src/app/globals.css`)
   - Design system already very close to target aesthetic
   - Replace existing with unified tokens
   - Keep framer-motion animations

3. **Refactor Landing Page** (`apps/landing/src/app/page.tsx`)
   - Already uses industrial aesthetic - minimal changes needed
   - Update class names to motiona conventions
   - Keep existing API integrations for gym data

4. **Admin Web** (`apps/admin-web`)
   - Similar process for admin interface
   - Focus on form components standardization

### Custom Considerations
- Multi-tenant architecture - preserve subdomain routing
- Gym showcase carousel - keep existing implementation
- WhatsApp integration forms - use unified inputs

---

## 3. IronTrain (Fitness Training App)

**Brand:** `irontrain`  
**Accent:** Athletic Blue (#0066CC)  
**Stack:** React Native (Expo), Next.js website  
**Priority:** Website only (`website/`)

### Integration Steps

1. **Setup Design System**
   ```bash
   cd website
   cp -r ../../.motiona-design-system ./src/motiona-design-system
   ```

2. **Update Website Layout** (`website/app/layout.tsx`)
   ```tsx
   import '../motiona-design-system/styles/base.css';
   import '../motiona-design-system/styles/components.css';
   import '../motiona-design-system/styles/layouts.css';
   import '../motiona-design-system/styles/utilities.css';
   
   <body data-brand="irontrain">
     {children}
   </body>
   ```

3. **Refactor Landing**
   - Athletic/performance focused messaging
   - Feature showcase for training plans
   - App download CTAs with motiona buttons

### Custom Considerations
- Mobile app is React Native - keep separate
- Website serves as marketing/download page
- Emphasize athletic blue in hero sections

---

## 4. LinkNexus (Link Management System)

**Brand:** `linknexus`  
**Accent:** Tech Purple (#7C3AED)  
**Stack:** Next.js 14, Prisma, TypeScript  
**Priority Pages:** Landing, Login/Register, Dashboard

### Integration Steps

1. **Setup Design System**
   ```bash
   cd LinkNexus
   cp -r ../.motiona-design-system ./src/motiona-design-system
   ```

2. **Update Root Layout** (`src/app/layout.tsx`)
   ```tsx
   import './motiona-design-system/styles/base.css';
   import './motiona-design-system/styles/components.css';
   import './motiona-design-system/styles/layouts.css';
   import './motiona-design-system/styles/utilities.css';
   
   <body data-brand="linknexus">
     {children}
   </body>
   ```

3. **Refactor Auth Pages**
   - Implement `AccessCard` for login/register
   - Maintain existing auth logic
   - Update form validation with unified inputs

4. **Refactor Landing**
   - Tech-focused industrial aesthetic
   - Link analytics showcase
   - QR code generation features

### Custom Considerations
- Link preview components - keep existing
- QR code generator - integrate with unified cards
- Analytics dashboard - standardize charts

---

## 5. NightHub (Nightlife Management Platform)

**Brand:** `nighthub`  
**Accent:** Pure Black (#000000)  
**Stack:** Next.js frontend, FastAPI backend  
**Status:** **Already using Swiss/Industrial aesthetic - MINIMAL CHANGES**

### Integration Steps

1. **Enhance Existing System**
   - Current implementation already matches design system closely
   - Copy shared components for consistency
   - Standardize class naming conventions

2. **Component Alignment**
   ```bash
   cd frontend
   cp -r ../../.motiona-design-system ./src/motiona-design-system
   ```

3. **Update Imports**
   - Replace custom `swiss-*` classes with `motiona-*`
   - Import shared components where applicable
   - Keep existing `AccessCard` but align prop names

### Custom Considerations
- **BEST REFERENCE**: NightHub's current implementation is closest to target
- Offline-first architecture - preserve completely
- RRPP tracking system - keep existing UI
- Event microsites - maintain current structure

---

## 6. TurnoPro (Appointment Management System)

**Brand:** `turnopro`  
**Accent:** Medical Green (#059669)  
**Stack:** Next.js frontend, FastAPI backend  
**Priority Pages:** Landing, Login, Dashboard

### Integration Steps

1. **Setup Design System**
   ```bash
   cd frontend
   cp -r ../../.motiona-design-system ./src/motiona-design-system
   ```

2. **Update Root Layout** (`src/app/layout.tsx`)
   ```tsx
   import './motiona-design-system/styles/base.css';
   import './motiona-design-system/styles/components.css';
   import './motiona-design-system/styles/layouts.css';
   import './motiona-design-system/styles/utilities.css';
   
   <body data-brand="turnopro">
     {children}
   </body>
   ```

3. **Refactor Pages**
   - Login/Register with `AccessCard`
   - Landing with medical/professional focus
   - Appointment booking forms with unified inputs

4. **Calendar Integration**
   - Keep existing calendar UI
   - Standardize form inputs for appointments
   - Use unified buttons and cards

### Custom Considerations
- Healthcare focus - professional, clean aesthetic
- Calendar/scheduling components - preserve functionality
- Patient management - use unified table styles

---

## Implementation Priority

### Phase 1: Critical (Week 1)
1. **NightHub** - Minor alignment (2 hours)
2. **IronHub Landing** - Already close (4 hours)
3. **ArgenPOS Login** - High traffic (4 hours)

### Phase 2: High Priority (Week 2)
4. **TurnoPro** - Complete overhaul (16 hours)
5. **LinkNexus** - Full integration (16 hours)
6. **IronTrain Website** - Marketing focus (8 hours)

### Phase 3: Enhancement (Week 3)
- Cross-project testing
- Performance optimization
- Documentation updates
- Component library expansion

---

## Testing Checklist (Per Project)

### Visual Testing
- [ ] Test on iPhone SE (320px)
- [ ] Test on iPad (768px)
- [ ] Test on Desktop 1080p (1920px)
- [ ] Verify brand accent color displays correctly
- [ ] Check dark mode compatibility (if applicable)

### Functional Testing
- [ ] All forms submit correctly
- [ ] Authentication flow works
- [ ] Navigation responsive menu functions
- [ ] Buttons trigger correct actions
- [ ] Loading states display properly

### Performance Testing
- [ ] Lighthouse score > 90
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] No layout shifts on load

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast WCAG AA
- [ ] Focus indicators visible
- [ ] Alt text on images

---

## Common Migration Patterns

### Pattern 1: Login Page
**Before:**
```tsx
<form>
  <input type="email" />
  <input type="password" />
  <button>Login</button>
</form>
```

**After:**
```tsx
<AccessCard
  brandName="[ProjectName]"
  initialPanel="login"
  onLogin={handleLogin}
  onRegister={handleRegister}
  allowRegister={true}
/>
```

### Pattern 2: Hero Section
**Before:**
```tsx
<div className="hero">
  <h1>Title</h1>
  <p>Description</p>
  <button>CTA</button>
</div>
```

**After:**
```tsx
<div className="motiona-section">
  <span className="motiona-label">Module</span>
  <h1 className="motiona-hero-title">Title</h1>
  <p className="motiona-subtitle">Description</p>
  <button className="motiona-btn-primary">CTA →</button>
</div>
```

### Pattern 3: Feature Grid
**Before:**
```tsx
<div className="grid grid-cols-3">
  <div className="card">Feature</div>
</div>
```

**After:**
```tsx
<div className="motiona-grid-3">
  <div className="motiona-card">Feature</div>
</div>
```

---

## Project-Specific Files to Modify

### ArgenPOS
```
frontend/src/app/layout.tsx
frontend/src/app/login/page.tsx
frontend/src/app/(marketing)/page.tsx
frontend/src/app/globals.css
frontend/src/components/ui/Button.tsx (deprecated)
frontend/src/components/ui/Input.tsx (deprecated)
```

### IronHub
```
apps/landing/src/app/globals.css
apps/landing/src/app/page.tsx
apps/landing/src/app/layout.tsx
apps/admin-web/src/app/login/page.tsx
```

### IronTrain
```
website/app/layout.tsx
website/app/page.tsx
website/src/components/Hero.tsx
```

### LinkNexus
```
src/app/layout.tsx
src/app/page.tsx
src/app/login/page.tsx
src/components/* (forms)
```

### NightHub
```
frontend/app/layout.tsx
frontend/app/(marketing)/page.tsx
frontend/components/auth/AccessCard.tsx (align props)
frontend/app/globals.css (rename classes)
```

### TurnoPro
```
frontend/src/app/layout.tsx
frontend/src/app/page.tsx
frontend/src/app/login/page.tsx
frontend/src/components/forms/* (replace all)
```

---

## Support & Resources

### Documentation
- **Full Spec:** `.motiona-design-system/DESIGN_SYSTEM_SPEC.md`
- **Implementation Guide:** `.motiona-design-system/IMPLEMENTATION_GUIDE.md`
- **Component Reference:** `.motiona-design-system/README.md`

### Reference Implementations
- **Best Example:** NightHub frontend (Swiss aesthetic)
- **Landing Page:** IronHub apps/landing
- **Auth Flow:** ArgenPOS login page

### Common Issues
See IMPLEMENTATION_GUIDE.md "Troubleshooting" section

---

**Last Updated:** February 2026  
**Version:** 1.0.0  
**Maintained by:** MotionA Engineering
