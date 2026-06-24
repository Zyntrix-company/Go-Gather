# GatherGo Typography Audit

## Summary

The app had a `typography.ts` token file that was used in only ~4% of files. Every screen and most components used inline `fontSize`/`fontWeight` values, causing visual inconsistency across screens.

**Status after this audit:**
- Design system expanded from 17 → 27 semantic tokens
- `fonts.ts` + `theme/index.ts` added
- 4 high-impact shared components migrated (`Button`, `AppHeader`, `SubScreenHeader`, `TextInput`)
- Remaining screens need migration (see backlog below)

---

## Token Reference

Import from `src/theme` — never use bare `fontSize` values in new code.

```ts
import { typeStyle } from '../theme';
// then in StyleSheet.create:
myText: typeStyle('body', { color: colors.textPrimary }),
```

### Display Scale (hero / splash text)

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `displayXl` | 40 | 700 | 48 | Splash / welcome hero |
| `displayLg` | 28 | 700 | 36 | Large hero, deal header |
| `displayMd` | 22 | 700 | 30 | Onboarding section titles |
| `displaySm` | 20 | 600 | 28 | Stats callouts, date ranges |
| `display`   | 24 | 500 | 32 | Tab screen title (Gallery, Home) |

### Title Scale (headers)

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `titleLg`  | 18 | 600 | 26 | Modal / sheet title (Create Trip, Edit Profile) |
| `titleXl`  | 17 | 600 | 24 | Prominent modal section / picker header |
| `navTitle` | 16 | 600 | 22 | **AppHeader, SubScreenHeader** — nav bar |
| `titleMd`  | 15 | 600 | 22 | Section heading (Description, Photos) |
| `titleSm`  | 14 | 600 | 20 | Card title, sub-section heading |

### Body Scale

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `bodyLg` | 15 | 400 | 22 | Primary body, prominent list item |
| `body`   | 13 | 400 | 20 | Default copy, messages, descriptions |
| `bodySm` | 12 | 400 | 17 | Meta, subtitles, helper text |
| `bodyXs` | 10 | 400 | 14 | Fine print, supplementary info |

### Label Scale

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `label`   | 13 | 500 | 18 | Form label, settings row label |
| `labelSm` | 10 | 500 | 14 | Tag chip, dropdown meta text |

### Button Scale

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `buttonLg` | 16 | 600 | 22 | Full-size / primary action button |
| `button`   | 14 | 600 | 20 | Standard button |
| `buttonSm` | 13 | 500 | 18 | Compact button / text link |

### Caption / Micro

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `caption` | 11 | 500 | 14 | Badge, chip, tab-bar indicator |
| `micro`   |  9 | 600 | 12 | Avatar +N counter, notification dot |

### Expense-Specific

| Token | Size | Weight | Use Case |
|-------|------|--------|----------|
| `expAction`         | 11 | 400 | Edit / Delete action links |
| `expFieldLabel`     | 12 | 400 | Expense form field label |
| `expTotalValue`     | 12 | 500 | Currency code & amount |
| `expSectionHeading` | 13 | 500 | "Individual breakdown" heading |
| `expBreakdownRow`   | 12 | 500 | Breakdown row text |

---

## Inconsistencies Found (Before Fix)

### Font Size Values Not in Token Scale
These were the most common "rogue" sizes found during the audit:

| Size | Uses | Problem | Correct Token |
|------|------|---------|---------------|
| 16   | 46   | Buttons, nav headers — not in old scale | `buttonLg` / `navTitle` |
| 17   | 28   | Picker/modal section headers | `titleXl` |
| 10   | 19   | Fine print, extra-small | `bodyXs` / `labelSm` |
| 18   | 14   | Overloaded — some should be `titleLg` | `titleLg` |
| 20   |  8   | Stats, callouts | `displaySm` |
| 28   |  5   | Large hero text | `displayLg` |
| 22   |  3   | Sub-hero | `displayMd` |
| 26   |  3   | Between `displayMd`/`displayLg` — round to one | `displayLg` |
| 38-40 |  3  | Splash only | `displayXl` |
|  8   |  6   | Too small for body — audit usage | `micro` or remove |

### Font Weight Issues

| Issue | Location | Fix |
|-------|----------|-----|
| `fontWeight: 'bold'` string literal | `AppHeader.tsx` badge | Fixed → `micro` token (700) |
| `fontWeight: '700'` — no semantic token | Multiple files | Use `displayMd`/`displayLg` which carry 700 |
| `fontWeight: '800'` | 2 files | Review — should be 700 (`bold`) max |
| `fontWeight: '300'` | 4 files | Review — likely should be `body` (400) |

### Color Values Not Using `colors` Token
Many inline color values like `'#0f172a'`, `'#64748b'`, `'#94a3b8'` should use `colors.textPrimary`, `colors.textSecondary`, `colors.textMuted` instead.

---

## Files Fixed (This PR)

