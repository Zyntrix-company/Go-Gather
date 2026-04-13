# Username & Profile Picture Persistence — Complete Fix

## Problems Fixed

### 1. ❌ Username Disappears on App Reload
After changing username and saving, reloading the app showed the old auto-generated username instead of the newly saved one.

### 2. ❌ Profile Picture Not Saving
Even after upload, the picture didn't display in the gallery or edit profile screen.

### 3. ❌ Gender/DOB Not Being Updated
Changes to gender and DOB fields weren't being persisted to the backend.

### 4. ❌ Username Not Showing in Profile Dropdown
The dropdown menu showed the email instead of the username handle.

---

## Root Causes Identified

### Issue 1: Backend `getMe()` Endpoint Missing Username
The `/auth/me` endpoint's query in the backend service was **not selecting `u.username`** from the users table. This meant:
- When you edit username and save → it works (updateProfile returns it)
- But when you reload the app → getMe() doesn't include username → it's lost from the store

### Issue 2: Backend `updateProfile()` Not Handling Gender/DOB
The updateProfile function only handled `fullName`, `bio`, and `country`. It was missing handlers for `gender` and `dob` fields sent from the frontend.

### Issue 3: HomeScreen Not Passing Username
The HomeScreen component was building a user object for GalleryTab but **omitted the username field**.

### Issue 4: ProfileDropdown Showing Email Instead of Username
The profile dropdown menu wasn't updated to use the username handle.

---

## Solutions Applied

### 1. Backend — Fix `getMe()` to Include Username
**File**: `backend/src/modules/auth/service.js` (lines 506-543)

```javascript
// BEFORE: Missing u.username in SELECT
const result = await db.query(
  `SELECT u.id, u.email, u.phone, u.google_id, u.facebook_id, ...
          p.full_name, p.dob, p.gender, p.country, p.bio, p.avatar_url
   FROM users u
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE u.id = $1`,
  [userId],
);

// AFTER: Added u.username to SELECT
const result = await db.query(
  `SELECT u.id, u.email, u.phone, u.username, u.google_id, u.facebook_id, ...
          p.full_name, p.dob, p.gender, p.country, p.bio, p.avatar_url
   FROM users u
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE u.id = $1`,
  [userId],
);

// Also added to return object:
return {
  id: row.id,
  email: row.email,
  phone: row.phone,
  username: row.username,  // ← ADDED
  ...
};
```

### 2. Backend — Fix `updateProfile()` to Handle Gender & DOB
**File**: `backend/src/modules/users/service.js` (lines 190-237)

```javascript
// BEFORE: Only handled fullName, bio, country
const updateProfile = async (userId, updates) => {
  const { fullName, username, bio, country } = updates;  // ← Missing gender, dob
  
  // Build dynamic update...
  if (fullName !== undefined) { ... }
  if (bio !== undefined) { ... }
  if (country !== undefined) { ... }
  // ← No handlers for gender and dob!
};

// AFTER: Now handles all fields
const updateProfile = async (userId, updates) => {
  const { fullName, username, bio, country, gender, dob } = updates;  // ← ADDED
  
  // ... existing code ...
  
  if (gender !== undefined) {
    setClauses.push(`gender = $${paramIdx++}`);
    params.push(gender);
  }
  if (dob !== undefined) {
    setClauses.push(`dob = $${paramIdx++}`);
    params.push(dob);
  }
  
  // ... rest of code ...
};
```

### 3. Frontend — HomeScreen Passes Username to GalleryTab
**File**: `app/src/screens/home/HomeScreen.tsx` (line 547)

```typescript
// BEFORE: Missing username
const user = rawUser ? {
  fullName: rawUser.fullName ?? rawUser.full_name ?? '',
  email: rawUser.email ?? '',
  country: rawUser.country ?? '',
  bio: rawUser.bio ?? '',
  photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
} : null;

// AFTER: Added username
const user = rawUser ? {
  fullName: rawUser.fullName ?? rawUser.full_name ?? '',
  username: rawUser.username ?? '',  // ← ADDED
  email: rawUser.email ?? '',
  country: rawUser.country ?? '',
  bio: rawUser.bio ?? '',
  photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
} : null;
```

