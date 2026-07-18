import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Modal, Pressable, TextInput, Dimensions, KeyboardAvoidingView, Platform, FlatList,
  Image, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { MoreVertical, Pen, Trash2, RefreshCw, X } from 'lucide-react-native';
import { launchCamera } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes, keepLocalCopy, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Toast from 'react-native-toast-message';
import Svg, { Circle, Path } from 'react-native-svg';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import DocTypeIcon from '../../components/common/DocTypeIcon';
import { stripExt, DocItemSkeleton } from '../../components/common/DocumentItem';
import UploadOptionsRow from '../../components/common/UploadOptionsRow';
import EmailOptionsRow from '../../components/common/EmailOptionsRow';
import UploadLimitNote from '../../components/common/UploadLimitNote';
import DateInfoPopover from '../../components/common/DateInfoPopover';
import DrivePickerRow from '../../components/gallery/DrivePickerRow';
import { DriveBrandIcon } from '../../components/common/GoogleWorkspaceIcons';
import { EmailProviderIcon, emailProviderLabel } from '../../components/common/EmailProviderIcons';
import colors from '../../theme/colors';
import { showAlert, showConfirm } from '../../store/alertStore';
import {
  getEmailStatus, listEmailAttachments, getDriveStatus, listDriveFiles,
  type EmailProvider, type EmailAttachment, type DriveFile, type EmailConnectionStatus,
} from '../../api/trips.api';
import { promptConnectEmail, checkDriveConnected, promptConnectDrive, watchDriveConnect } from '../../utils/drivePickerFlow';
import useUploadLimits from '../../hooks/useUploadLimits';
import {
  getPersonalDocs, uploadPersonalDoc, replacePersonalDoc, renamePersonalDoc, deletePersonalDoc,
  importEmailAttachmentsToPersonal, importDriveFilesToPersonal,
  type Doc,
} from '../../api/personalDocs.api';

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Section divider ────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Document row with 3-dot menu (Replace / Rename / Delete) ───────────────────

