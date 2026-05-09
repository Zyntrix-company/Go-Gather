# GatherGo — Mobile App

React Native mobile app for GatherGo. Single codebase for iOS and Android.

---

## Folder Structure

```
app/
├── src/
│   ├── api/              # Axios API clients
│   │   ├── client.ts         # Base Axios instance (auth headers, token refresh)
│   │   ├── auth.api.ts        # Auth endpoints
│   │   ├── trips.api.ts       # Trips endpoints
│   │   ├── events.api.ts      # Events endpoints
│   │   └── ai.api.ts          # Swee AI streaming chat
│   ├── screens/
│   │   ├── auth/             # Pre-login screens
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   ├── OtpVerificationScreen.tsx
│   │   │   ├── ForgotPasswordScreen.tsx
│   │   │   ├── ResetPasswordScreen.tsx
│   │   │   └── CreateProfileScreen.tsx
│   │   ├── home/             # Home dashboard
│   │   │   └── HomeScreen.tsx
│   │   └── main/             # Core app screens
│   │       ├── TripDetailScreen.tsx
│   │       ├── EventDetailScreen.tsx
│   │       ├── ChatDetailScreen.tsx     # Swee AI chatbot
│   │       ├── NotificationsScreen.tsx
│   │       └── ArchivedTripsScreen.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx    # Auth vs Main stack switch
│   │   ├── AuthStack.tsx        # Unauthenticated flow
│   │   └── MainStack.tsx        # Authenticated flow + bottom tabs
│   ├── store/
│   │   ├── authStore.ts         # Zustand — user session, tokens
│   │   └── notificationStore.ts # Zustand persist — in-app notification list (FCM foreground)
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth actions + token refresh; sends FCM device token on login
│   │   └── usePushNotifications.ts  # FCM foreground handler + Toast (wired from App.tsx)
│   ├── components/
│   │   └── common/              # Shared UI components
│   └── theme/
│       └── colors.ts            # Teal brand palette + design tokens
├── android/                 # Android native project
├── ios/                     # iOS native project
├── App.tsx                  # Root component
└── index.js                 # Entry point
```

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
| Google Sign-In | @react-native-google-signin/google-signin |
| Facebook Sign-In | react-native-fbsdk-next |
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

---

## Screens

### Auth Flow
| Screen | Description |
|--------|-------------|
| `SplashScreen` | App logo on teal background. Validates stored JWT — auto-navigates to Home if valid, Login if not. |
| `LoginScreen` | Email/password + Google + Facebook login. Forgot password link. |
| `SignupScreen` | Email, phone (country code picker), password. |
| `OtpVerificationScreen` | OTP entry after signup or password reset. |
| `ForgotPasswordScreen` | Send OTP to email/phone for password reset. |
| `ResetPasswordScreen` | Set new password after OTP verified. |
| `CreateProfileScreen` | Name, DOB, gender, country, bio, profile photo. Runs once after first signup. |

### Main App
| Screen | Description |
|--------|-------------|
| `HomeScreen` | Personalised dashboard — upcoming trips, upcoming events, ongoing trip card, Swee AI shortcut. |
| `TripDetailScreen` | Full trip view with tabbed sections: Activities, Docs, Members, Photos, Expenses, Polls, Notes. |
| `EventDetailScreen` | Full event view — same tabs as Trip except no Activities tab. |
| `ChatDetailScreen` | Swee AI travel assistant — Google Gemini 2.5 Flash, streaming responses, trip/event context injection. |
| `NotificationsScreen` | In-app notification feed — friend requests, trip invites, expense updates. |
| `ArchivedTripsScreen` | List of archived trips (admin-only action). |
| `FriendsScreen` | Friends list, incoming/outgoing requests, user search with friendship status. Bottom tab. |
| `GalleryScreen` | Personal photo gallery aggregated across all past trips and events. Bottom tab. |
| `UserProfileScreen` | View another user's public profile, stats, and past trip gallery. |

---

## Navigation Structure

```
RootNavigator
├── AuthStack  (shown when not logged in)
│   ├── Splash
│   ├── Login
│   ├── Signup
│   ├── OtpVerification
│   ├── ForgotPassword
│   ├── ResetPassword
│   └── CreateProfile
└── MainStack  (shown when logged in)
    ├── Bottom Tabs
    │   ├── Home
    │   ├── Trips
    │   ├── Events
    │   ├── Friends
    │   └── Gallery
    ├── TripDetail
    ├── EventDetail
    ├── ChatDetail  (Swee AI)
    ├── Notifications
    ├── ArchivedTrips
    └── UserProfile
```

---

## State Management

**Zustand** (`authStore.ts`) holds the global auth session:

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
├── client.ts       # Base instance + interceptors
├── auth.api.ts     # signup, login, googleLogin, facebookLogin, refresh, logout, forgotPassword, resetPassword
├── trips.api.ts    # trips CRUD, expenses, members, …
├── events.api.ts   # events CRUD + shared tabs
└── ai.api.ts       # Swee — streaming chat to backend (Gemini 2.5 Flash server-side)
```

---

## Local Setup

### Prerequisites

- Node.js 22.11.0+
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

### 3. Configure environment

Create a `.env` file (or update `src/api/client.ts`) with your backend base URL:

```
API_BASE_URL=http://localhost:3000
```

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
- **Deep links:** Branch.io smart links are handled via the native SDK. The `invites/claim/:token` API call is made after the Branch SDK fires on app open.
- **Google Sign-In:** requires `GOOGLE_WEB_CLIENT_ID` set in the native config files (`google-services.json` for Android, `GoogleService-Info.plist` for iOS).
- **Push notifications:** FCM device token is read in `useAuth` login flows and sent to the backend. `App.tsx` mounts `usePushNotifications()` for foreground messages + local notification list + Toast.
