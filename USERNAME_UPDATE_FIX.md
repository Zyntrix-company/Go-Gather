# Username Update Not Reflecting in Gallery — Complete Fix

## Problem
After changing username in Edit Profile and clicking "Save Changes":
- Username updates successfully in backend
- But Gallery tab still shows the old derived handle (e.g., `@riya_sharma` instead of `@riyaaaaaa`)

## Root Cause
The data flow was broken at **two points**:

### Issue 1: Backend Response Missing Fields
Backend's `updateProfile` wasn't returning `gender` and `dob`, causing the response to be incomplete.

### Issue 2: HomeScreen Not Including Username
HomeScreen was building a `user` object to pass to GalleryTab, but it **wasn't including the username field** from the store. This meant GalleryTab never received the updated username.

## Solution

### 1. Backend Service — Include All Fields
**File**: `backend/src/modules/users/service.js` (lines 238-259)

Added `p.dob, p.gender` to the SELECT query and return object:
```javascript
// Before:
const result = await db.query(
  `SELECT u.id, u.username,
          p.full_name, p.bio, p.country, p.avatar_url, p.updated_at
   FROM users u ...`,
  [userId],
);
return {
  id: row.id,
  username: row.username,
  profile: {
    fullName: row.full_name,
    bio: row.bio,
    country: row.country,
    avatarUrl: row.avatar_url,
    updatedAt: row.updated_at,
  },
};

// After:
const result = await db.query(
  `SELECT u.id, u.username,
          p.full_name, p.dob, p.gender, p.bio, p.country, p.avatar_url, p.updated_at
   FROM users u ...`,
  [userId],
);
return {
  id: row.id,
  username: row.username,
  profile: {
    fullName: row.full_name,
    dob: row.dob,
    gender: row.gender,
    bio: row.bio,
    country: row.country,
    avatarUrl: row.avatar_url,
    updatedAt: row.updated_at,
  },
};
```

### 2. HomeScreen — Pass Username to GalleryTab
**File**: `app/src/screens/home/HomeScreen.tsx` (lines 545-551)

Added `username: rawUser.username` to the user object:
```typescript
// Before:
const user = rawUser ? {
  fullName: rawUser.fullName ?? rawUser.full_name ?? '',
  email: rawUser.email ?? '',
  country: rawUser.country ?? '',
  bio: rawUser.bio ?? '',
  photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
} : null;

// After:
const user = rawUser ? {
  fullName: rawUser.fullName ?? rawUser.full_name ?? '',
  username: rawUser.username ?? '',  // ← ADDED
  email: rawUser.email ?? '',
  country: rawUser.country ?? '',
  bio: rawUser.bio ?? '',
  photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
} : null;
```

### 3. GalleryTab — Use Username from Props
**File**: `app/src/screens/home/GalleryTab.tsx` (line 31)

Already updated in previous fix:
```typescript
const handle = user?.username || displayName.toLowerCase().replace(/ /g, '_') || 'username';
```

## Complete Data Flow (Now Working)

```
EditProfileScreen
  ↓ onSubmit(data)
  ↓ editProfile({ username: 'riyaaaaaa', ... })
useAuth.editProfile()
  ↓ authApi.updateProfile(payload)
  ↓
Backend PUT /users/profile
  ↓ returns { user: { username: 'riyaaaaaa', profile: { fullName, ... } } }
  ↓
Frontend auth.api.ts updateProfile()
  ↓ normalizeUser({ username: 'riyaaaaaa', ... })
  ↓ returns User { username: 'riyaaaaaa', fullName, ... }
  ↓
useAuth.editProfile()
  ↓ setAuth(updatedUser, token, refreshToken)
  ↓
authStore updates
  ↓ user: { username: 'riyaaaaaa', fullName, ... }
  ↓
HomeScreen
  ↓ rawUser from store (now has username)
  ↓ creates user object with username
  ↓ passes to GalleryTab
  ↓
GalleryTab
  ↓ displays @riyaaaaaa
  ✓ SUCCESS
```

## Testing

✅ Change username to `riyaaaaaa` → Save Changes
✅ Gallery tab shows `@riyaaaaaa` (not `@riya_sharma`)
✅ Profile dropdown shows correct name + email
✅ Reload app → username persists

## Files Modified

| File | Change |
|------|--------|
| backend/src/modules/users/service.js | Added gender, dob to updateProfile response |
| app/src/screens/home/HomeScreen.tsx | Added username to user object |
| app/src/screens/home/GalleryTab.tsx | Already uses user?.username (from previous fix) |
| app/src/api/auth.api.ts | Already handles username (from previous fix) |
| app/src/hooks/useAuth.ts | Already updates store (from previous fix) |
| app/src/types/user.types.ts | Already has username field (from previous fix) |
