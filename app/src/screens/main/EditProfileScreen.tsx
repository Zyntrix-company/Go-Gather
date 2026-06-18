import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path } from 'react-native-svg';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import useUploadLimits from '../../hooks/useUploadLimits';
import { rejectOversizedFile } from '../../utils/uploadLimits';

type FormData = {
  fullName: string;
  username: string;
  gender: string;
  country: string;
  bio?: string;
  dob: string;
};

const editProfileSchema = z.object({
  fullName: z.string().min(2, 'At least 2 characters').max(60, 'Too long'),
  username: z.string()
    .min(3, 'At least 3 characters')
    .max(20, 'At most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Lowercase, numbers & underscores only'),
  gender: z.string().min(1, 'Required'),
  country: z.string().min(1, 'Required'),
  bio: z.string().max(100, 'Max 100 characters').optional(),
  dob: z.string().min(1, 'Required'),
});

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </Svg>
  );
}

function PersonIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" fill="#94a3b8">
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const GENDER_TO_API: Record<string, string> = {
  'Male': 'male', 'Female': 'female',
  'Non-binary': 'other', 'Prefer not to say': 'prefer_not_to_say',
};
const GENDER_FROM_API: Record<string, string> = {
  'male': 'Male', 'female': 'Female',
  'other': 'Non-binary', 'non-binary': 'Non-binary',
  'prefer_not_to_say': 'Prefer not to say', 'prefer-not-to-say': 'Prefer not to say',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bhutan','Bolivia',
  'Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia',
  'Cuba','Cyprus','Czech Republic','Denmark','Ecuador','Egypt','Estonia',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala',
  'Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Latvia',
  'Lebanon','Lithuania','Luxembourg','Malaysia','Maldives','Malta','Mexico',
  'Moldova','Mongolia','Morocco','Myanmar','Nepal','Netherlands','New Zealand',
  'Nigeria','North Korea','Norway','Oman','Pakistan','Palestine','Panama',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia',
  'Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','Somalia','South Africa',
  'South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Thailand','Turkey','Turkmenistan','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam','Yemen','Zimbabwe',
].sort();

type PickerModalProps = {
  visible: boolean; title: string; options: string[];
  selected: string; onSelect: (val: string) => void; onClose: () => void;
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
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '70%' },
  handle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  option: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionSelected: { backgroundColor: '#f0fdfa' },
  optionText: { fontSize: 15, color: '#0f172a' },
  optionTextSelected: { color: '#0d9488', fontWeight: '600' },
  cancelBtn: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});

