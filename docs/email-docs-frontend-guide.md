# Email Doc Import — Frontend Implementation Guide

Feature: **Extract docs from email** (Gmail & Outlook)
Module built: `emailDocs` — backend already complete, endpoints live.

---

## How it works (user flow)

1. Inside the trip's **Docs** modal, user taps "Extract docs from email"
2. App shows a sheet: **Gmail** or **Outlook**
3. User taps a provider → backend generates an OAuth URL → app opens it in the in-app browser (`Linking.openURL` or `InAppBrowser`)
4. User authenticates on Google/Microsoft consent screen
5. Provider redirects to `https://api.gathergo.app/auth/email/google/callback` (handled by backend)
6. Backend saves tokens, redirects to deep link: `gathergo://email-connected?provider=gmail&success=true`
7. App catches the deep link via `Linking.addEventListener` → closes browser → shows attachment picker
8. User selects which attachments to import → `POST /email-docs/import`
9. Imported docs appear in the docs list immediately

---

## API Functions to add to `trips.api.ts`

Add these after the existing `deleteDoc` function (after line 384):

```typescript
// ─── 5b. Email Doc Import ─────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'outlook';

export type EmailAttachment = {
  attachmentId: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  emailSubject: string | null;
  emailFrom: string | null;
  emailDate: string | null;
};

export type EmailConnectionStatus = {
  gmail:   { connected: boolean; email: string | null };
  outlook: { connected: boolean; email: string | null };
};

export async function getEmailStatus() {
  const res = await client.get('/email-docs/status');
  return res.data as EmailConnectionStatus;
}

export async function getEmailConnectUrl(provider: EmailProvider): Promise<string> {
  // Returns the OAuth consent URL — open this in a browser/InAppBrowser
  // The backend redirects there directly, so we build the URL client-side
  // using the backend base URL. The backend will redirect us to the provider.
  return `${client.defaults.baseURL}/auth/email/${provider}/connect`;
}

export async function listEmailAttachments(provider: EmailProvider, tripId: string) {
  const res = await client.get('/email-docs/attachments', {
    params: { provider, tripId },
  });
  return res.data as { attachments: EmailAttachment[]; total: number };
}

export async function importEmailAttachments(
  tripId: string,
  provider: EmailProvider,
  attachments: Pick<EmailAttachment, 'attachmentId' | 'messageId' | 'fileName'>[],
) {
  const res = await client.post('/email-docs/import', {
    tripId,
    provider,
    attachments: attachments.map(a => ({ ...a, provider })),
  });
  return res.data as {
    imported: { docId: string; fileName: string; fileUrl: string }[];
    failed:   { fileName: string; reason: string }[];
  };
}

export async function disconnectEmailProvider(provider: EmailProvider) {
  const res = await client.delete(`/auth/email/${provider}/disconnect`);
  return res.data as { success: boolean };
}
```

---

## State to add in `TripDetailScreen.tsx`

Add these alongside the existing modal/data state declarations (around line 320):

```typescript
// ── Email doc import state ──
const [showEmailProviderSheet, setShowEmailProviderSheet] = useState(false);
const [showEmailAttachments,   setShowEmailAttachments]   = useState(false);
const [emailProvider,          setEmailProvider]          = useState<'gmail' | 'outlook' | null>(null);
const [emailAttachments,       setEmailAttachments]       = useState<EmailAttachment[]>([]);
const [selectedEmailAttachments, setSelectedEmailAttachments] = useState<Set<string>>(new Set());
const [isLoadingEmailAtts,     setIsLoadingEmailAtts]     = useState(false);
const [isImportingEmail,       setIsImportingEmail]       = useState(false);
```

---

## Imports to add in `TripDetailScreen.tsx`

```typescript
import {
  // ... existing imports ...
  getEmailStatus,
  listEmailAttachments,
  importEmailAttachments,
  disconnectEmailProvider,
} from '../../api/trips.api';
import type { EmailAttachment, EmailProvider } from '../../api/trips.api';
```

---

## Deep link handler

Add this `useEffect` near the other effects (e.g. after the docs load effect):

```typescript
// ── Handle OAuth deep link callback ──
useEffect(() => {
  const sub = Linking.addEventlistener('url', ({ url }) => {
    if (!url.startsWith('gathergo://email-connected')) return;
    const params = new URLSearchParams(url.split('?')[1]);
    const provider = params.get('provider') as EmailProvider;
    const success  = params.get('success') === 'true';

    if (success && provider) {
      setEmailProvider(provider);
      // Immediately fetch attachments now that OAuth is done
      fetchEmailAttachments(provider);
    } else {
      Toast.show({ type: 'error', text1: 'Connection failed', text2: params.get('error') ?? 'Could not connect email' });
    }
  });
  return () => sub.remove();
}, [tripId]);
```

**Note:** For iOS you also need to handle the initial URL (if the app was closed):
```typescript
Linking.getInitialURL().then(url => {
  if (url?.startsWith('gathergo://email-connected')) { /* same logic */ }
});
```

---

## Handler functions

Add these after `handleDeleteDoc` (around line 877):

