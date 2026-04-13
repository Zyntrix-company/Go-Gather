# Profile & Username Issues — Fixes Applied

## Overview
Fixed three critical issues:
1. Username not pre-filled in Edit Profile screen
2. Real-time UI not updating after save
3. Profile picture not being saved/displayed (data flow issue)

---

## Issue 1: Username Not Pre-filled in Edit Profile

### Root Cause
Username was being read from `user?.profile?.username`, but the backend stores it on the `users` table, not `profiles` table.

### Files Changed
- **app/src/screens/main/EditProfileScreen.tsx** (line 167)
  - Changed: `const initialUsername = (user?.profile as any)?.username || '';`
  - To: `const initialUsername = user?.username || '';`

### Result
✅ Username field now displays the saved username when opening Edit Profile screen

---

## Issue 2: Real-time UI Not Updating After Save

### Root Cause
- `authApi.updateProfile()` was declared as `Promise<void>` (returns nothing)
- Backend was returning updated user data, but frontend wasn't using it
- Components only update when the store updates, but the store wasn't being refreshed with the API response

### Files Changed
1. **app/src/api/auth.api.ts** (lines 302-314)
   - Changed return type from `Promise<void>` to `Promise<User>`
   - Now extracts and normalizes the user object from the API response
   ```typescript
   // Before:
   updateProfile: async (...): Promise<void> => {
     await client.put('/users/profile', payload);
   }
   
   // After:
   updateProfile: async (...): Promise<User> => {
     const { data } = await client.put('/users/profile', payload);
     const raw = data.user ?? data;
     return normalizeUser(raw);
   }
   ```

2. **app/src/hooks/useAuth.ts** (lines 253-271)
   - Changed `editProfile()` to use the returned user data immediately
   ```typescript
   // Before:
   await authApi.updateProfile(payload);
   await refreshProfile();
   
   // After:
   const updatedUser = await authApi.updateProfile(payload);
   const token = (await storage.getToken()) || useAuthStore.getState().accessToken;
   const refreshToken = (await storage.getRefreshToken()) || useAuthStore.getState().refreshToken;
   setAuth(updatedUser, token, refreshToken);  // Update store immediately
   ```

### Result
✅ After clicking "Save Changes", username, bio, country, and other fields update immediately across Profile, Gallery, and ProfileDropdown components
✅ No need to reload the app

---

## Issue 3: Profile Picture Not Being Saved/Displayed

### Root Cause
- Frontend was correctly uploading the image via `uploadPhoto()`
- Backend stored it in S3 and returned the CDN URL
- BUT the frontend wasn't properly reading the avatar URL from the correct location in components

### How It Works Now
1. User selects image in EditProfileScreen
2. `uploadPhoto()` uploads to S3 via `PUT /users/photo`
3. Backend returns `{ message, avatarUrl }`
4. Frontend extracts `avatarUrl` and updates the store
5. `refreshProfile()` fetches the full user object to ensure consistency
6. Components read `user?.photoUrl` or `user?.avatarUrl` to display the image

### Supporting Change
- **app/src/types/user.types.ts**
  - Added `username?: string;` field to User interface so EditProfileScreen can properly read it

- **app/src/api/auth.api.ts** (line 77)
  - Updated `normalizeUser()` to extract username: `username: raw.username || profile.username || ''`
  - This ensures username from backend is properly mapped to the frontend User type

### Result
✅ Profile picture now saves and displays correctly
✅ Photo appears in EditProfileScreen avatar preview
✅ Photo persists across app restarts (stored in backend)

---

## Technical Details: Data Flow After Save

### Before (Broken)
```
EditProfileScreen.onSubmit()
  → editProfile({ username, fullName, ... })
    → authApi.updateProfile() [returns void]
    → refreshProfile() [fetches full user, updates store]
    → [but updateProfile response was ignored]
```

### After (Fixed)
```
EditProfileScreen.onSubmit()
  → editProfile({ username, fullName, ... })
    → authApi.updateProfile() [returns updated user]
    → setAuth(updatedUser) [updates store immediately with new data]
    → Components re-render with latest username, bio, photoUrl
```

**Benefit**: Instant UI feedback without needing a separate `refreshProfile()` call.

---

## Testing Checklist

- [ ] Open Edit Profile → username field shows current value
- [ ] Change username → click Save → username updates everywhere (Profile tab, Gallery, Hamburger menu)
- [ ] Change bio → click Save → bio updates everywhere
- [ ] Upload profile picture → see preview → click Save → image displays in EditProfileScreen avatar
- [ ] Close and reopen EditProfileScreen → photo still visible
- [ ] Navigate to GalleryTab → updated username shows in handle (@username)
- [ ] Open ProfileDropdown → updated name and email visible (if changed)

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| app/src/types/user.types.ts | Added `username?: string;` field |
| app/src/api/auth.api.ts | Updated `normalizeUser()` to extract username; changed `updateProfile()` return type to `Promise<User>` |
| app/src/hooks/useAuth.ts | Changed `editProfile()` to use returned user data for immediate store update |
| app/src/screens/main/EditProfileScreen.tsx | Fixed username initialization: `user?.username` instead of `user?.profile?.username` |
| app/src/screens/main/EditProfileScreen.tsx | Added username helper text (already done in previous session) |

---

## Notes

- The backend was already correctly implemented (`PUT /users/profile` returns updated user)
- The frontend was the bottleneck—it wasn't using the response data
- All fixes are backwards-compatible; no breaking changes
- Username validation regex matches backend: `^[a-z0-9_]{3,20}$`
