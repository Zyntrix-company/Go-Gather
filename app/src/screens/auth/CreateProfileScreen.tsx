import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Logo from '../../components/common/Logo';
import LegalModal from '../../components/common/LegalModal';
import BlobBackground from '../../components/common/BlobBackground';
import AppDatePicker from '../../components/common/AppDatePicker';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema } from '../../utils/validators';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import useUploadLimits from '../../hooks/useUploadLimits';
import { rejectOversizedFile } from '../../utils/uploadLimits';

type FormData = {
  fullName: string;
  gender: string;
  country: string;
  bio?: string;
  dob: string;
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function ChevronDown() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#94a3b8"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 9l6 6 6-6"
      />
    </Svg>
  );
}


function PersonIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill="#94a3b8">
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// Maps display labels ↔ API values
const GENDER_TO_API: Record<string, string> = {
  'Male': 'male',
  'Female': 'female',
  'Non-binary': 'other',
  'Prefer not to say': 'prefer_not_to_say',
};
const GENDER_FROM_API: Record<string, string> = {
  'male': 'Male',
  'female': 'Female',
  'other': 'Non-binary',
  'non-binary': 'Non-binary',
  'prefer_not_to_say': 'Prefer not to say',
  'prefer-not-to-say': 'Prefer not to say',
};

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Bhutan', 'Bolivia',
  'Brazil', 'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia',
  'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Ecuador', 'Egypt', 'Estonia',
  'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Latvia',
  'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia', 'Maldives', 'Malta', 'Mexico',
  'Moldova', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand',
  'Nigeria', 'North Korea', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama',
  'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
  'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa',
  'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Thailand', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Venezuela', 'Vietnam', 'Yemen', 'Zimbabwe',
].sort();

