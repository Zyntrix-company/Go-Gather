# GatherGo — Mobile App

React Native mobile app for GatherGo. Single codebase for iOS and Android.

---

## Folder Structure

```
app/
├── src/
│   ├── api/              # Axios API clients (client, auth, trips, events, ai, gallery,
│   │                     #   invites, requests, notifications, notificationSettings,
│   │                     #   personalDocs, feedback, legal, places, uploadLimits)
│   ├── screens/
│   │   ├── auth/         # Splash, Welcome, Login, Signup, OtpVerification,
│   │   │                 #   ForgotPassword, ResetPassword, CreateProfile
│   │   ├── home/         # HomeScreen (+ tab content: ChatTab, GalleryTab), FriendsScreen,
│   │   │                 #   MenuScreen, ProfileDropdown, HowItWorks, Archived
│   │   ├── trips/        # TripsScreen, TripDetailScreen, ArchivedTripsScreen
│   │   ├── events/       # EventsScreen, EventDetailScreen, ArchivedEventsScreen
│   │   └── main/         # ChatDetail (Swee), Notifications, NotificationSettings, Profile,
│   │                     #   EditProfile, FriendProfile, Settings, ChangePassword,
│   │                     #   DeleteAccount, ConnectedEmail, PersonalDocuments, Support,
│   │                     #   Faq, Legal, AcceptInvite
│   ├── navigation/       # RootNavigator, AuthStack, MainStack
│   ├── store/            # Zustand: auth, notifications, notificationSettings, chat,
│   │                     #   alert, pendingInvite, uploadLimits
│   ├── hooks/            # useAuth, usePushNotifications, useUploadLimits, gallery hooks, …
│   ├── components/       # Shared UI (common/ — incl. AppleSignInButton, LegalModal, InviteViaChannels)
│   ├── constants/  content/  types/  utils/  assets/
│   └── theme/            # colors.ts — teal brand palette + design tokens
├── android/              # Android native project
├── ios/                  # iOS native project (Xcode target/scheme: `Demo`)
├── __tests__/            # Jest tests
├── scripts/              # Dev helpers (android-reset/reload, typography audit)
├── docs/  TYPOGRAPHY_AUDIT.md
├── App.tsx               # Root component (deep-link handling, push setup)
└── index.js              # Entry point
```

> `app/app/` is a nested stub folder; see `app/app/readme.md`.

---

## Tech Stack

| Purpose | Library |
|---------|---------|
| Framework | React Native 0.84 |
| Navigation | React Navigation v7 (native stack) |
| State management | Zustand |
| HTTP client | Axios |
| Forms & validation | React Hook Form + Zod |
| Styling | NativeWind v4 (Tailwind CSS for RN) |
| Secure storage | react-native-keychain (JWT tokens) |
| Local storage | @react-native-async-storage/async-storage |
| Google Sign-In | @react-native-google-signin/google-signin |
| Apple Sign-In | @invertase/react-native-apple-authentication |
| Push (FCM) | @react-native-firebase/messaging |
| Swee AI | **Google Gemini 2.5 Flash** on the backend only (`ai.api.ts` — not OpenAI in the app) |
| Image picker | react-native-image-picker |
| Animations | React Native Reanimated v4 |
| Gestures | React Native Gesture Handler |
| Icons | react-native-vector-icons |
| Toast notifications | react-native-toast-message |
| Video playback | react-native-video |
| Fast image loading | @d11/react-native-fast-image |
| Maps / Places | Google Places API (react-native-google-places-autocomplete) |
| Contacts / documents | react-native-contacts, @react-native-documents/picker |
| Testing | Jest |

---

## Screens

### Auth Flow
| Screen | Description |
|--------|-------------|
| `SplashScreen` | Logo on brand background. Validates the stored session and routes to Home or Welcome. |
| `WelcomeScreen` | Intro / entry point to Login and Signup. |
| `LoginScreen` | Email/password, Google and Sign in with Apple. Forgot password link. |
| `SignupScreen` | Email, phone (country code picker), password; Google / Apple sign-up. |
| `OtpVerificationScreen` | OTP entry after signup or password reset. |
| `ForgotPasswordScreen` / `ResetPasswordScreen` | Request an OTP, then set a new password. |
| `CreateProfileScreen` | Name, DOB, gender, country, bio, profile photo. Runs once after first signup. |