| File | What Changed |
|------|-------------|
| `src/theme/typography.ts` | Added 10 new tokens: `displayXl`, `displayLg`, `displayMd`, `displaySm`, `navTitle`, `titleXl`, `bodyXs`, `labelSm`, `buttonLg` |
| `src/theme/fonts.ts` | New — font family + weight constants |
| `src/theme/index.ts` | New — barrel export for all theme tokens |
| `src/components/common/Button.tsx` | `text` style → `typeStyle('buttonLg')` |
| `src/components/common/AppHeader.tsx` | `title`/`subtitle`/`badgeText` → tokens; fixed `'bold'` |
| `src/components/common/SubScreenHeader.tsx` | `title` → `typeStyle('navTitle')` |
| `src/components/common/TextInput.tsx` | `label` → `typeStyle('titleSm')` |

---

## Migration Backlog (Remaining Screens)

Priority order — highest inline style count first:

### High Priority
- [ ] `screens/trips/TripDetailScreen.tsx` — 105 inline fontSize
- [ ] `screens/home/HomeScreen.tsx` — 97 inline fontSize
- [ ] `screens/events/EventDetailScreen.tsx` — 79 inline fontSize
- [ ] `screens/trips/TripsScreen.tsx` — 46 inline fontSize
- [ ] `screens/events/EventsScreen.tsx` — 46 inline fontSize

### Medium Priority
- [ ] `screens/home/GalleryTab.tsx` — 28 inline fontSize
- [ ] `screens/home/FriendsScreen.tsx` — 25 inline fontSize
- [ ] `screens/main/ChatDetailScreen.tsx` — 23 inline fontSize
- [ ] `screens/auth/SignupScreen.tsx` — 22 inline fontSize
- [ ] `components/common/InviteViaChannels.tsx` — uses 7 different sizes inline
- [ ] `components/common/MarkdownText.tsx` — mixed inline sizes in table styles

### Low Priority (auth screens — less visited)
- [ ] `screens/auth/LoginScreen.tsx`
- [ ] `screens/auth/WelcomeScreen.tsx`
- [ ] `screens/auth/CreateProfileScreen.tsx`
- [ ] `screens/auth/OtpVerificationScreen.tsx`
- [ ] `screens/auth/ForgotPasswordScreen.tsx`
- [ ] `screens/auth/ResetPasswordScreen.tsx`
- [ ] `screens/auth/SplashScreen.tsx`

### Settings / Profile
- [ ] `screens/main/SettingsScreen.tsx`
- [ ] `screens/main/EditProfileScreen.tsx`
- [ ] `screens/main/NotificationSettingsScreen.tsx`
- [ ] `screens/main/FaqScreen.tsx`
- [ ] `screens/main/FriendProfileScreen.tsx`
- [ ] `screens/main/ConnectedEmailScreen.tsx`
- [ ] `screens/main/ChangePasswordScreen.tsx`

---

## Migration Guide

### Pattern for screen migration

**Before:**
```ts
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748b',
  },
});
```

**After:**
```ts
import { typeStyle } from '../../theme';
import { colors } from '../../theme';

const styles = StyleSheet.create({
  sectionTitle: typeStyle('titleMd', { color: colors.textPrimary }),
  bodyText: typeStyle('body', { color: colors.textSecondary }),
});
```

### Quick reference — common replacements

| Was | Use Token |
|-----|-----------|
| `fontSize: 40, fontWeight: '700'` | `displayXl` |
| `fontSize: 28, fontWeight: '700'` | `displayLg` |
| `fontSize: 24, fontWeight: '500'` | `display` |
| `fontSize: 20, fontWeight: '600'` | `displaySm` |
| `fontSize: 18, fontWeight: '600'` | `titleLg` |
| `fontSize: 17, fontWeight: '600'` | `titleXl` |
| `fontSize: 16, fontWeight: '600'` (nav) | `navTitle` |
| `fontSize: 16, fontWeight: '600'` (btn) | `buttonLg` |
| `fontSize: 15, fontWeight: '600'` | `titleMd` |
| `fontSize: 14, fontWeight: '600'` | `titleSm` |
| `fontSize: 15, fontWeight: '400'` | `bodyLg` |
| `fontSize: 13, fontWeight: '400'` | `body` |
| `fontSize: 13, fontWeight: '500'` | `label` |
| `fontSize: 12, fontWeight: '400'` | `bodySm` |
| `fontSize: 11, fontWeight: '500'` | `caption` |
| `fontSize: 10, fontWeight: '400'` | `bodyXs` |
| `fontSize:  9, fontWeight: '600'` | `micro` |

### Rules going forward

1. **Never** write `fontSize` or `fontWeight` directly in StyleSheet — always use `typeStyle()`
2. **Never** write color hex values directly — always use `colors.*`
3. **Never** use `fontWeight: 'bold'` — use `'700'` (handled by tokens)
4. **Never** use `fontWeight: '300'` or `'800'` — outside our design system
5. When a size you need is missing from the scale, add a token to `typography.ts` first
