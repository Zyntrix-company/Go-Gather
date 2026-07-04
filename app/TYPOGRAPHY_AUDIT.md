# GatherGo Typography Reference — Screen by Screen

> **Token** column shows the design-system target; import via `typeStyle('token', { overrides })`

---

## Quick Reference — Token Scale

| Token | Size | Weight | When to use |
|-------|------|--------|-------------|
| `displayXl` | 40 | 700 | Splash hero |
| `displayLg` | 28 | 700 | Large hero / deal header |
| `displayMd` | 22 | 700 | Onboarding section title |
| `displaySm` | 20 | 600 | Stats callout, date range |
| `display`   | 24 | 500 | Tab screen title |
| `titleLg`   | 18 | 600 | Modal / sheet title |
| `titleXl`   | 17 | 600 | Picker / prominent section header |
| `navTitle`  | 16 | 600 | AppHeader, SubScreenHeader |
| `titleMd`   | 15 | 600 | Section heading |
| `titleSm`   | 14 | 600 | Card title, sub-section |
| `bodyLg`    | 15 | 400 | Primary body |
| `body`      | 13 | 400 | Default copy |
| `bodySm`    | 12 | 400 | Meta, timestamps |
| `bodyXs`    | 10 | 400 | Fine print |
| `label`     | 13 | 500 | Form label, settings row |
| `labelSm`   | 10 | 500 | Tag chip, dropdown meta |
| `buttonLg`  | 16 | 600 | Full-size button |
| `button`    | 14 | 600 | Standard button |
| `buttonSm`  | 13 | 500 | Compact button / text link |
| `caption`   | 11 | 500 | Badge, chip, tab indicator |
| `micro`     |  9 | 600 | Avatar +N counter, notification dot |

---

## MAIN SCREENS

---

## HomeScreen

`screens/home/HomeScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `tabScreenTitle` | 24 | 500 | `display` |
| `welcomeTitle` | 18–20 | 600 | `displaySm` |
| `welcomeSubtitle` | 13–15 | 400 | `body`/`bodyLg` |
| `welcomeTitle` (hStyles) | 26 | 600 | `displayLg` |
| `sectionTitle` | 14–16 | 600 | `navTitle` |
| `sectionHeader` inline | 16 | 600 | `navTitle` |
| `tripsListTitle` | 18 | 600 | `titleLg` |
| `tripsCTATitle` | 20 | 600 | `displaySm` |
| `daysNumber` | 28 | 600 | `displayLg` |
| `daysLabel` | 8 | 500 | `micro` |
| `createTripBtnText` | 15 | 600 | `titleMd` |
| `emptyStateTitle` | 18 | 600 | `titleLg` |
| `modalTitle` | 18 | 600 | `titleLg` |
| `ctTitle` | 16 | 600 | `navTitle` |
| `ctLabel` | 13 | 500 | `label` |
| `ctCreateBtnText` | 14 | 600 | `button` |
| `modalSaveBtnText` | 16 | 600 | `buttonLg` |
| `ongoingBadgeText` | 11 | 600 | `caption` |
| `eventTypePillText` | 11 | 600 | `caption` |
| `moreCounterText` | 9 | 600 | `micro` |
| `cardTitle` | 15 | 400 | `bodyLg` |
| `teCardName` | 15 | 600 | `titleMd` |
| `blogTitle` | 13 | 600 | `label` |
| `dealTitle` | 14 | 600 | `titleSm` |
| `insightTitle` | 14 | 500 | `titleSm` |
| `sweeBoxText` | 16 | 400 | `navTitle` |
| `askSweeBtnText` | 14 | 600 | `button` |
| Inline blog h2 | 18 | 600 | `titleLg` |
| Inline blog h3 | 16 | 600 | `navTitle` |
| Inline "Create Trip/Event/How it works" | 13 | 600 | `button` |
| Inline "Get Inspired / Deals / Trips / Events" | 14 | 600 | `titleSm` |
| Inline welcome | 24 | 600 | `display` |
| Inline section count badge | 22 | 600 | `displayMd` |

---

## GalleryTab

`screens/home/GalleryTab.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `avatarInitial` | 38 | 600 | special case |
| `name` | 18 | 600 | `titleLg` |
| `handle` | 14 | 600 | `titleSm` |
| `sectionTitle` | 17 | 600 | `titleXl` |
| `dialogTitle` | 17 | 600 | `titleXl` |
| `emptyTitle` | 15 | 400 | `bodyLg` |
| `emptySub` | 13 | — | `body` |
| `cardChipText` | 10 | 600 | `labelSm` |
| `countBadgeText` | 12 | 600 | `bodySm` |
| `gridCardText` | 12 | 400 | `bodySm` |
| `createAlbumBtnText` | 16 | 600 | `buttonLg` |
| `addPhotosBtnText` | 15 | 400 | `bodyLg` |
| `coverPhotoRowLabel` | 14 | 400 | `titleSm` |
| Tab / filter text | 15 | 500 | `titleMd` |
| Inline: Cover label | 8 | 600 | `micro` |
| `modalSubtitleText` | 13 | 400 | `body` |

