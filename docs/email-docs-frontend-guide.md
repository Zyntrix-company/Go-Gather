# Email Doc Import — Frontend Implementation Guide

Feature: **Extract docs from email** (Gmail & Outlook)
Backend: fully built and live at `https://api.gatherrgo.com`

---

## How it works User flow

1. Inside the trip's **Docs** modal, user taps "Extract from Email"
2. App shows a sheet: **Gmail** or **Outlook**
3. User taps a provider → app calls `GET /auth/email/:provider/connect-url` via axios → gets back `{ url }`
4. App opens that URL with `Linking.openURL(url)` — **native browser, never WebView**
5. User authenticates on Google/Microsoft consent screen
6. Backend saves tokens, redirects to deep link: `gathergo://email-connected?provider=gmail&success=true`
7. App catches the deep link → shows attachment picker
8. User selects attachments → `POST /email-docs/import`
9. Imported docs appear in the docs list immediately

> **Critical:** Always use `Linking.openURL()` to open the OAuth URL. Never a `WebView` — Google blocks it with `Error 403: disallowed_useragent`.

---

## Step 1 — API functions to add in `trips.api.ts`

Add after the existing `deleteDoc` function:

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

/** Call via axios (JWT injected automatically), then open the returned URL with Linking.openURL() */
export async function getEmailConnectUrl(provider: EmailProvider) {
  const res = await client.get(`/auth/email/${provider}/connect-url`);
  return res.data as { url: string };
}

export async function getEmailStatus() {
  const res = await client.get('/email-docs/status');
  return res.data as EmailConnectionStatus;
}

export async function listEmailAttachments(provider: EmailProvider, tripId: string) {
  const res = await client.get('/email-docs/attachments', { params: { provider, tripId } });
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

## Step 2 — Imports to add in `TripDetailScreen.tsx`

```typescript
import {
  // ...existing imports...
  getEmailConnectUrl,
  getEmailStatus,
  listEmailAttachments,
  importEmailAttachments,
} from '../../api/trips.api';
import type { EmailAttachment, EmailProvider } from '../../api/trips.api';
```

---

## Step 3 — State to add in `TripDetailScreen.tsx`

Around line 320, alongside the other modal state:

```typescript
// ── Email doc import ──
const [showEmailProviderSheet,   setShowEmailProviderSheet]   = useState(false);
const [showEmailAttachments,     setShowEmailAttachments]     = useState(false);
const [emailProvider,            setEmailProvider]            = useState<EmailProvider | null>(null);
const [emailAttachments,         setEmailAttachments]         = useState<EmailAttachment[]>([]);
const [selectedEmailAttachments, setSelectedEmailAttachments] = useState<Set<string>>(new Set());
const [isLoadingEmailAtts,       setIsLoadingEmailAtts]       = useState(false);
const [isImportingEmail,         setIsImportingEmail]         = useState(false);
```

---

## Step 4 — Deep link listener

Add this `useEffect` near the other effects:

```typescript
// ── Handle OAuth callback deep link ──
useEffect(() => {
  const sub = Linking.addEventListener('url', ({ url }) => {
    if (!url.startsWith('gathergo://email-connected')) return;
    const params = new URLSearchParams(url.split('?')[1]);
    const provider = params.get('provider') as EmailProvider;
    const success  = params.get('success') === 'true';

    if (success && provider) {
      setEmailProvider(provider);
      fetchEmailAttachments(provider);
    } else {
      Toast.show({ type: 'error', text1: 'Connection failed', text2: params.get('error') ?? 'Could not connect email' });
    }
  });

  // iOS: handle case where app was closed when deep link arrived
  Linking.getInitialURL().then(url => {
    if (!url?.startsWith('gathergo://email-connected')) return;
    const params = new URLSearchParams(url.split('?')[1]);
    const provider = params.get('provider') as EmailProvider;
    if (params.get('success') === 'true' && provider) {
      setEmailProvider(provider);
      fetchEmailAttachments(provider);
    }
  });

  return () => sub.remove();
}, [tripId]);
```

---

## Step 5 — Handler functions

Add after `handleDeleteDoc` (around line 877):

```typescript
// ── Email doc import handlers ──

async function handleEmailProviderSelect(provider: EmailProvider) {
  setShowEmailProviderSheet(false);
  setEmailProvider(provider);
  try {
    // If already connected, skip OAuth and go straight to attachments
    const status = await getEmailStatus();
    if (status[provider].connected) {
      await fetchEmailAttachments(provider);
      return;
    }
  } catch {}

  // Not connected — get the OAuth URL from the backend and open in native browser
  try {
    const { url } = await getEmailConnectUrl(provider);
    Linking.openURL(url); // ✅ native browser — Google accepts this
  } catch (err) {
    handleApiError(err);
  }
}

async function fetchEmailAttachments(provider: EmailProvider) {
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

## Step 6 — JSX: "Extract from Email" button

Insert **after** the "Upload Documents" button (after line 1614), before the `{docs.length === 0 ?` check:

```tsx
{/* Extract from Email */}
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

## Step 7 — New Modals

Add both modals after the existing Documents modal (after line 1643):

### Provider picker

```tsx
{/* ── Email provider picker ── */}
<Modal visible={showEmailProviderSheet} transparent animationType="slide" onRequestClose={() => setShowEmailProviderSheet(false)}>
  <View style={styles.overlay}>
    <View style={styles.dialog}>
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

No changes needed if invite deep links already work — both use the `gathergo://` scheme.

- **iOS `Info.plist`** — verify `gathergo` is in `CFBundleURLSchemes`
- **Android `AndroidManifest.xml`** — verify `gathergo://` intent filter exists

---

## Error codes

| Code | Meaning | Show |
|---|---|---|
| `NOT_CONNECTED` | No token stored | Trigger OAuth again |
| `REAUTH_REQUIRED` | Refresh token revoked | "Gmail connection expired — reconnect" |
| `LIMIT_EXCEEDED` | Trip at 50 doc cap | "Trip is at the 50 document limit" |
| `INVALID_FILE_TYPE` | Not PDF/JPEG/PNG | Shown in `failed[]` per file |
| `FILE_TOO_LARGE` | Over 15 MB | Shown in `failed[]` per file |
| `STATE_EXPIRED` | >10 min on consent screen | "Session expired — try again" |