// ─── Picker Modal ─────────────────────────────────────────────────────────────
type PickerModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, options, selected, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pickerStyles.option, item === selected && pickerStyles.optionSelected]}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}>
                <Text style={[pickerStyles.optionText, item === selected && pickerStyles.optionTextSelected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionSelected: { backgroundColor: '#f0fdfa' },
  optionText: { fontSize: 15, color: '#0f172a' },
  optionTextSelected: { color: '#0d9488', fontWeight: '600' },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveInitialState(user: ReturnType<typeof useAuthStore.getState>['user']) {
  const g = user?.gender ? (GENDER_FROM_API[user.gender] ?? '') : '';
  const c = user?.country || '';
  const photo = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || '';
  const dob = user?.dob || '';
  return { g, c, photo, dob };
}


// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateProfileScreen({ navigation }: any) {
  const { uploadPhoto, saveProfile, refreshProfile } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const setPendingProfileSetup = useAuthStore((s) => s.setPendingProfileSetup);
  // Read user ONCE synchronously before any hook so we can seed initial state
  const user = useAuthStore((s) => s.user);
  const uploadLimits = useUploadLimits();

  const { g: initialGender, c: initialCountry, photo: initialPhoto, dob: initialDob } = deriveInitialState(user);

  const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      gender: initialGender,
      country: initialCountry,
      bio: user?.bio || '',
      dob: initialDob,
    },
  });

  const [avatar, setAvatar] = useState<{ uri: string; fileName: string; type: string } | null>(
    initialPhoto ? { uri: initialPhoto, fileName: 'avatar.jpg', type: 'image/jpeg' } : null,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);
  const [gender, setGender] = useState(initialGender);
  const [country, setCountry] = useState(initialCountry);
  const [dob, setDob] = useState(initialDob);
  const [dobText, setDobText] = useState(initialDob ? (() => { const [y,m,d] = initialDob.split('-'); return `${d}/${m}/${y}`; })() : '');
  const [dobSubmitError, setDobSubmitError] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const MAX_BIRTH_YEAR = new Date().getFullYear() - 13;

  function handleDobChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    setDobText(formatted);
    setDobSubmitError(false);

    if (digits.length === 8) {
      const dd = parseInt(digits.slice(0, 2), 10);
      const mm = parseInt(digits.slice(2, 4), 10);
      const yyyy = parseInt(digits.slice(4, 8), 10);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900) {
        setDob('');
        setValue('dob', '', { shouldValidate: false });
        return;
      }
      if (yyyy > MAX_BIRTH_YEAR) {
        setDob('');
        setValue('dob', '', { shouldValidate: false });
        setDobSubmitError(true);
        return;
      }
      const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
      setDob(iso);
      setValue('dob', iso, { shouldValidate: true });
    } else {
      setDob('');
      setValue('dob', '', { shouldValidate: false });
    }
  }
  // Stores the device-local file URI from the last image pick.
  // Used as fallback when the CDN URL fails to load (CloudFront access issue).
  const localPreviewUriRef = useRef<string>('');

  // Never show "Edit Profile" mode while the user is going through the initial
  // profile setup flow — even after saveProfile() sets isProfileComplete=true on
  // the server, we stay in "Create Profile" mode until the navigator transitions.
  // On mount, fetch fresh profile data from the server.
  // This covers the OAuth case where the backend response may not include all
  // profile fields — refreshProfile() will populate them and trigger the
  // re-sync effect below.
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect A — Re-sync FORM FIELDS when core profile data arrives from the server
  useEffect(() => {
    if (!user) return;
    const { g, c, dob: d } = deriveInitialState(user);
    reset({
      fullName: user.fullName || '',
      gender: g,
      country: c,
      bio: user.bio || '',
      dob: d,
    });
    setGender(g);
    setCountry(c);
    setDob(d);
  }, [user?.id, user?.fullName, user?.gender, user?.country, user?.bio, user?.dob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B — Sync AVATAR ONLY when the stored photo URL changes (after upload or profile fetch).
  // Kept separate so it never triggers a form reset.
  // Skipped when the user just picked a local image — we keep the local preview visible
  // instead of switching to the CDN URL, which may fail to load (CloudFront access issue).
  useEffect(() => {
    if (localPreviewUriRef.current) {
      console.log('[Effect B] Skipping CDN sync — local preview is active:', localPreviewUriRef.current);
      return;
    }
    const photo =
      user?.photoUrl ||
      user?.avatarUrl ||
      (user?.profile as any)?.avatarUrl ||
      '';
    console.log('[Effect B] user?.photoUrl:', user?.photoUrl);
    console.log('[Effect B] user?.avatarUrl:', user?.avatarUrl);
    console.log('[Effect B] resolved photo:', photo || '(EMPTY)');
    if (photo) {
      console.log('[Effect B] Syncing avatar from store:', photo);
      setAvatar({ uri: photo, fileName: 'avatar.jpg', type: 'image/jpeg' });
    }
  }, [user?.photoUrl, user?.avatarUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-remove "Photo uploaded" text after 5 seconds
  useEffect(() => {
    if (photoUploadSuccess) {
      const timer = setTimeout(() => setPhotoUploadSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [photoUploadSuccess]);

  // ─── Step A: Pick & upload photo ─────────────────────────────────────────
  function pickImage() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 1280, maxHeight: 1280 }, async (res) => {
      if (!res.assets || !res.assets[0]) return;

      const asset = res.assets[0];
      const fileUri = asset.uri ?? '';
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.type ?? 'image/jpeg';

      console.log('[pickImage] Asset picked:');
      console.log('  fileUri:', fileUri);
      console.log('  fileName:', fileName);
      console.log('  mimeType:', mimeType);
      console.log('  fileSize (bytes):', asset.fileSize ?? 'unknown');
      console.log('  dimensions:', asset.width, 'x', asset.height);

      if (!mimeType.startsWith('image/')) {
        setApiError('Only image files are allowed');
        return;
      }

      const sizeError = rejectOversizedFile(asset.fileSize, uploadLimits.avatar.maxFileBytes);
      if (sizeError) {
        setApiError(sizeError);
        return;
      }

      // Save local URI as preview fallback — used if the CDN URL fails to load
      localPreviewUriRef.current = fileUri;

      // Preview immediately with the local file (always works, no CDN dependency)
      setAvatar({ uri: fileUri, fileName, type: mimeType });
      setPhotoUploadSuccess(false);

      // Upload to S3 via the backend
      setUploadingPhoto(true);
      try {
        const cdnUrl = await uploadPhoto(fileUri, fileName, mimeType);
        console.log('[pickImage] cdnUrl returned from uploadPhoto:', cdnUrl || '(EMPTY)');
        // Keep showing the local preview — don't switch to CDN URL here because
        // the CloudFront distribution may return 403 on Android (unsigned URL / private S3).
        // The local preview is visually identical and loads reliably.
        if (cdnUrl) {
          console.log('[pickImage] Upload succeeded. Keeping local preview visible. CDN URL:', cdnUrl);
          setPhotoUploadSuccess(true);
        } else {
          console.warn('[pickImage] cdnUrl is empty — photo saved on server but URL not returned in response. Check backend field names in the upload response body.');
        }
      } catch (err: any) {
        console.error('[pickImage] ── UPLOAD FAILED ─────────────────────────────────');
        console.error('[pickImage] Error message :', err?.message);
        console.error('[pickImage] Server response:', JSON.stringify(err?.response ?? null));
        if (err?.message === 'Network request failed') {
          console.error('[pickImage] ► "Network request failed" means the fetch() call');
          console.error('[pickImage]   never got a response from the server.');
          console.error('[pickImage]   Most likely causes:');
          console.error('[pickImage]   1. File too large — server closed connection before responding.');
          console.error('[pickImage]      Check backend multer/busboy maxFileSize limit.');
          console.error('[pickImage]   2. content:// URI — Android media URI not readable by fetch.');
          console.error('[pickImage]      Check [pickImage] fileUri log above for the URI scheme.');
          console.error('[pickImage]   3. Server down / wrong IP — check API_BASE reachability.');
        }
        console.error('[pickImage] ────────────────────────────────────────────────────');

        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Photo upload failed';

        setApiError(msg);
      } finally {
        setUploadingPhoto(false);
      }
    });
  }

  // ─── Step B: Save profile details ────────────────────────────────────────
  async function onSubmit(data: FormData) {
    if (!dob) { setDobSubmitError(true); return; }
    const yyyy = parseInt(dob.split('-')[0], 10);
    if (yyyy > MAX_BIRTH_YEAR) { setDobSubmitError(true); return; }
    try {
      setApiError(null);

      await saveProfile({
        fullName: data.fullName,
        gender: GENDER_TO_API[gender] || undefined,
        country: country || undefined,
        bio: data.bio || undefined,
        dob: dob || undefined,
      });

      console.log('[Save Success]: Profile created for user.');
      // Clear the pending flag. RootNavigator switches to MainStack automatically
      // because saveProfile → refreshProfile already set isProfileComplete=true in the store.
      setPendingProfileSetup(false);
    } catch (err: any) {
      console.error('[Save Profile Error]:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong. Please try again.';
      setApiError(msg);
    }
  }


  const busy = isLoading || uploadingPhoto;

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlobBackground>
        {/* Gender picker modal */}
        <PickerModal
          visible={showGenderPicker}
          title="Select Gender"
          options={GENDERS}
          selected={gender}
          onSelect={(val) => { setGender(val); setValue('gender', val); if (apiError) setApiError(null); }}
          onClose={() => setShowGenderPicker(false)}
        />

        {/* Country picker modal */}
        <PickerModal
          visible={showCountryPicker}
          title="Select Country"
          options={COUNTRIES}
          selected={country}
          onSelect={(val) => { setCountry(val); setValue('country', val); if (apiError) setApiError(null); }}
          onClose={() => setShowCountryPicker(false)}
        />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Create Profile</Text>
            <Text style={styles.subtitle}>Fill in your details to continue</Text>

            {/* Avatar — Step A */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.85} disabled={uploadingPhoto}>
                <View style={styles.avatarOuter}>
                  <View style={styles.avatarInner}>
                    {avatar ? (
                      <Image
                        key={avatar.uri}
                        source={{ uri: avatar.uri }}
                        style={styles.avatarImage}
                        resizeMode="cover"
                        onError={() => {
                          // Fall back to the local preview if the CDN URL fails transiently
                          if (localPreviewUriRef.current && avatar.uri !== localPreviewUriRef.current) {
                            setAvatar({ uri: localPreviewUriRef.current, fileName: 'avatar.jpg', type: 'image/jpeg' });
                          }
                        }}
                      />
                    ) : (
                      <PersonIcon />
                    )}
                  </View>
                </View>
                {/* Badge */}
                <View style={styles.addBadge}>
                  {uploadingPhoto
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.addBadgeText}>+</Text>}
                </View>
              </TouchableOpacity>
              {photoUploadSuccess && !uploadingPhoto && (
                <Text style={styles.photoHint}>Photo uploaded ✓</Text>
              )}
            </View>

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name <Text style={styles.required}>*</Text></Text>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, focusedField === 'fullName' && styles.inputFocused, errors.fullName && styles.inputError]}
                    placeholder="e.g. Alex Johnson"
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(val) => { onChange(val); if (apiError) setApiError(null); }}
                    onFocus={() => setFocusedField('fullName')}
                    onBlur={() => setFocusedField(null)}
                    underlineColorAndroid="transparent"
                    selectionColor="#0d9488"
                    editable={!busy}
                  />
                )}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}
            </View>

            {/* Gender */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gender <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, showGenderPicker && styles.inputFocused, errors.gender && styles.inputError]}
                onPress={() => setShowGenderPicker(true)}
                activeOpacity={0.8}
                disabled={busy}>
                <Text style={[styles.dropdownText, !gender && styles.dropdownPlaceholder]}>
                  {gender || 'Select'}
                </Text>
                <ChevronDown />
              </TouchableOpacity>
              {errors.gender && <Text style={styles.errorText}>{errors.gender.message}</Text>}
            </View>

            {/* Country */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Country <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, showCountryPicker && styles.inputFocused, errors.country && styles.inputError]}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.8}
                disabled={busy}>
                <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                  {country || 'Select'}
                </Text>
                <ChevronDown />
              </TouchableOpacity>
              {errors.country && <Text style={styles.errorText}>{errors.country.message}</Text>}
            </View>

            {/* Date of Birth */}
            <LegalModal visible={showLegal} type="terms" onClose={() => setShowLegal(false)} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date of Birth <Text style={styles.required}>*</Text></Text>
              <AppDatePicker
                mode="dob"
                value={dob}
                onChange={(iso) => {
                  setDob(iso);
                  setDobText(iso ? (() => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; })() : '');
                  setValue('dob', iso, { shouldValidate: true });
                  setDobSubmitError(false);
                }}
                placeholder="DD/MM/YYYY"
                format="dd/mm/yyyy"
                error={dobSubmitError ? ' ' : null}
                disabled={busy}
                title="Date of birth"
              />
              {dobSubmitError && (
                <View style={styles.dobHintRow}>
                  <Text style={[styles.dobHintText, { color: '#ef4444' }]}>DOB must comply with our </Text>
                  <TouchableOpacity onPress={() => setShowLegal(true)} activeOpacity={0.7}>
                    <Text style={[styles.dobHintLink, { color: '#ef4444' }]}>Terms & Conditions</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>


            {/* API Error Message */}
            {apiError && (
              <Text style={styles.apiErrorText}>{apiError}</Text>
            )}

            {/* Save & Continue */}
            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.85}
              disabled={busy}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Save & Continue</Text>}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BlobBackground>
    </SafeAreaView>
  );
}

const SCREEN_W = Dimensions.get('window').width;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  kav: { flex: 1, zIndex: 10 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_W < 375 ? 16 : 24,
    paddingTop: SCREEN_W < 375 ? 12 : 16,
    paddingBottom: 100,
  },
  logoRow: { marginBottom: 56, alignItems: 'flex-start' },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: SCREEN_W < 375 ? 23 : 28,
    fontWeight: '400',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(226,232,240,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  addBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addBadgeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: -1,
  },
  photoHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '500',
  },

  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '400', color: '#0F172B', marginBottom: 5 },
  required: { color: '#ef4444', fontWeight: '400' },
  errorText: { fontSize: 11, color: '#ef4444', marginTop: 4 },
  dobHintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 5 },
  dobHintText: { fontSize: 11, color: '#64748b' },
  dobHintLink: { fontSize: 11, color: '#0d9488', textDecorationLine: 'underline' },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  inputFocused: {
    borderColor: '#0d9488',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  apiErrorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  inputIconRight: {
    paddingRight: 12,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownText: { fontSize: 14, color: '#0f172a' },
  dropdownPlaceholder: { color: '#94a3b8' },
  bioInput: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