---

## ChatTab

`screens/home/ChatTab.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `heroHeading` | 18–22 | 600 | `titleLg`/`displayMd` |
| `newChatText` | 15 | 600 | `titleMd` |
| Conversation name | 14 | — | `titleSm` |
| Conversation snippet | 13 | 500 | `label` |
| `sectionLabel` | 13 | 600 | `label` |
| `emptyTitle` | 15 | 600 | `titleMd` |
| Time label | 13 | — | `body` |

---

## ProfileDropdown

`screens/home/ProfileDropdown.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Avatar initial | 18 | 600 | `titleLg` |
| `dropdownName` | 14 | 600 | `titleSm` |
| `dropdownEmail` | 11 | — | `caption` |
| `dropdownItemText` | 13 | 400 | `body` |

---

## HowItWorksScreen

`screens/home/HowItWorksScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `cardTitle` | 15 | 600 | `titleMd` |
| `cardBody` | 13 | — | `body` |
| Section heading | 14 | 600 | `titleSm` |
| `featureLabel` | 13 | 500 | `label` |
| `featureDesc` | 12 | — | `bodySm` |
| `footerText` | 13 | — | `body` |

Uses `colors.textPrimary`/`colors.textSecondary` throughout.

---

---

## TRIPS & EVENTS

---

## TripsScreen

`screens/trips/TripsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `tripsCTATitle` | 20 | 600 | `displaySm` |
| `tripsCTASub` | 16 | 400 | `navTitle` |
| `createTripBtnText` | 14 | 600 | `button` |
| `tripsListTitle` | 15 | 600 | `bodyLg` |
| `daysNumber` | 28 | 600 | `displayLg` |
| `daysLabel` | 8 | 600 | `micro` |
| `cardTitle` | 15 | 400 | `bodyLg` |
| `ctTitle` | 16 | 600 | `navTitle` |
| `ctCreateBtnText` | 14 | 600 | `button` |
| `ongoingBadgeText` | 11 | 600 | `caption` |
| `moreCounterText` | 9 | 600 | `micro` |
| `pastCardTitle` | 14 | 400 | `titleSm` |
| Inline "Cancel" | 17 | 500 | `titleXl` |
| Inline "Done" | 17 | 600 | `titleXl` |

---

## EventsScreen

`screens/events/EventsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `eventListTitle` | 15 | 600 | `bodyLg` |
| `heroTitle` | 20 | 600 | `displaySm` |
| `newEventBtnText` | 14 | 600 | `button` |
| `heroSub` | 16 | 400 | `navTitle` |
| `daysNumber` | 28 | 600 | `displayLg` |
| `daysLabel` | 8 | 600 | `micro` |
| `cardTitle` | 15 | 400 | `bodyLg` |
| `title` (modal) | 16 | 600 | `navTitle` |
| `createBtnTxt` | 14 | 600 | `button` |
| `ongoingBadgeText` | 11 | 600 | `caption` |
| `moreCounterText` | 9 | 600 | `micro` |
| Inline "Cancel" | 17 | 500 | `titleXl` |
| Inline "Done" | 17 | 600 | `titleXl` |

---

## TripDetailScreen

`screens/trips/TripDetailScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `topBarTitle` | 16 | 600 | `navTitle` |
| `tripName` | 20 | 600 | `displaySm` |
| `daysNumber` | 40 | 500 | `displayXl` |
| `sectionTitle` / `sectionTitleDark` | 15 | 600 | `titleMd` |
| `dTitle` (dialog header) | 14 | 600 | `titleSm` |
| `pollQ` | 14 | 600 | `titleSm` |
| `memberSectionLabel` | 12 | 600 | — |
| `memberSectionLabelTitle` | 12 | 600 | — |
| `docDividerLabel` | 11 | 600 | `caption` |
| `pollAvatarInitial` | 11 | 600 | `caption` |
| `pollAvatarMoreTxt` | 10 | 600 | `labelSm` |
| `pollSectionLabel` | 11 | 600 | `caption` |
| `cardBadgeText` | 10 | 600 | `labelSm` |
| `actionLabel` | 13 | 500 | `label` |
| `statTxt` | 12 | 500 | `bodySm` |
| Body/meta styles | 11–13 | 400 | various tokens |