```typescript
// ── Email doc import handlers ──

async function handleEmailProviderSelect(provider: 'gmail' | 'outlook') {
  setShowEmailProviderSheet(false);
  setEmailProvider(provider);

  // Check if already connected
  try {
    const status = await getEmailStatus();
    if (status[provider].connected) {
      // Already connected — go straight to attachment picker
      await fetchEmailAttachments(provider);
      return;
    }
  } catch {}

  // Not connected — open OAuth flow
  // The backend /auth/email/:provider/connect endpoint redirects to the provider.
  // We pass the JWT in the request via axios interceptor, but since we're opening
  // a URL in an external browser, we must pass the token as a query param OR
  // use an in-app browser that shares cookies. Simplest approach:
  //
  // Option A (recommended): Use the axios instance to hit the connect endpoint
  // and get back a redirect URL, then open that URL.
  //
  // Option B: Open the connect URL directly — requires passing the JWT manually.
  //
  // The backend /connect endpoint is behind authenticateJWT. Since we can't inject
  // Authorization headers into Linking.openURL, use the WebView approach below.
  setShowDocsOAuthWebView(true); // see WebView section below
}

async function fetchEmailAttachments(provider: 'gmail' | 'outlook') {
  setIsLoadingEmailAtts(true);
  setShowEmailAttachments(true);
  setSelectedEmailAttachments(new Set());
  try {
    const res = await listEmailAttachments(provider, tripId);
    setEmailAttachments(res.attachments);
  } catch (err) {
    handleApiError(err);
    setShowEmailAttachments(false);
  } finally {
    setIsLoadingEmailAtts(false);
  }
}

function toggleEmailAttachment(attachmentId: string) {
  setSelectedEmailAttachments(prev => {
    const next = new Set(prev);
    if (next.has(attachmentId)) next.delete(attachmentId);
    else next.add(attachmentId);
    return next;
  });
}

async function handleImportSelectedAttachments() {
  if (!emailProvider || selectedEmailAttachments.size === 0) return;
  setIsImportingEmail(true);
  try {
    const toImport = emailAttachments.filter(a => selectedEmailAttachments.has(a.attachmentId));
    const res = await importEmailAttachments(tripId, emailProvider, toImport);

    if (res.imported.length > 0) {
      // Reload the docs list to show newly imported docs
      const docsRes = await getDocs(tripId);
      setDocs(docsRes.docs.map(d => ({
        id: d.id,
        name: d.fileName,
        uri: (d as any).downloadUrl ?? d.fileUrl ?? '',
        uploadedBy: d.uploadedBy,
        mimeType: d.mimeType,
      })));
      Toast.show({ type: 'success', text1: `${res.imported.length} doc(s) imported` });
    }

    if (res.failed.length > 0) {
      Toast.show({ type: 'error', text1: `${res.failed.length} file(s) failed`, text2: res.failed[0].reason });
    }

    setShowEmailAttachments(false);
  } catch (err) {
    handleApiError(err);
  } finally {
    setIsImportingEmail(false);
  }
}
```

---

## OAuth WebView approach (recommended for JWT passing)

Since `GET /auth/email/:provider/connect` requires a JWT Bearer token and `Linking.openURL` can't inject headers, use a WebView modal. Add this state variable:

```typescript
const [showDocsOAuthWebView, setShowDocsOAuthWebView] = useState(false);
const [oauthWebViewUrl,      setOauthWebViewUrl]      = useState('');
```

In `handleEmailProviderSelect`, instead of `Linking.openURL`:

```typescript
// Get JWT from secure storage (same pattern as client.ts interceptor)
import { getTokens } from '../../utils/storage'; // or Keychain directly

const { accessToken } = await getTokens();
const baseUrl = client.defaults.baseURL;
// Open a WebView that passes the JWT via query param — backend reads it
// OR: set up a custom scheme in the WebView and catch the redirect
setOauthWebViewUrl(`${baseUrl}/auth/email/${provider}/connect?token=${accessToken}`);
setShowDocsOAuthWebView(true);
```

**Note for backend team:** The `/auth/email/:provider/connect` endpoint currently uses `authenticateJWT` middleware which reads the `Authorization` header. To support WebView flow, add a fallback that also reads `?token=` query param — OR create a short-lived connect-token endpoint that the mobile app calls with its JWT to get a one-time URL it can open.

**Simplest alternative:** Have the backend return the OAuth URL as JSON instead of redirecting, then the app opens it via `Linking.openURL`. This avoids the JWT-in-browser problem entirely:

```
GET /auth/email/:provider/connect-url   ← new endpoint, returns { url: string }
```

The app then: `Linking.openURL(res.url)` — the OAuth flow runs in the native browser, and the deep link brings the user back.

---

## JSX to add in the Docs modal

Insert this **after** the "Upload Documents" button (after line 1614) and before the `{docs.length === 0 ?` check:

```tsx
{/* Import from email */}
<TouchableOpacity
  style={[styles.tealBtnFull, { backgroundColor: '#1e40af', marginTop: 8 }]}
  onPress={() => setShowEmailProviderSheet(true)}
  activeOpacity={0.85}
>
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
  <Text style={styles.tealBtnTxt}>Extract from Email</Text>
</TouchableOpacity>
```