function DocRow({
  doc, onReplace, onRename, onDelete, busy,
}: {
  doc: Doc;
  onReplace: () => void;
  onRename: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const openMenu = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      const screenW = Dimensions.get('window').width;
      setAnchor({ top: y + h + 4, right: screenW - (x + w) });
      setMenuOpen(true);
    });
  };

  const run = (fn: () => void) => { setMenuOpen(false); fn(); };

  return (
    <View style={[styles.docRow, busy && styles.docRowBusy]}>
      <DocTypeIcon doc={doc} size={36} />
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{stripExt(doc.fileName)}</Text>
      </View>
      <Text style={styles.docDate}>{formatDate(doc.createdAt)}</Text>

      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} style={styles.docMenuBtn} />
      ) : (
        <TouchableOpacity
          ref={btnRef}
          style={styles.docMenuBtn}
          onPress={openMenu}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MoreVertical size={18} color="#64748b" strokeWidth={1.8} />
        </TouchableOpacity>
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, anchor ? { top: anchor.top, right: anchor.right } : { top: 120, right: 16 }]}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.8} onPress={() => run(onReplace)}>
              <RefreshCw size={14} color="#334155" strokeWidth={2} />
              <Text style={styles.menuText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} activeOpacity={0.8} onPress={() => run(onRename)}>
              <Pen size={14} color="#334155" strokeWidth={2} />
              <Text style={styles.menuText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} activeOpacity={0.8} onPress={() => run(onDelete)}>
              <Trash2 size={14} color="#ef4444" strokeWidth={2} />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PersonalDocumentsScreen({ navigation }: { navigation: any }) {
  const uploadLimits = useUploadLimits();
  const maxPersonalDocs = uploadLimits.personalDoc.maxFilesTotal ?? 10;

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<Doc | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);

  const [showDocsInfoTooltip, setShowDocsInfoTooltip] = useState(false);
  const [docsIconPos, setDocsIconPos] = useState({ x: 0, y: 0 });
  const docsIconRef = useRef<any>(null);

  // Email import
  const [emailStatus, setEmailStatus] = useState<EmailConnectionStatus | null>(null);
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('gmail');
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedAttachIds, setSelectedAttachIds] = useState<Set<string>>(new Set());
  const [emailImporting, setEmailImporting] = useState(false);

  // Drive import
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [selectedDriveIds, setSelectedDriveIds] = useState<Set<string>>(new Set());
  const [driveImporting, setDriveImporting] = useState(false);
  const driveWatchRef = useRef<null | (() => void)>(null);

  useEffect(() => () => { driveWatchRef.current?.(); }, []);

  const isFull = docs.length >= maxPersonalDocs;

  const load = useCallback(async () => {
    try {
      const res = await getPersonalDocs();
      setDocs(res.docs ?? []);
    } catch {
      // Screen still renders; upload/list simply start empty on error.
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const showError = (err: any, fallback: string) =>
    Toast.show({ type: 'error', text1: 'Error', text2: err?.response?.data?.message || err?.message || fallback });

  const guardFull = () => {
    if (isFull) {
      showAlert({ title: 'Limit reached', message: `You can store up to ${maxPersonalDocs} documents. Delete one to add more.`, buttons: [{ text: 'OK' }] });
      return true;
    }
    return false;
  };

  async function handleUpload() {
    if (guardFull()) return;
    setUploading(true);
    try {
      const [picked] = await pickDocument({ type: [docTypes.allFiles] });
      const [localCopy] = await keepLocalCopy({
        files: [{ uri: picked.uri, fileName: picked.name ?? 'document' }],
        destination: 'cachesDirectory',
      });
      if (localCopy.status === 'error') throw new Error(localCopy.copyError);
      const file = { uri: localCopy.localUri, name: decodeURIComponent(picked.name ?? 'document'), type: picked.type ?? 'application/octet-stream' };
      const { doc } = await uploadPersonalDoc(file);
      setDocs((p) => [doc, ...p]);
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      showError(err, 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleCamera() {
    if (guardFull()) return;
    launchCamera({ mediaType: 'photo', quality: 0.8 }, async (res) => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      try {
        const file = { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' };
        const { doc } = await uploadPersonalDoc(file);
        setDocs((p) => [doc, ...p]);
      } catch (err) {
        showError(err, 'Upload failed');
      } finally {
        setUploading(false);
      }
    });
  }

  async function handleReplace(target: Doc) {
    setBusyDocId(target.id);
    try {
      const [picked] = await pickDocument({ type: [docTypes.allFiles] });
      const [localCopy] = await keepLocalCopy({
        files: [{ uri: picked.uri, fileName: picked.name ?? 'document' }],
        destination: 'cachesDirectory',
      });
      if (localCopy.status === 'error') throw new Error(localCopy.copyError);
      const file = { uri: localCopy.localUri, name: decodeURIComponent(picked.name ?? 'document'), type: picked.type ?? 'application/octet-stream' };
      const { doc } = await replacePersonalDoc(target.id, file);
      setDocs((p) => p.map((d) => (d.id === target.id ? doc : d)));
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      showError(err, 'Replace failed');
    } finally {
      setBusyDocId(null);
    }
  }

  function openRename(target: Doc) {
    setRenameTarget(target);
    setRenameText(stripExt(target.fileName));
  }

  async function handleRenameSave() {
    if (!renameTarget || !renameText.trim()) return;
    setRenameSaving(true);
    try {
      const { doc } = await renamePersonalDoc(renameTarget.id, renameText.trim());
      setDocs((p) => p.map((d) => (d.id === renameTarget.id ? doc : d)));
      setRenameTarget(null);
    } catch (err) {
      showError(err, 'Rename failed');
    } finally {
      setRenameSaving(false);
    }
  }

  function handleDelete(target: Doc) {
    showConfirm({
      title: 'Delete document?',
      message: `"${stripExt(target.fileName)}" will be permanently removed.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setBusyDocId(target.id);
        try {
          await deletePersonalDoc(target.id);
          setDocs((p) => p.filter((d) => d.id !== target.id));
        } catch (err) {
          showError(err, 'Delete failed');
        } finally {
          setBusyDocId(null);
        }
      },
    });
  }

  function reportImport(res: { imported: unknown[]; failed: { fileName: string; reason: string }[] }) {
    const okCount = res.imported.length;
    const failCount = res.failed.length;
    if (okCount > 0) {
      Toast.show({ type: 'success', text1: `Imported ${okCount} document${okCount === 1 ? '' : 's'}`, text2: failCount > 0 ? `${failCount} failed` : undefined });
    } else if (failCount > 0) {
      Toast.show({ type: 'error', text1: 'Import failed', text2: res.failed[0]?.reason });
    }
  }

  // ── Email import ──
  async function openEmailPicker(provider: EmailProvider) {
    if (guardFull()) return;
    let status = emailStatus;
    if (!status) {
      status = await getEmailStatus().catch(() => null);
      if (status) setEmailStatus(status);
    }
    if (!status?.[provider]?.connected) {
      promptConnectEmail(provider, () => {
        getEmailStatus().then(setEmailStatus).catch(() => {});
        openEmailPicker(provider);
      });
      return;
    }
    setEmailProvider(provider);
    setSelectedAttachIds(new Set());
    setEmailLoading(true);
    setShowEmailPicker(true);
    try {
      const res = await listEmailAttachments(provider);
      setEmailAttachments(res.attachments);
    } catch (err) {
      setShowEmailPicker(false);
      showError(err, 'Could not load attachments');
    } finally {
      setEmailLoading(false);
    }
  }

  async function confirmEmailImport() {
    const selected = emailAttachments
      .filter((a) => selectedAttachIds.has(a.attachmentId))
      .map((a) => ({ attachmentId: a.attachmentId, messageId: a.messageId, fileName: a.fileName }));
    if (!selected.length) return;
    setEmailImporting(true);
    try {
      const res = await importEmailAttachmentsToPersonal(emailProvider, selected);
      setShowEmailPicker(false);
      setSelectedAttachIds(new Set());
      await load();
      reportImport(res);
    } catch (err) {
      showError(err, 'Import failed');
    } finally {
      setEmailImporting(false);
    }
  }

  // ── Drive import ──
  async function openDrivePicker() {
    if (guardFull()) return;
    const connected = await checkDriveConnected();
    if (!connected) {
      promptConnectDrive();
      driveWatchRef.current?.();
      driveWatchRef.current = watchDriveConnect(() => {
        driveWatchRef.current?.();
        driveWatchRef.current = null;
        openDrivePicker();
      });
      return;
    }
    setSelectedDriveIds(new Set());
    setDriveLoading(true);
    setShowDrivePicker(true);
    try {
      const res = await listDriveFiles();
      setDriveFiles(res.files);
    } catch (err) {
      setShowDrivePicker(false);
      showError(err, 'Could not load Drive files');
    } finally {
      setDriveLoading(false);
    }
  }

  async function confirmDriveImport() {
    const selected = driveFiles
      .filter((f) => selectedDriveIds.has(f.fileId))
      .map((f) => ({ fileId: f.fileId, name: f.name, mimeType: f.mimeType }));
    if (!selected.length) return;
    setDriveImporting(true);
    try {
      const res = await importDriveFilesToPersonal(selected);
      setShowDrivePicker(false);
      setSelectedDriveIds(new Set());
      await load();
      reportImport(res);
    } catch (err) {
      showError(err, 'Import failed');
    } finally {
      setDriveImporting(false);
    }
  }

  return (
    <AppScreenLayout navigation={navigation} title="Personal Documents" titleStyle={styles.headerTitle} onBack={() => navigation.goBack()}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        showsVerticalScrollIndicator={false}>

        <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          Store and manage your important documents securely.
        </Text>

        {/* Upload */}
        <Divider label="UPLOAD DOCUMENTS" />
        <UploadOptionsRow
          onUpload={handleUpload}
          onCamera={handleCamera}
          onDrive={openDrivePicker}
          uploading={uploading}
          disabled={isFull}
          transparent
        />

        {/* Email import */}
        <Divider label="IMPORTED FROM EMAIL" />
        <EmailOptionsRow
          onGmail={() => openEmailPicker('gmail')}
          onOutlook={() => openEmailPicker('outlook')}
          disabled={isFull}
          transparent
        />

        <UploadLimitNote text={`You can add up to ${maxPersonalDocs} documents to your account.`} />

        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle} numberOfLines={1}>My Documents</Text>
          <TouchableOpacity
            ref={docsIconRef}
            style={styles.docsInfoIcon}
            onPress={() => {
              if (docsIconRef.current) {
                docsIconRef.current.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
                  setDocsIconPos({ x: pageX + width / 2, y: pageY + height / 2 });
                });
              }
              setShowDocsInfoTooltip(true);
            }}
            activeOpacity={0.6}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={10} stroke="#0d9488" strokeWidth={2} />
              <Path d="M12 7v5M12 17a1 1 0 100-2 1 1 0 000 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.list}>
            <DocItemSkeleton />
            <DocItemSkeleton />
            <DocItemSkeleton />
          </View>
        ) : docs.length === 0 ? (
          <Text style={styles.empty}>No documents yet. Upload your first one above.</Text>
        ) : (
          <View style={styles.list}>
            {docs.map((doc, i) => {
              const busy = busyDocId === doc.id;
              const url = doc.downloadUrl ?? doc.fileUrl;
              return (
                <View key={doc.id}>
                  {i > 0 && <View style={styles.listDivider} />}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={busy}
                    onPress={() => url ? setDocPreviewUrl(url) : showAlert({ title: 'Error', message: 'Document URL not available.' })}
                  >
                    <DocRow
                      doc={doc}
                      busy={busy}
                      onReplace={() => handleReplace(doc)}
                      onRename={() => openRename(doc)}
                      onDelete={() => handleDelete(doc)}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.uploadingText}>Uploading…</Text>
          </View>
        )}
      </ScrollView>

      <DateInfoPopover
        visible={showDocsInfoTooltip}
        onClose={() => setShowDocsInfoTooltip(false)}
        iconX={docsIconPos.x}
        iconY={docsIconPos.y}
        message="Don’t upload financial documents or card photos. GatherrGo isn’t liable for misuse or fraud."
      />

      {/* Rename modal */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.renameOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameTarget(null)} />
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename document</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Document name"
              placeholderTextColor="#94a3b8"
              autoFocus
              selectionColor={colors.accent}
              editable={!renameSaving}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={styles.renameCancel} onPress={() => setRenameTarget(null)} activeOpacity={0.8} disabled={renameSaving}>
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameSave, (!renameText.trim() || renameSaving) && { opacity: 0.6 }]}
                onPress={handleRenameSave}
                activeOpacity={0.85}
                disabled={!renameText.trim() || renameSaving}>
                {renameSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.renameSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Document preview modal — in-app WebView */}
      <Modal visible={!!docPreviewUrl} transparent={false} animationType="slide" onRequestClose={() => setDocPreviewUrl(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1e293b' }}>
            <TouchableOpacity onPress={() => setDocPreviewUrl(null)} activeOpacity={0.7} style={{ marginRight: 12 }}>
              <Text style={{ color: '#5eead4', fontSize: 15, fontWeight: '500' }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '500', flex: 1 }} numberOfLines={1}>Document Preview</Text>
          </View>
          {docPreviewUrl && (() => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic)(\?|$)/i.test(docPreviewUrl) ||
              docs.find(d => (d.downloadUrl ?? d.fileUrl) === docPreviewUrl)?.mimeType?.startsWith('image/');
            return isImage
              ? <Image source={{ uri: docPreviewUrl }} style={{ flex: 1 }} resizeMode="contain" />
              : <WebView
                source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(docPreviewUrl)}` }}
                style={{ flex: 1 }}
                startInLoadingState
                javaScriptEnabled
              />;
          })()}
        </SafeAreaView>
      </Modal>

      {/* Email attachment picker */}
      <Modal visible={showEmailPicker} transparent animationType="slide" onRequestClose={() => setShowEmailPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <EmailProviderIcon provider={emailProvider} size={22} />
              <Text style={styles.pickerTitle}>Import from {emailProviderLabel(emailProvider)}</Text>
              <TouchableOpacity onPress={() => setShowEmailPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {emailLoading ? (
              <View style={styles.pickerCenter}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.pickerMuted}>Loading attachments…</Text>
              </View>
            ) : emailAttachments.length === 0 ? (
              <View style={styles.pickerCenter}>
                <Text style={styles.pickerMuted}>No attachments found in the last 30 days.</Text>
              </View>
            ) : (
              <FlatList
                data={emailAttachments}
                keyExtractor={(a) => a.attachmentId}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const sel = selectedAttachIds.has(item.attachmentId);
                  return (
                    <TouchableOpacity
                      style={styles.selRow}
                      onPress={() => setSelectedAttachIds((prev) => { const n = new Set(prev); sel ? n.delete(item.attachmentId) : n.add(item.attachmentId); return n; })}
                      activeOpacity={0.7}>
                      <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                        {sel && <Text style={styles.checkboxTick}>✓</Text>}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.selName} numberOfLines={1}>{item.fileName}</Text>
                        {item.emailSubject ? <Text style={styles.selSub} numberOfLines={1}>{item.emailSubject}</Text> : null}
                        <Text style={styles.selMeta}>{Math.round(item.fileSizeBytes / 1024)} KB</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {!emailLoading && emailAttachments.length > 0 && (
              <View style={styles.pickerFooter}>
                <TouchableOpacity
                  style={[styles.importBtn, selectedAttachIds.size === 0 && { opacity: 0.5 }]}
                  onPress={confirmEmailImport}
                  disabled={selectedAttachIds.size === 0 || emailImporting}
                  activeOpacity={0.85}>
                  {emailImporting ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.importBtnText}>{selectedAttachIds.size > 0 ? `Import (${selectedAttachIds.size})` : 'Import'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Drive file picker */}
      <Modal visible={showDrivePicker} transparent animationType="slide" onRequestClose={() => setShowDrivePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <DriveBrandIcon size={22} />
              <Text style={styles.pickerTitle}>Import from Google Drive</Text>
              <TouchableOpacity onPress={() => setShowDrivePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {driveLoading ? (
              <View style={styles.pickerCenter}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.pickerMuted}>Loading files…</Text>
              </View>
            ) : driveFiles.length === 0 ? (
              <View style={styles.pickerCenter}>
                <Text style={styles.pickerMuted}>No compatible files found in your Drive root.</Text>
              </View>
            ) : (
              <FlatList
                data={driveFiles}
                keyExtractor={(f) => f.fileId}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => (
                  <DrivePickerRow
                    file={item}
                    selected={selectedDriveIds.has(item.fileId)}
                    onToggle={() => setSelectedDriveIds((prev) => { const n = new Set(prev); n.has(item.fileId) ? n.delete(item.fileId) : n.add(item.fileId); return n; })}
                  />
                )}
              />
            )}

            {!driveLoading && driveFiles.length > 0 && (
              <View style={styles.pickerFooter}>
                <TouchableOpacity
                  style={[styles.importBtn, selectedDriveIds.size === 0 && { opacity: 0.5 }]}
                  onPress={confirmDriveImport}
                  disabled={selectedDriveIds.size === 0 || driveImporting}
                  activeOpacity={0.85}>
                  {driveImporting ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.importBtnText}>{selectedDriveIds.size > 0 ? `Import (${selectedDriveIds.size})` : 'Import'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerTitle: { fontWeight: '500' },
  scroll: { paddingHorizontal: 20, paddingTop: 0 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: -2, marginBottom: 6, lineHeight: 18 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 14 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.4 },

  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, marginBottom: 10 },
  listTitle: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  docsInfoIcon: { padding: 2, marginTop: 3 },

  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 24 },

  list: { marginTop: 8 },
  listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.18)' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  docRowBusy: { opacity: 0.45 },
  docInfo: { flex: 1, minWidth: 0 },
  docName: { fontSize: 14, fontWeight: '400', color: colors.textPrimary },
  docDate: { fontSize: 13, color: colors.textSecondary },
  docMenuBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuSheet: {
    position: 'absolute', width: 156, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  menuItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  menuText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  menuTextDanger: { color: '#ef4444' },

  uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  uploadingText: { fontSize: 13, color: colors.textSecondary },

  renameOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  renameCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  renameTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 14 },
  renameInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  renameActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  renameCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  renameCancelText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  renameSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  renameSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Import pickers — centered dialog (matches trips/events)
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  pickerSheet: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '82%', overflow: 'hidden', paddingBottom: 8 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pickerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  pickerCenter: { padding: 36, alignItems: 'center', gap: 12 },
  pickerMuted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  selRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxTick: { color: '#fff', fontSize: 11, fontWeight: '600' },
  selName: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  selSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  selMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  pickerFooter: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  importBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  importBtnText: { color: '#fff', fontSize: 15, fontWeight: '400' },
});