---

## EventDetailScreen

`screens/events/EventDetailScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `topBarTitle` | 16 | 600 | `navTitle` |
| `sectionTitle` / `sectionTitle1` | 15 | 600 | `titleMd` |
| `pollQ` | 14 | 600 | `titleSm` |
| `hlSubTitle` | 12 | 600 | — |
| `cancelTxt` | 14 | 600 | `titleSm` |
| `docDividerLabel` | 11 | 600 | `caption` |
| `pollAvatarInitial` | 9 | 600 | `micro` |
| `pollAvatarMoreTxt` | 8 | 600 | `micro` |
| `cardBadgeText` | 10 | 600 | `labelSm` |
| Body/label styles | 11–13 | 400–500 | various tokens |

---

---

## MAIN / SETTINGS

---

## SettingsScreen

`screens/main/SettingsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `avatarInitial` | 20 | 600 | `displaySm` |
| `profileName` | 15 | 600 | `titleMd` |
| `sectionTitle` | 15 | 600 | `titleMd` |
| `profileEmail` | 13 | — | `body` |
| `rowLabel` | 15 | 400 | `bodyLg` |
| `rowSub` | 12 | — | `bodySm` |

Uses `colors.*` tokens throughout.

---

## EditProfileScreen

`screens/main/EditProfileScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Action picker title | 17 | 600 | `titleXl` |
| `addBadgeText` | 17 | 600 | `titleXl` |
| `fieldLabel` | 12 | 500 | `label` |
| `dobReadOnlyText` | 13 | — | `body` |
| `helperText` / `errorText` | 11 | — | `caption` |
| `dropdownText` | 14 | — | `titleSm` |
| `apiErrorText` | 13 | 500 | `label` |
| `primaryBtnText` | 15 | 600 | `titleMd` |
| Avatar circle text | 18 | 600 | `titleLg` |

---

## FriendProfileScreen

`screens/main/FriendProfileScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `avatarInitial` | 38 | 600 | special case |
| `name` | 18 | 600 | `titleLg` |
| `handle` | 14 | 500 | `titleSm` |
| `sectionTitle` | 17 | 600 | `titleXl` |
| `dialogTitle` | 17 | 500 | `titleXl` |
| `countBadgeText` | 12 | 600 | `bodySm` |
| `cardChipText` | 10 | 600 | `labelSm` |
| `emptyTitle` | 15 | 400 | `bodyLg` |
| `modalSubtitleText` | 13 | 400 | `body` |
| `gridCardText` | 12 | 400 | `bodySm` |

---

## NotificationsScreen

`screens/main/NotificationsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `notifTitle` | 14 | 400 | `titleSm` |
| `notifTitleUnread` | — | 600 | bold override for unread |
| `notifDate` | 11 | 400 | `caption` |
| `tabBadgeText` | 10 | 600 | `labelSm` |
| `contextLabel` | 11 | 500 | `caption` |
| `acceptBtnText` | 13 | 600 | `buttonSm` |
| `declineBtnText` | 13 | 500 | `buttonSm` |
| `emptyTitle` | 16 | 600 | `navTitle` |
| `tabText` | 14 | 500 | `titleSm` |

---

## ChatDetailScreen

`screens/main/ChatDetailScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `headerName` | 14 | 600 | `titleSm` |
| `msgText` | 14 | — | `body` |
| `msgTime` | 10 | — | `bodyXs` |
| `reportTitle` | 17 | 600 | `titleXl` |
| `reportBtnText` | 15 | 600 | `titleMd` |
| `reportSentTitle` | 16 | 600 | `navTitle` |
| `reportSentEmoji` | 22 | 600 | `displayMd` |
| `confirmYesText` / `confirmNoText` / `viewBtnText` | 13 | 600 | `buttonSm` |
| `reportLabel` / `optionChipText` | 13 | 500 | `label` |