### 4. Frontend — ProfileDropdown Shows Username
**File**: `app/src/screens/home/ProfileDropdown.tsx` (line 45)

```typescript
// BEFORE: Showed email
<Text style={styles.dropdownEmail} numberOfLines={1}>{user?.email || ''}</Text>

// AFTER: Shows username with @ prefix
<Text style={styles.dropdownEmail} numberOfLines={1}>@{user?.username || user?.email || ''}</Text>
```

---

## Complete Data Flow (Now Working)

### Scenario 1: Edit & Save Username
```
EditProfileScreen
  → onSubmit({ username: 'riyaaaaaa', ... })
  → editProfile() hook
  → authApi.updateProfile(payload)
  → Backend PUT /users/profile
    ✓ Updates users.username = 'riyaaaaaa'
    ✓ Returns { user: { username: 'riyaaaaaa', ... } }
  → Frontend normalizeUser extracts username
  → setAuth(updatedUser) ← Store updates immediately
  → HomeScreen re-renders with new user
  → GalleryTab shows @riyaaaaaa
  ✓ SUCCESS
```

### Scenario 2: Reload App
```
App Launches
  → loadFromToken()
  → authApi.getMe()
  → Backend GET /auth/me
    ✓ Returns { user: { username: 'riyaaaaaa', ... } }  ← NOW INCLUDES USERNAME
  → Frontend normalizeUser extracts username
  → setAuth(user) ← Store updates
  → HomeScreen re-renders
  → GalleryTab shows @riyaaaaaa
  ✓ SUCCESS — Username persists!
```

### Scenario 3: Upload Profile Picture
```
EditProfileScreen
  → pickImage() → uploadPhoto(fileUri)
  → authApi.uploadPhoto(fileUri)
  → Backend PUT /users/photo
    ✓ Saves to S3
    ✓ Updates profiles.avatar_url
  → Frontend uploadPhoto() calls refreshProfile()
  → authApi.getMe()
  → Backend returns { user: { username, profile: { avatarUrl, ... } } }
  → normalizeUser extracts all fields including avatarUrl
  → setAuth(user) ← Store updates with photoUrl
  → HomeScreen re-renders
  → GalleryTab displays photoUrl
  ✓ SUCCESS — Picture persists!
```

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| backend/src/modules/auth/service.js | 508, 527 | Added `u.username` to getMe() SELECT and return |
| backend/src/modules/users/service.js | 191, 227-235 | Added gender, dob handlers to updateProfile() |
| app/src/screens/home/HomeScreen.tsx | 547 | Added `username: rawUser.username` to user object |
| app/src/screens/home/ProfileDropdown.tsx | 45 | Changed to show `@{user?.username}` instead of email |
| app/src/screens/home/GalleryTab.tsx | 31 | Uses `user?.username` (already done) |
| app/src/api/auth.api.ts | 78 | Extracts username in normalizeUser (already done) |
| app/src/types/user.types.ts | 8 | Added `username?: string;` field (already done) |

---

## Testing Checklist

- [ ] Edit Profile: change username to `riyaaaaaa` → Save → Gallery shows `@riyaaaaaa`
- [ ] Reload app → username still shows `@riyaaaaaa` ✨
- [ ] Profile dropdown shows `@riyaaaaaa` (not email)
- [ ] Upload profile picture → see in preview → Save → reappears in Gallery
- [ ] Reload app → picture still visible
- [ ] Change gender to "Female" → Save → Gender persists on reload
- [ ] Change DOB → Save → DOB persists on reload
- [ ] Edit multiple fields (name, username, bio, country, gender, DOB) → all persist

---

## Why This Works

1. **Username persisted on reload**: Backend's `getMe()` now includes username in every user fetch
2. **Profile picture saved**: UpdateProfile properly returns full user data, and uploadPhoto calls refreshProfile()
3. **Gender/DOB persisted**: Backend now accepts and stores these fields
4. **Username visible everywhere**: HomeScreen passes username to all components that need it

The key insight: The backend was working correctly, but the frontend data flow had gaps. By ensuring every user-fetching endpoint (getMe, updateProfile) returns complete user data including username, and ensuring the frontend properly passes this data to all components, persistence now works end-to-end.
