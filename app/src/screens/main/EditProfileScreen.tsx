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
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../../components/common/Logo';
import DobPicker from '../../components/common/DobPicker';
import BlobBackground from '../../components/common/BlobBackground';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';

type FormData = {
  fullName: string;
  username: string;
  gender: string;
  country: string;
  bio?: string;
  dob: string;
};

const editProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(60, 'Full name is too long'),
  username: z.string()
    .min(3, 'Must be at least 3 characters')
    .max(20, 'Must be at most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores allowed'),
  gender: z.string().min(1, 'Gender is required'),
  country: z.string().min(1, 'Country is required'),
  bio: z.string().max(100, 'Bio must be under 100 characters').optional(),
  dob: z.string().min(1, 'Date of birth is required'),
});

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function ChevronDown() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '70%' },
  handle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  option: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionSelected: { backgroundColor: '#f0fdfa' },
  optionText: { fontSize: 15, color: '#0f172a' },
  optionTextSelected: { color: '#0d9488', fontWeight: '600' },
  cancelBtn: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});


// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EditProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { uploadPhoto, editProfile, refreshProfile } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  const initialGender = user?.gender ? (GENDER_FROM_API[user.gender] ?? '') : '';
  const initialCountry = user?.country || '';
  const initialPhoto = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || '';
  const initialDob = user?.dob || '';
  const initialUsername = user?.username || '';

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      username: initialUsername,
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
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [usernameValue, setUsernameValue] = useState(initialUsername);
  const localPreviewUriRef = useRef<string>('');

  useEffect(() => {
    if (photoUploadSuccess) {
      const timer = setTimeout(() => setPhotoUploadSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [photoUploadSuccess]);

  // Sync avatar from store when photo URL changes (after upload)
  useEffect(() => {
    if (localPreviewUriRef.current) return;
    const photo = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || '';
    if (photo) setAvatar({ uri: photo, fileName: 'avatar.jpg', type: 'image/jpeg' });
  }, [user?.photoUrl, user?.avatarUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickImage() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 1280, maxHeight: 1280 }, async (res) => {
      if (!res.assets || !res.assets[0]) return;
      const asset = res.assets[0];
      const fileUri = asset.uri ?? '';
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.type ?? 'image/jpeg';

      if (!mimeType.startsWith('image/')) { setApiError('Only image files are allowed'); return; }
      const MAX_BYTES = 8 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        setApiError(`Image is too large (${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB). Please choose a smaller photo.`);
        return;
      }

      localPreviewUriRef.current = fileUri;
      setAvatar({ uri: fileUri, fileName, type: mimeType });
      setPhotoUploadSuccess(false);
      setUploadingPhoto(true);
      try {
        const cdnUrl = await uploadPhoto(fileUri, fileName, mimeType);
        if (cdnUrl) setPhotoUploadSuccess(true);
      } catch (err: any) {
        setApiError(err?.response?.data?.message || err?.message || 'Photo upload failed');
      } finally {
        setUploadingPhoto(false);
      }
    });
  }

  async function onSubmit(data: FormData) {
    try {
      setApiError(null);
      await editProfile({
        fullName: data.fullName,
        username: data.username || undefined,
        gender: GENDER_TO_API[gender] || undefined,
        country: country || undefined,
        bio: data.bio || undefined,
        dob: dob || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong. Please try again.';
      setApiError(msg);
    }
  }

  const busy = isLoading || uploadingPhoto;

  return (
    <BlobBackground>
      <PickerModal
        visible={showGenderPicker}
        title="Select Gender"
        options={GENDERS}
        selected={gender}
        onSelect={(val) => { setGender(val); setValue('gender', val); if (apiError) setApiError(null); }}
        onClose={() => setShowGenderPicker(false)}
      />
      <PickerModal
        visible={showCountryPicker}
        title="Select Country"
        options={COUNTRIES}
        selected={country}
        onSelect={(val) => { setCountry(val); setValue('country', val); if (apiError) setApiError(null); }}
        onClose={() => setShowCountryPicker(false)}
      />

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header row with back button */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Update your personal information</Text>

            {/* Avatar */}
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
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, focusedField === 'fullName' && styles.inputFocused, errors.fullName && styles.inputError]}
                  placeholder="Full Name"
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

            {/* Username / Handle */}
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, value } }) => (
                <>
                  <TextInput
                    style={[styles.input, focusedField === 'username' && styles.inputFocused, errors.username && styles.inputError]}
                    placeholder="Username"
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(val) => { const lowercased = val.toLowerCase(); onChange(lowercased); setUsernameValue(lowercased); if (apiError) setApiError(null); }}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    underlineColorAndroid="transparent"
                    selectionColor="#0d9488"
                    editable={!busy}
                    autoCapitalize="none"
                  />
                  {!errors.username && (focusedField === 'username' || usernameValue) && (
                    <Text style={styles.helperText}>Use lowercase letters, numbers, and underscores only</Text>
                  )}
                  {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}
                </>
              )}
            />

            {/* Date of Birth */}
            <DobPicker
              value={dob}
              onChange={(iso) => { setDob(iso); setValue('dob', iso, { shouldValidate: true }); }}
              error={errors.dob?.message}
              disabled={busy}
            />

            {/* Gender */}
            <TouchableOpacity
              style={[styles.dropdownBtn, showGenderPicker && styles.inputFocused, errors.gender && styles.inputError]}
              onPress={() => setShowGenderPicker(true)}
              activeOpacity={0.8}
              disabled={busy}>
              <Text style={[styles.dropdownText, !gender && styles.dropdownPlaceholder]}>
                {gender || 'Select Gender'}
              </Text>
              <ChevronDown />
            </TouchableOpacity>

            {/* Country */}
            <TouchableOpacity
              style={[styles.dropdownBtn, showCountryPicker && styles.inputFocused, errors.country && styles.inputError]}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.8}
              disabled={busy}>
              <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                {country || 'Select Country'}
              </Text>
              <ChevronDown />
            </TouchableOpacity>

            {/* Bio */}
            <Controller
              control={control}
              name="bio"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, styles.bioInput, focusedField === 'bio' && styles.inputFocused]}
                  placeholder="Adventurer, foodie, or slow traveler? Tell us your story..."
                  placeholderTextColor="#94a3b8"
                  value={value}
                  onFocus={() => setFocusedField('bio')}
                  onBlur={() => setFocusedField(null)}
                  multiline
                  numberOfLines={4}
                  maxLength={100}
                  textAlignVertical="top"
                  underlineColorAndroid="transparent"
                  selectionColor="#0d9488"
                  editable={!busy}
                  onChangeText={(val) => { onChange(val); if (apiError) setApiError(null); }}
                />
              )}
            />

            {apiError && <Text style={styles.apiErrorText}>{apiError}</Text>}

            {/* Save */}
            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.85}
              disabled={busy}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, zIndex: 10 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 100 },
  logoRow: { marginBottom: 56, alignItems: 'flex-start' },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '400', color: '#45556C', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 28 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarOuter: { width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(226,232,240,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  addBadge: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  addBadgeText: { color: '#ffffff', fontSize: 18, fontWeight: '700', lineHeight: 22, marginTop: -1 },
  photoHint: { marginTop: 6, fontSize: 12, color: '#0d9488', fontWeight: '500' },
  input: { width: '100%', backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a', marginBottom: 10 },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  helperText: { fontSize: 12, color: '#0d9488', marginBottom: 10, marginTop: -6, fontWeight: '400' },
  errorText: { fontSize: 12, color: '#ef4444', marginBottom: 10, marginTop: -6 },
  bioInput: { height: 100, paddingTop: 12, paddingBottom: 12 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  dropdownText: { fontSize: 14, color: '#0f172a' },
  dropdownPlaceholder: { color: '#94a3b8' },
  apiErrorText: { fontSize: 14, color: '#ef4444', textAlign: 'center', marginVertical: 10, fontWeight: '500' },
  primaryBtn: { backgroundColor: '#0d9488', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 6, elevation: 2 },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
});