---

## NotificationSettingsScreen

`screens/main/NotificationSettingsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `sectionTitle` | 15 | 600 | `titleMd` |
| `rowLabel` | 15 | 400 | `bodyLg` |
| `rowSub` | 12 | — | `bodySm` |
| `digestSub` | 13 | — | `body` |
| `pillText` | 13 | 500 | `label` |

---

## FaqScreen

`screens/main/FaqScreen.tsx`

`subtitle`: 13/— → `body`. Uses `colors.textSecondary` throughout.

---

## ChangePasswordScreen

`screens/main/ChangePasswordScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Password bullets | 13 | — | `body` |
| Input field | 14 | — | `titleSm` |
| Submit button text | 13 | 600 | `buttonSm` |
| Section heading | 15 | 600 | `titleMd` |
| Success title | 26 | 600 | `displayLg` |
| Primary btn | 15 | 600 | `titleMd` |

---

## ConnectedEmailScreen

`screens/main/ConnectedEmailScreen.tsx`

Body (13/400), label (13/500) throughout.

---

---

## FRIENDS

---

## FriendsScreen

`screens/home/FriendsScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Main screen title | 22 | 600 | `displayMd` |
| Section label | 16 | 600 | `navTitle` |
| Friend name | 14 | 600 | `titleSm` |
| `searchInput` | 13 | 400 | `body` |
| Mutual count | 11 | 400 | `caption` |
| Modal invite title | 17 | 600 | `titleXl` |
| Send button | 14 | 600 | `button` |

---

---

## AUTH SCREENS

---

## WelcomeScreen

`screens/auth/WelcomeScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Hero title | 30–44 | 600 | `displayXl` |
| Sub-title | 13–24 | — | `body` → `display` |
| `primaryBtnText` | 15 | 600 | `titleMd` |
| `demoBtnText` | 14 | 600 | `titleSm` |

---

## SignupScreen

`screens/auth/SignupScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Country picker title | 17 | 600 | `titleXl` |
| `title` (hero) | 21–25 | 500 | `display` |
| `socialBtnText` | 16 | 600 | `navTitle` |
| Phone input | 14–16 | — | `titleSm`/`navTitle` |
| Country code text | 13 | 500 | `label` |
| Primary btn text | 15–17 | 600 | `titleMd`/`titleXl` |
| Link text | 13–17 | 500 | `label`/`titleXl` |
| Terms text | 10–12 | — | `bodyXs`/`bodySm` |

---

## LoginScreen

`screens/auth/LoginScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `title` (hero) | 20–24 | 500 | `display` |
| Subtitle | 13–15 | — | `body`/`bodyLg` |
| `socialBtnText` | 16 | 600 | `navTitle` |
| Input | 14–16 | — | `titleSm`/`navTitle` |
| Primary btn | 15–17 | 600 | `titleMd`/`titleXl` |
| Link underline | 13–16 | 500 | `label`/`navTitle` |

---

## CreateProfileScreen

`screens/auth/CreateProfileScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Action picker title | 17 | 600 | `titleXl` |
| `title` (hero) | 23–28 | 500 | `display`/`displayLg` |
| Avatar circle text | 18 | 600 | `titleLg` |
| `fieldLabel` | 12 | 400 | `label` |
| Primary btn | 14 | 600 | `button` |

---

## OtpVerificationScreen

`screens/auth/OtpVerificationScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Hero title | 27 | 400 | `displayLg` |
| Verification sub | 22 | 600 | `displayMd` |
| Section title | 17 | 600 | `titleXl` |
| Primary btn | 14 | 600 | `button` |
| Resend link | 13 | 600 | `buttonSm` |
| Resend count text | 26 | 600 | `displayLg` |

