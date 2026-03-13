import React, { useState, useEffect } from 'react';
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
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema } from '../../utils/validators';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

type FormData = {
  fullName: string;
  dob?: string;
  gender?: string;
  country?: string;
  bio?: string;
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

function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#94a3b8"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateProfileScreen({ navigation }: any) {
  const { control, handleSubmit, setValue } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
  });

  const [avatar, setAvatar] = useState<{ uri: string; fileName: string; type: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { uploadPhoto, saveProfile } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  // Pre-fill if editing
  useEffect(() => {
    if (user) {
      if (user.fullName) setValue('fullName', user.fullName);
      if (user.dob) {
        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [y, m, d] = user.dob.split('-');
        if (y && m && d) setValue('dob', `${d}/${m}/${y}`);
      }
      if (user.gender) {
        const g = user.gender.charAt(0).toUpperCase() + user.gender.slice(1);
        setGender(g);
        setValue('gender', g);
      }
      if (user.country) {
        setCountry(user.country);
        setValue('country', user.country);
      }
      if (user.bio) {
        setValue('bio', user.bio);
      }
      if (user.photoUrl) {
        setAvatar({ uri: user.photoUrl, fileName: 'avatar.jpg', type: 'image/jpeg' });
      }
    }
  }, [user, setValue]);

  // ─── Step A: Pick & upload photo ─────────────────────────────────────────
  function pickImage() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (res) => {
      if (!res.assets || !res.assets[0]) return;

      const asset = res.assets[0];
      const fileUri = asset.uri ?? '';
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mimeType = asset.type ?? 'image/jpeg';

      // Preview immediately
      setAvatar({ uri: fileUri, fileName, type: mimeType });

      // Upload to S3 via the backend
      setUploadingPhoto(true);
      try {
        const cdnUrl = await uploadPhoto(fileUri, fileName, mimeType);
        console.log('[Upload Success]: Photo URL:', cdnUrl);
        // Update avatar URI to the CDN url returned
        setAvatar({ uri: cdnUrl, fileName, type: mimeType });
      } catch (err) {
        console.error('[Upload Error]:', err);
        // Revert preview on failure
        setAvatar(null);
      } finally {
        setUploadingPhoto(false);
      }
    });
  }

  // ─── Step B: Save profile details ────────────────────────────────────────
  async function onSubmit(data: FormData) {
    try {
      setApiError(null);
      let dob = data.dob;
      if (dob && dob.length === 10) {
        const [dd, mm, yyyy] = dob.split('/');
        if (dd && mm && yyyy) dob = `${yyyy}-${mm}-${dd}`;
      }

      await saveProfile({
        fullName: data.fullName,
        dob,
        gender: gender.toLowerCase().replace(/ /g, '-') || undefined,
        country: country || undefined,
        bio: data.bio || undefined,
      });

      console.log('[Save Success]: Profile updated for user.');
      navigation.replace('Home');
    } catch (err: any) {
      console.error('[Save Profile Error]:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong. Please try again.';
      setApiError(msg);
    }
  }

  // Format dob as DD/MM/YYYY while typing
  function handleDobChange(onChange: (val: string) => void, text: string) {
    const nums = text.replace(/\D/g, '');
    let formatted = nums;
    if (nums.length > 2 && nums.length <= 4) formatted = `${nums.slice(0, 2)}/${nums.slice(2)}`;
    else if (nums.length > 4) formatted = `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
    onChange(formatted);
  }

  function onDateChange(event: any, selectedDate?: Date) {
    setShowDatePicker(false);
    if (selectedDate) {
      const d = selectedDate.getDate().toString().padStart(2, '0');
      const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const y = selectedDate.getFullYear();
      setValue('dob', `${d}/${m}/${y}`, { shouldValidate: true });
      if (apiError) setApiError(null);
    }
  }

  const busy = isLoading || uploadingPhoto;

  return (
    <BlobBackground>
      {/* Gender picker modal */}
      <PickerModal
        visible={showGenderPicker}
        title="Select Gender"
        options={GENDERS}
        selected={gender}
        onSelect={(val) => { setGender(val); setValue('gender', val); }}
        onClose={() => setShowGenderPicker(false)}
      />

      {/* Country picker modal */}
      <PickerModal
        visible={showCountryPicker}
        title="Select Country"
        options={COUNTRIES}
        selected={country}
        onSelect={(val) => { setCountry(val); setValue('country', val); }}
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
                      <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
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
              {avatar && !uploadingPhoto && (
                <Text style={styles.photoHint}>Photo uploaded ✓</Text>
              )}
            </View>

            {/* Full Name */}
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'fullName' && styles.inputFocused,
                  ]}
                  placeholder="Full Name"
                  placeholderTextColor="#94a3b8"
                  value={value}
                  onChangeText={(val) => {
                    onChange(val);
                    if (apiError) setApiError(null);
                  }}
                  onFocus={() => setFocusedField('fullName')}
                  onBlur={() => setFocusedField(null)}
                  underlineColorAndroid="transparent"
                  selectionColor="#0d9488"
                  editable={!busy}
                />
              )}
            />

            <Controller
              control={control}
              name="dob"
              render={({ field: { value } }) => (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                  disabled={busy}
                  style={[
                    styles.dropdownBtn,
                    showDatePicker && styles.inputFocused,
                  ]}>
                  <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
                    {value || 'Date of Birth (DD/MM/YYYY)'}
                  </Text>
                  <CalendarIcon />
                </TouchableOpacity>
              )}
            />

            {showDatePicker && (
              <DateTimePicker
                value={(() => {
                  const val = control._formValues.dob;
                  if (val && val.length === 10) {
                    const [d, m, y] = val.split('/');
                    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  }
                  return new Date();
                })()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}


            {/* Gender */}
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                showGenderPicker && styles.inputFocused,
              ]}
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
              style={[
                styles.dropdownBtn,
                showCountryPicker && styles.inputFocused,
              ]}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.8}
              disabled={busy}>
              <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                {country || 'Select Country'}
              </Text>
              <ChevronDown />
            </TouchableOpacity>

            <Controller
              control={control}
              name="bio"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    styles.bioInput,
                    focusedField === 'bio' && styles.inputFocused,
                  ]}
                  placeholder="Tell us a bit about yourself and your travel style..."
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
                  onChangeText={(val) => {
                    onChange(val);
                    if (apiError) setApiError(null);
                  }}
                />
              )}
            />

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
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, zIndex: 10 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100, // Extra padding for bio and scroll
  },
  logoRow: { marginBottom: 56 },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: 28,
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
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -1,
  },
  photoHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '500',
  },

  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 10,
  },
  inputFocused: {
    borderColor: '#0d9488',
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
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
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