### Main App
| Screen | Description |
|--------|-------------|
| `HomeScreen` | Hosts the bottom tabs — Home, Trips, Events, Friends, Swee (chat), Gallery — and the dashboard (upcoming/ongoing trips and events). |
| `TripsScreen` / `EventsScreen` | Lists with upcoming/ongoing/past filters; archived lists in `ArchivedTripsScreen` / `ArchivedEventsScreen`. |
| `TripDetailScreen` | Tabbed trip view: Activities, Docs, Members, Photos, Expenses, Polls, Notes. |
| `EventDetailScreen` | Same as Trip, without Activities. |
| `ChatDetailScreen` | Swee AI assistant (Gemini 2.5 Flash on the backend): conversations, trip/event context, form-driven create/edit cards, document/photo attachments. |
| `NotificationsScreen` / `NotificationSettingsScreen` | In-app feed and per-category preferences. |
| `FriendsScreen` / `FriendProfileScreen` | Friends, requests, user search, public profile. |
| `AcceptInviteScreen` | Handles trip / event / friend invite links. |
| `MenuScreen` | Full-screen menu opened from the hamburger: Profile, Settings, Support, Legal. |
| `ProfileScreen` / `EditProfileScreen` | View and edit own profile. |
| `SettingsScreen` | Notifications, connected email, change password, delete account. |
| `ChangePasswordScreen` / `DeleteAccountScreen` | Account management (delete includes Apple token revocation server-side). |
| `ConnectedEmailScreen` | Connect Gmail / Outlook / Drive to import documents. |
| `PersonalDocumentsScreen` | User-level document vault. |
| `SupportScreen` / `FaqScreen` / `LegalScreen` / `HowItWorksScreen` | Help and legal content. |

---

## Navigation Structure

```
RootNavigator
├── AuthStack  (shown when not logged in)
│   ├── Splash, Welcome, Login, Signup
│   └── OtpVerification, ForgotPassword, ResetPassword
└── MainStack  (shown when logged in)
    ├── Home            (bottom tabs: Home | Trips | Events | Friends | Swee | Gallery)
    ├── TripDetail, EventDetail, ChatDetail, Archived
    ├── Notifications, NotificationSettings
    ├── Menu, Profile, EditProfile, FriendProfile
    ├── Settings, ChangePassword, DeleteAccount, ConnectedEmail, PersonalDocuments
    ├── Support, Faq, Legal, HowItWorks
    └── AcceptInvite
```

---

## State Management

**Zustand** stores live in `src/store/` (auth, notifications, notification settings, chat, alerts, pending invite, upload limits). `authStore.ts` holds the global auth session:

```ts
{
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user, accessToken?, refreshToken?) => void
  logout: () => void
  // …updateUser, setLoading, pending profile flags, etc.
}
```

Tokens are also persisted securely via **react-native-keychain** (iOS Keychain / Android Keystore).

---

## API Layer

`src/api/client.ts` — base Axios instance with:
- `Authorization: Bearer <accessToken>` header injected automatically
- Interceptor that silently calls `POST /auth/refresh` on 401, retries the original request
- On refresh failure: clears auth state and redirects to Login

```
src/api/
├── client.ts       # Base instance + interceptors (API_BASE = https://api.gatherrgo.com)
├── auth.api.ts     # signup, login, google, apple, refresh, logout, forgot/reset/change password
├── trips.api.ts / events.api.ts   # CRUD + shared tabs (docs, photos, expenses, polls, notes)
├── ai.api.ts       # Swee — chat, conversations, actions
├── gallery.api.ts, personalDocs.api.ts, invites.api.ts, requests.api.ts
├── notifications.api.ts, notificationSettings.api.ts
└── feedback.api.ts, legal.api.ts, places.api.ts, uploadLimits.api.ts
```

---

## Local Setup

### Prerequisites

- Node.js 22.11.0+ (see `engines` in `package.json`)
- React Native environment set up ([official guide](https://reactnative.dev/docs/set-up-your-environment))
- Android Studio (for Android) or Xcode 14+ (for iOS)
- CocoaPods (iOS only)

### 1. Install dependencies

```bash
cd app
npm install
```

### 2. iOS — install native dependencies

```bash
bundle install           # install CocoaPods itself (first time only)
bundle exec pod install  # install iOS native pods
```

### 3. Point at a backend

The API base URL is a constant in `src/api/client.ts` (`REAL_BASE_URL`, default `https://api.gatherrgo.com`). Edit it to target a local backend (e.g. `http://10.0.2.2:3000` from the Android emulator, or run `npm run adb:reverse` for devices).

### 4. Run the app

```bash
# Start Metro bundler
npm start

# Android (new terminal)
npm run android

# iOS (new terminal)
npm run ios
```

---

## Development Notes

- **Styling:** uses NativeWind — write `className="..."` Tailwind classes directly on RN components. Theme colours are in `src/theme/colors.ts`.
- **Forms:** all forms use React Hook Form with Zod schemas for validation.
- **Deep links:** invites use native **Universal Links (iOS) / App Links (Android)** on `https://gatherrgo.com/invite/{trip|event|friend}/{token}` (also `gathergo://invite/...`). `App.tsx` parses the URL, stores a pending invite if logged out, and `AcceptInviteScreen` calls `POST /invites/claim/:token`. No third-party SDK.
- **Google Sign-In:** needs the Google web client ID and `google-services.json` (Android) / `GoogleService-Info.plist` (iOS).
- **Sign in with Apple:** iOS only; requires the Sign in with Apple capability (`ios/Demo/Demo.entitlements`) and the backend `APPLE_*` config.
- **Tests:** `npm test` (Jest). Lint: `npm run lint`.
- **Push notifications:** FCM device token is read in `useAuth` login flows and sent to the backend. `App.tsx` mounts `usePushNotifications()` for foreground messages + local notification list + Toast.