export default function EditProfileScreen({ navigation }: any) {
  const { uploadPhoto, editProfile, refreshProfile } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const uploadLimits = useUploadLimits();

  const initialGender   = user?.gender   ? (GENDER_FROM_API[user.gender] ?? '') : '';
  const initialCountry  = user?.country  || '';
  const initialDob      = user?.dob      || '';
  const initialUsername = user?.username || '';

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      username: initialUsername,
      gender:   initialGender,
      country:  initialCountry,
      bio:      user?.bio || '',
      dob:      initialDob,
    },
  });

  // Local-preview URI — only set after user picks a new image from gallery
  const [localPreviewUri,    setLocalPreviewUri]    = useState<string>('');
  const [uploadingPhoto,     setUploadingPhoto]     = useState(false);
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);
  const [gender,             setGender]             = useState(initialGender);
  const [country,            setCountry]            = useState(initialCountry);
  const [dob]                                        = useState(initialDob);
  const [showGenderPicker,   setShowGenderPicker]   = useState(false);
  const [showCountryPicker,  setShowCountryPicker]  = useState(false);
  const [focusedField,       setFocusedField]       = useState<string | null>(null);
  const [apiError,           setApiError]           = useState<string | null>(null);
  const [usernameValue,      setUsernameValue]      = useState(initialUsername);

  // Reactive display URI:
  // • While user has picked a new image → show local file URI (instant feedback)
  // • Otherwise → read live from store (updates after refreshProfile resolves)
  const storePhotoUrl = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || null;
  const displayAvatarUri: string | null = localPreviewUri || storePhotoUrl;

  // Fetch fresh presigned URL on mount (presigned URLs expire after 1 hour)
  useEffect(() => { refreshProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (photoUploadSuccess) {
      const t = setTimeout(() => setPhotoUploadSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, [photoUploadSuccess]);

  function pickImage() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 1280, maxHeight: 1280 }, async (res) => {
      if (!res.assets?.[0]) return;
      const asset = res.assets[0];
      const fileUri  = asset.uri      ?? '';
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.type     ?? 'image/jpeg';

      if (!mimeType.startsWith('image/')) { setApiError('Only image files are allowed'); return; }
      const sizeError = rejectOversizedFile(asset.fileSize, uploadLimits.avatar.maxFileBytes);
      if (sizeError) {
        setApiError(sizeError);
        return;
      }

      setLocalPreviewUri(fileUri);
      setPhotoUploadSuccess(false);
      setUploadingPhoto(true);
      try {
        const cdnUrl = await uploadPhoto(fileUri, fileName, mimeType);
        if (cdnUrl) setPhotoUploadSuccess(true);
      } catch (err: any) {
        setLocalPreviewUri('');
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
        gender:   GENDER_TO_API[gender]  || undefined,
        country:  country                || undefined,
        bio:      data.bio               || undefined,
        dob:      dob                    || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      setApiError(err.response?.data?.message || err.response?.data?.error || 'Something went wrong.');
    }
  }

  const busy = isLoading || uploadingPhoto;

  return (
    <>
      <PickerModal
        visible={showGenderPicker} title="Select Gender" options={GENDERS} selected={gender}
        onSelect={(v) => { setGender(v); setValue('gender', v); setApiError(null); }}
        onClose={() => setShowGenderPicker(false)}
      />
      <PickerModal
        visible={showCountryPicker} title="Select Country" options={COUNTRIES} selected={country}
        onSelect={(v) => { setCountry(v); setValue('country', v); setApiError(null); }}
        onClose={() => setShowCountryPicker(false)}
      />

      <AppScreenLayout navigation={navigation} title="Edit Profile" onBack={() => navigation.goBack()}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.container, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <View style={styles.topBlock}>
              <Text style={styles.subtitle}>Update your personal information</Text>

              {/* Avatar */}
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={pickImage} activeOpacity={0.85} disabled={uploadingPhoto}>
                  <View style={styles.avatarOuter}>
                    <View style={styles.avatarInner}>
                      {displayAvatarUri ? (
                        <CachedImage
                          key={displayAvatarUri}
                          uri={displayAvatarUri}
                          style={styles.avatarImage}
                          resizeMode="cover"
                          priority="high"
                          onError={() => {
                            if (localPreviewUri) setLocalPreviewUri('');
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
            </View>

            {/* ── Full Name ── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name <Text style={styles.required}>*</Text></Text>
              <Controller
                control={control} name="fullName"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, focusedField === 'fullName' && styles.inputFocused, errors.fullName && styles.inputError]}
                    placeholder="e.g. Alex Johnson" placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(v) => { onChange(v); if (apiError) setApiError(null); }}
                    onFocus={() => setFocusedField('fullName')} onBlur={() => setFocusedField(null)}
                    underlineColorAndroid="transparent" selectionColor="#0d9488" editable={!busy}
                  />
                )}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}
            </View>

            {/* ── Username ── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Username <Text style={styles.required}>*</Text></Text>
              <Controller
                control={control} name="username"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, focusedField === 'username' && styles.inputFocused, errors.username && styles.inputError]}
                    placeholder="e.g. alex_gg" placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={(v) => { const lc = v.toLowerCase(); onChange(lc); setUsernameValue(lc); if (apiError) setApiError(null); }}
                    onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)}
                    underlineColorAndroid="transparent" selectionColor="#0d9488"
                    editable={!busy} autoCapitalize="none"
                  />
                )}
              />
              {!errors.username && (focusedField === 'username' || usernameValue)
                ? <Text style={styles.helperText}>Lowercase, numbers & underscores only</Text>
                : null}
              {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}
            </View>

            {/* ── Email (read-only) ── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.dobReadOnly}>
                <Text
                  style={user?.email ? styles.dobReadOnlyText : styles.dobReadOnlyPlaceholder}
                  numberOfLines={1}>
                  {user?.email || 'Not set'}
                </Text>
              </View>
            </View>

            {/* ── Date of Birth ── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <View style={styles.dobReadOnly}>
                <Text style={dob ? styles.dobReadOnlyText : styles.dobReadOnlyPlaceholder}>
                  {dob ? (() => { const dt = new Date(dob); return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })() : 'Not set'}
                </Text>
              </View>
            </View>

            {/* ── Gender + Country (2 columns) ── */}
            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.fieldLabel}>Gender <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, showGenderPicker && styles.inputFocused, errors.gender && styles.inputError]}
                  onPress={() => setShowGenderPicker(true)} activeOpacity={0.8} disabled={busy}>
                  <Text style={[styles.dropdownText, !gender && styles.dropdownPlaceholder]} numberOfLines={1}>
                    {gender || 'Select'}
                  </Text>
                  <ChevronDown />
                </TouchableOpacity>
                {errors.gender && <Text style={styles.errorText}>{errors.gender.message}</Text>}
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.fieldLabel}>Country <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, showCountryPicker && styles.inputFocused, errors.country && styles.inputError]}
                  onPress={() => setShowCountryPicker(true)} activeOpacity={0.8} disabled={busy}>
                  <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]} numberOfLines={1}>
                    {country || 'Select'}
                  </Text>
                  <ChevronDown />
                </TouchableOpacity>
                {errors.country && <Text style={styles.errorText}>{errors.country.message}</Text>}
              </View>
            </View>

            {/* ── Bio ── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bio <Text style={styles.optional}>(optional)</Text></Text>
              <Controller
                control={control} name="bio"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, styles.bioInput, focusedField === 'bio' && styles.inputFocused]}
                    placeholder="Adventurer, foodie, or slow traveler? Tell us your story..."
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onFocus={() => setFocusedField('bio')} onBlur={() => setFocusedField(null)}
                    multiline numberOfLines={3} maxLength={100}
                    textAlignVertical="top" underlineColorAndroid="transparent"
                    selectionColor="#0d9488" editable={!busy}
                    onChangeText={(v) => { onChange(v); if (apiError) setApiError(null); }}
                  />
                )}
              />
            </View>

            {/* ── Save ── */}
            <View style={styles.bottomBlock}>
              {apiError && <Text style={styles.apiErrorText}>{apiError}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={handleSubmit(onSubmit)} activeOpacity={0.85} disabled={busy}>
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </AppScreenLayout>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav:  { flex: 1 },
  scroll: { flex: 1 },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },

  // ── Top block ──────────────────────────────────────────────────────────────
  topBlock: { },
  subtitle: { fontSize: 13, color: '#45556C', textAlign: 'center', marginBottom: 4 },

  avatarSection: { alignItems: 'center', marginTop: 12 },
  avatarOuter:   { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(226,232,240,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarInner:   { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage:   { width: 84, height: 84, borderRadius: 42 },
  addBadge:      { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  addBadgeText:  { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 21, marginTop: -1 },
  photoHint:     { marginTop: 4, fontSize: 11, color: '#0d9488', fontWeight: '500' },

  // ── Fields — no marginBottom; parent space-between handles gaps ────────────
  field:       { },
  fieldLabel:  { fontSize: 12, fontWeight: '500', color: '#0F172B', marginBottom: 5 },
  required:    { color: '#ef4444', fontWeight: '500' },
  optional:    { fontSize: 11, fontWeight: '500', color: '#45556C' },
  dobReadOnly: { width: '100%', backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  dobReadOnlyText: { fontSize: 13, color: '#5b5e63' , },
  dobReadOnlyPlaceholder: { fontSize: 13, color: '#cbd5e1' },

  input: {
    width: '100%', backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: '#0f172a',
  },
  inputFocused:  { borderColor: '#0d9488' },
  inputError:    { borderColor: '#ef4444' },
  helperText:    { fontSize: 11, color: '#0d9488', marginTop: 4 },
  errorText:     { fontSize: 11, color: '#ef4444', marginTop: 4 },
  bioInput:      { height: 74, paddingTop: 10 },

  // 2-column row
  row:       { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  dropdownText:        { fontSize: 14, color: '#0f172a', flex: 1, marginRight: 4 },
  dropdownPlaceholder: { color: '#45556C' },

  // ── Bottom block ────────────────────────────────────────────────────────────
  bottomBlock:    { },
  apiErrorText:   { fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 8, fontWeight: '500' },
  primaryBtn:     { backgroundColor: '#0d9488', borderRadius: 8, paddingVertical: 13, alignItems: 'center', elevation: 2 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '400', letterSpacing: 0.1 },
});