---

## ForgotPasswordScreen

`screens/auth/ForgotPasswordScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| `title` (hero) | 21–25 | 500 | `display`/`displaySm` |
| Helper text | 12–14 | — | `bodySm`/`titleSm` |
| Error text | 13 | 600 | `buttonSm` |
| Primary btn | 15–17 | 600 | `titleMd`/`titleXl` |
| Link text | 13–15 | 500 | `label`/`titleMd` |

---

## ResetPasswordScreen

`screens/auth/ResetPasswordScreen.tsx`

| Style Name | Size | Weight | Token |
|------------|------|--------|-------|
| Password bullets | 13 | — | `body` |
| Success title | 24 | 600 | `display` |
| Timer | 17 | 500 | `titleXl` |
| Resend link | 13 | 600 | `buttonSm` |
| Primary btn | 15 | 600 | `titleMd` |
| Success hero | 26 | 600 | `displayLg` |

---

## SplashScreen

`screens/auth/SplashScreen.tsx`

No font styles — images/animations only.

---

---

## SHARED COMPONENTS

---

## MarkdownText

`components/common/MarkdownText.tsx`

| Style | Size | Weight | Token |
|-------|------|--------|-------|
| `bold` | — | 700 | intentional (Markdown bold rendering) |
| `boldItalic` | — | 700 | intentional (Markdown bold rendering) |
| `h1` | 17 | 600 | `titleXl` |
| `h2` | 15 | 600 | `titleMd` |
| `h3` | 14 | 600 | `titleSm` |
| `cursor` | — | 400 | `body` |
| `headerText` (table) | 12 | 600 | `bodySm` |

---

## DateInfoPopover

`components/common/DateInfoPopover.tsx`

| Style | Size | Weight | Token |
|-------|------|--------|-------|
| `closeBtnText` | 20 | 400 | `displaySm` |

---

## DetailHeroCard

`components/common/DetailHeroCard.tsx`

| Style | Size | Weight | Token |
|-------|------|--------|-------|
| `name` (hero title) | 18 | 600 | `titleLg` |
| `daysNumber` | 28 | 600 | `displayLg` |
| Location/meta | 12 | 400 | `bodySm` |
| `typeBadgeText` | 10 | 500 | `labelSm` |
| `statusPillText` | 13 | 600 | `label` |
| Date chip | 11 | 400 | `caption` |

---

## OutstandingDebtsList

`components/common/OutstandingDebtsList.tsx`

| Style | Size | Weight | Token |
|-------|------|--------|-------|
| `debtAmt` | 13 | 600 | `label` |
| Settle btn text | 12 | 500 | `buttonSm` |
| Debt from/to | 12 | — | `bodySm` |

---

## GalleryEngagementSection

`components/gallery/GalleryEngagementSection.tsx`

| Style | Size | Weight | Token |
|-------|------|--------|-------|
| `statText` | 13 | 500 | `label` |
| `statCount` | — | 600 | — |
| `commentName` | — | 500 | `label` |
| `commentText` | — | 400 | `body` |
| `composePost` / `editSave` | — | 600 | `navTitle` |
| `menuModalText` | — | 500 | `label` |

---

---

## Enhancement Log — June 2026

### Thin weights aligned to minimum (300 → 400)

| File | Style | Before → After |
|------|-------|----------------|
| [FriendsScreen.tsx](src/screens/home/FriendsScreen.tsx) | `searchInput` | 300 → 400 |
| [GalleryTab.tsx](src/screens/home/GalleryTab.tsx) | `modalSubtitleText` | 300 → 400 |
| [FriendProfileScreen.tsx](src/screens/main/FriendProfileScreen.tsx) | `modalSubtitleText` | 300 → 400 |
| [DateInfoPopover.tsx](src/components/common/DateInfoPopover.tsx) | `closeBtnText` | 300 → 400 |
| [MarkdownText.tsx](src/components/common/MarkdownText.tsx) | `cursor` | 300 → 400 |

### Markdown headings brought in line with design token scale (700 → 600)

| File | Style | Before → After |
|------|-------|----------------|
| [MarkdownText.tsx](src/components/common/MarkdownText.tsx) | `h1` | 700 → 600 |
| [MarkdownText.tsx](src/components/common/MarkdownText.tsx) | `h2` | 700 → 600 |
| [MarkdownText.tsx](src/components/common/MarkdownText.tsx) | `h3` | 700 → 600 |
| [MarkdownText.tsx](src/components/common/MarkdownText.tsx) | `headerText` | 700 → 600 |

### Section and screen titles strengthened for hierarchy (400/500 → 600)

| File | Styles updated |
|------|----------------|
| [TripDetailScreen.tsx](src/screens/trips/TripDetailScreen.tsx) | `topBarTitle`, `tripName`, `sectionTitle`, `sectionTitleDark`, `dTitle`, `pollQ`, `memberSectionLabel`, `memberSectionLabelTitle` |
| [EventDetailScreen.tsx](src/screens/events/EventDetailScreen.tsx) | `topBarTitle`, `sectionTitle`, `sectionTitle1`, `pollQ`, `hlSubTitle`, `cancelTxt` |
| [SettingsScreen.tsx](src/screens/main/SettingsScreen.tsx) | `avatarInitial`, `profileName`, `sectionTitle` |
| [NotificationSettingsScreen.tsx](src/screens/main/NotificationSettingsScreen.tsx) | `sectionTitle` |
| [NotificationsScreen.tsx](src/screens/main/NotificationsScreen.tsx) | `notifTitleUnread` |
| [FriendProfileScreen.tsx](src/screens/main/FriendProfileScreen.tsx) | `name`, `sectionTitle` |
| [HomeScreen.tsx](src/screens/home/HomeScreen.tsx) | `welcomeTitle` ×2, `sectionTitle`, `sectionHeader` inline, `tripsListTitle`, `tripsCTATitle`, `createTripBtnText`, `emptyStateTitle`, inline section headers, welcome, and button labels |
| [GalleryTab.tsx](src/screens/home/GalleryTab.tsx) | `name`, `handle`, `sectionTitle`, `dialogTitle` |
| [ChatTab.tsx](src/screens/home/ChatTab.tsx) | `heroHeading`, `sectionLabel`, `emptyTitle` |
| [ProfileDropdown.tsx](src/screens/home/ProfileDropdown.tsx) | `dropdownName` |
| [TripsScreen.tsx](src/screens/trips/TripsScreen.tsx) | `tripsCTATitle`, `createTripBtnText`, `tripsListTitle` |
| [EventsScreen.tsx](src/screens/events/EventsScreen.tsx) | `heroTitle`, `newEventBtnText`, `eventListTitle` |

### Button and interactive text strengthened (400 → 600)

| File | Styles updated |
|------|----------------|
| [WelcomeScreen.tsx](src/screens/auth/WelcomeScreen.tsx) | `primaryBtnText`, `demoBtnText` |
| [EditProfileScreen.tsx](src/screens/main/EditProfileScreen.tsx) | `primaryBtnText` |
| [SignupScreen.tsx](src/screens/auth/SignupScreen.tsx) | `socialBtnText` |
| [LoginScreen.tsx](src/screens/auth/LoginScreen.tsx) | `socialBtnText` |
| [ChatDetailScreen.tsx](src/screens/main/ChatDetailScreen.tsx) | `headerName` |

### Auth hero titles given subtle lift (400 → 500)

| File | Style |
|------|-------|
| [LoginScreen.tsx](src/screens/auth/LoginScreen.tsx) | `title` |
| [SignupScreen.tsx](src/screens/auth/SignupScreen.tsx) | `title` |
| [CreateProfileScreen.tsx](src/screens/auth/CreateProfileScreen.tsx) | `title` |
| [ForgotPasswordScreen.tsx](src/screens/auth/ForgotPasswordScreen.tsx) | `title` |

### Token alignment refinements

| File | Style | Before → After |
|------|-------|----------------|
| [HowItWorksScreen.tsx](src/screens/home/HowItWorksScreen.tsx) | `featureLabel` | 600 → 500 |
| [DetailHeroCard.tsx](src/components/common/DetailHeroCard.tsx) | `typeBadgeText` | 400 → 500 |
| [DetailHeroCard.tsx](src/components/common/DetailHeroCard.tsx) | `daysNumber` | 500 → 600 |