---

## Additional Modals to add

Add these modals alongside the existing doc-related modals (after line 1643):

### Provider picker sheet

```tsx
{/* ── Email provider picker ── */}
<Modal visible={showEmailProviderSheet} transparent animationType="slide" onRequestClose={() => setShowEmailProviderSheet(false)}>
  <View style={styles.overlay}>
    <View style={[styles.dialog]}>
      <DHeader title="Import from Email" onClose={() => setShowEmailProviderSheet(false)} />
      <View style={styles.dBody}>
        <TouchableOpacity style={[styles.tealBtnFull, { backgroundColor: '#ea4335' }]}
          onPress={() => handleEmailProviderSelect('gmail')} activeOpacity={0.85}>
          <Text style={styles.tealBtnTxt}>Gmail</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tealBtnFull, { backgroundColor: '#0078d4', marginTop: 10 }]}
          onPress={() => handleEmailProviderSelect('outlook')} activeOpacity={0.85}>
          <Text style={styles.tealBtnTxt}>Outlook</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

### Attachment picker

```tsx
{/* ── Email attachment picker ── */}
<Modal visible={showEmailAttachments} transparent animationType="fade" onRequestClose={() => setShowEmailAttachments(false)}>
  <View style={styles.overlay}>
    <View style={[styles.dialog, { maxHeight: '85%' }]}>
      <DHeader
        title={`${emailProvider === 'gmail' ? 'Gmail' : 'Outlook'} Attachments`}
        subtitle="Select files to import"
        onClose={() => setShowEmailAttachments(false)}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.dBody}>
          {isLoadingEmailAtts ? (
            <View style={styles.emptyCenter}>
              <Text style={styles.emptySub}>Loading attachments…</Text>
            </View>
          ) : emailAttachments.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Text style={styles.emptyTitle}>No attachments found</Text>
              <Text style={styles.emptySub}>No PDFs or images in the last 30 days</Text>
            </View>
          ) : emailAttachments.map(att => {
            const selected = selectedEmailAttachments.has(att.attachmentId);
            return (
              <TouchableOpacity
                key={att.attachmentId}
                style={[styles.docRow, selected && { backgroundColor: '#f0fdfa' }]}
                onPress={() => toggleEmailAttachment(att.attachmentId)}
                activeOpacity={0.7}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                    stroke={selected ? '#0d9488' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8"
                    stroke={selected ? '#0d9488' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 13, color: '#0f172a' }} numberOfLines={1}>{att.fileName}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }} numberOfLines={1}>{att.emailSubject ?? ''}</Text>
                </View>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 2, borderColor: selected ? '#0d9488' : '#cbd5e1',
                  backgroundColor: selected ? '#0d9488' : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedEmailAttachments.size > 0 && (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
          <TouchableOpacity
            style={[styles.tealBtnFull, isImportingEmail && { opacity: 0.6 }]}
            onPress={handleImportSelectedAttachments}
            disabled={isImportingEmail}
            activeOpacity={0.85}
          >
            <Text style={styles.tealBtnTxt}>
              {isImportingEmail ? 'Importing…' : `Import ${selectedEmailAttachments.size} file(s)`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
</Modal>
```

---

## Deep link registration

### iOS — `Info.plist`
Already registered for invite links. Verify `gathergo` scheme is in `CFBundleURLSchemes`. No changes needed if invites already work.

### Android — `AndroidManifest.xml`
Same — verify `gathergo://` intent filter exists.

---

## Error codes from the backend to handle

| `error` code | What it means | What to show |
|---|---|---|
| `NOT_CONNECTED` | No OAuth token for this provider | Show provider picker again |
| `REAUTH_REQUIRED` | Refresh token revoked by user | "Your Gmail connection expired — reconnect" |
| `INVALID_PROVIDER` | Bad provider value | Shouldn't happen — guard in the UI |
| `LIMIT_EXCEEDED` | Trip already has 50 docs | "This trip is at the 50 document limit" |
| `INVALID_FILE_TYPE` | File is not PDF/JPEG/PNG | Show in `failed[]` per-file |
| `FILE_TOO_LARGE` | Over 15 MB | Show in `failed[]` per-file |
| `STATE_EXPIRED` | User took >10 min on consent screen | "Session expired — try again" |

---

## Open questions for the mobile team

1. **OAuth browser approach** — `Linking.openURL` vs `react-native-inappbrowser-reborn` vs a WebView modal? The backend `/connect` endpoint requires a JWT. Recommend adding a `/auth/email/:provider/connect-url` endpoint that returns `{ url }` JSON so the app can use `Linking.openURL` with no JWT-in-browser issues.

2. **Deep link already set up?** Confirm `gathergo://email-connected` is handled in the root navigator or `App.tsx`. If invite deep links already work, the scheme is registered — just add a listener for this path.

3. **Token from storage** — use the same `getTokens()` / Keychain call that `client.ts` interceptor uses. Don't read from Zustand store directly for the OAuth URL construction since it may be stale.
