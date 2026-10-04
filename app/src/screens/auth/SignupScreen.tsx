import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { KeyboardAvoider } from '../../components/common/KeyboardAvoider';
import LegalModal from '../../components/common/LegalModal';
import Svg, { Path } from 'react-native-svg';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '../../utils/validators';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppleSignInButton from '../../components/common/AppleSignInButton';
import colors from '../../theme/colors';

type FormData = {
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

// ─── Full Country Code List (from Figma reference SignUp.tsx) ───────────────
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: '+7', country: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: '+20', country: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+30', country: 'GR', flag: '🇬🇷', name: 'Greece' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+36', country: 'HU', flag: '🇭🇺', name: 'Hungary' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+40', country: 'RO', flag: '🇷🇴', name: 'Romania' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', country: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+45', country: 'DK', flag: '🇩🇰', name: 'Denmark' },
  { code: '+46', country: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47', country: 'NO', flag: '🇳🇴', name: 'Norway' },
  { code: '+48', country: 'PL', flag: '🇵🇱', name: 'Poland' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+51', country: 'PE', flag: '🇵🇪', name: 'Peru' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+58', country: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+60', country: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+62', country: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63', country: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: '+64', country: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+66', country: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+84', country: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+90', country: 'TR', flag: '🇹🇷', name: 'Turkey' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+92', country: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+93', country: 'AF', flag: '🇦🇫', name: 'Afghanistan' },
  { code: '+94', country: 'LK', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+95', country: 'MM', flag: '🇲🇲', name: 'Myanmar' },
  { code: '+98', country: 'IR', flag: '🇮🇷', name: 'Iran' },
  { code: '+212', country: 'MA', flag: '🇲🇦', name: 'Morocco' },
  { code: '+213', country: 'DZ', flag: '🇩🇿', name: 'Algeria' },
  { code: '+216', country: 'TN', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+218', country: 'LY', flag: '🇱🇾', name: 'Libya' },
  { code: '+220', country: 'GM', flag: '🇬🇲', name: 'Gambia' },
  { code: '+221', country: 'SN', flag: '🇸🇳', name: 'Senegal' },
  { code: '+233', country: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+237', country: 'CM', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+249', country: 'SD', flag: '🇸🇩', name: 'Sudan' },
  { code: '+250', country: 'RW', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+251', country: 'ET', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '+254', country: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: '+255', country: 'TZ', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+256', country: 'UG', flag: '🇺🇬', name: 'Uganda' },
  { code: '+263', country: 'ZW', flag: '🇿🇼', name: 'Zimbabwe' },
  { code: '+264', country: 'NA', flag: '🇳🇦', name: 'Namibia' },
  { code: '+350', country: 'GI', flag: '🇬🇮', name: 'Gibraltar' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+352', country: 'LU', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+353', country: 'IE', flag: '🇮🇪', name: 'Ireland' },
  { code: '+354', country: 'IS', flag: '🇮🇸', name: 'Iceland' },
  { code: '+355', country: 'AL', flag: '🇦🇱', name: 'Albania' },
  { code: '+356', country: 'MT', flag: '🇲🇹', name: 'Malta' },
  { code: '+357', country: 'CY', flag: '🇨🇾', name: 'Cyprus' },
  { code: '+358', country: 'FI', flag: '🇫🇮', name: 'Finland' },
  { code: '+359', country: 'BG', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+370', country: 'LT', flag: '🇱🇹', name: 'Lithuania' },
  { code: '+371', country: 'LV', flag: '🇱🇻', name: 'Latvia' },
  { code: '+372', country: 'EE', flag: '🇪🇪', name: 'Estonia' },
  { code: '+373', country: 'MD', flag: '🇲🇩', name: 'Moldova' },
  { code: '+374', country: 'AM', flag: '🇦🇲', name: 'Armenia' },
  { code: '+375', country: 'BY', flag: '🇧🇾', name: 'Belarus' },
  { code: '+376', country: 'AD', flag: '🇦🇩', name: 'Andorra' },
  { code: '+380', country: 'UA', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+381', country: 'RS', flag: '🇷🇸', name: 'Serbia' },
  { code: '+385', country: 'HR', flag: '🇭🇷', name: 'Croatia' },
  { code: '+386', country: 'SI', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+387', country: 'BA', flag: '🇧🇦', name: 'Bosnia & Herzegovina' },
  { code: '+420', country: 'CZ', flag: '🇨🇿', name: 'Czech Republic' },
  { code: '+421', country: 'SK', flag: '🇸🇰', name: 'Slovakia' },
  { code: '+502', country: 'GT', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+506', country: 'CR', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+591', country: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+593', country: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+595', country: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', country: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+673', country: 'BN', flag: '🇧🇳', name: 'Brunei' },
  { code: '+855', country: 'KH', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+880', country: 'BD', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+960', country: 'MV', flag: '🇲🇻', name: 'Maldives' },
  { code: '+961', country: 'LB', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+962', country: 'JO', flag: '🇯🇴', name: 'Jordan' },
  { code: '+963', country: 'SY', flag: '🇸🇾', name: 'Syria' },
  { code: '+964', country: 'IQ', flag: '🇮🇶', name: 'Iraq' },
  { code: '+965', country: 'KW', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+968', country: 'OM', flag: '🇴🇲', name: 'Oman' },
  { code: '+970', country: 'PS', flag: '🇵🇸', name: 'Palestine' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+972', country: 'IL', flag: '🇮🇱', name: 'Israel' },
  { code: '+973', country: 'BH', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+974', country: 'QA', flag: '🇶🇦', name: 'Qatar' },
  { code: '+975', country: 'BT', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+977', country: 'NP', flag: '🇳🇵', name: 'Nepal' },
  { code: '+992', country: 'TJ', flag: '🇹🇯', name: 'Tajikistan' },
  { code: '+993', country: 'TM', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: '+994', country: 'AZ', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: '+995', country: 'GE', flag: '🇬🇪', name: 'Georgia' },
  { code: '+996', country: 'KG', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+998', country: 'UZ', flag: '🇺🇿', name: 'Uzbekistan' },
];

// ─── SVG Icons ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </Svg>
  );
}

function EyeOffIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
    </Svg>
  );
}

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// ─── Country Code Picker Modal ────────────────────────────────────────────────
type CountryCodeItem = typeof COUNTRY_CODES[0];

function CountryCodeModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: CountryCodeItem;
  onSelect: (item: CountryCodeItem) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <SafeAreaView style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Select Country Code</Text>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item, i) => `${item.country}-${i}`}
            renderItem={({ item }) => {
              const isSelected = item.country === selected.country && item.code === selected.code;
              return (
                <TouchableOpacity
                  style={[modalStyles.option, isSelected && modalStyles.optionSelected]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}>
                  <Text style={modalStyles.optionFlag}>{item.flag}</Text>
                  <Text style={[modalStyles.optionName, isSelected && modalStyles.optionNameSelected]}>
                    {item.name}
                  </Text>
                  <Text style={[modalStyles.optionCode, isSelected && modalStyles.optionCodeSelected]}>
                    {item.code}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    maxHeight: '75%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 10 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  optionSelected: { backgroundColor: '#f0fdfa' },
  optionFlag: { fontSize: 20, width: 28 },
  optionName: { flex: 1, fontSize: 15, color: '#0f172a' },
  optionNameSelected: { color: '#0d9488', fontWeight: '600' },
  optionCode: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  optionCodeSelected: { color: '#0d9488', fontWeight: '600' },
  cancelBtn: { marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SignupScreen({ navigation }: any) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES.find(c => c.country === 'IN')!);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(signupSchema) });
  const { signup, googleLogin } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const isLoading = useAuthStore((s) => s.isLoading);

  function handleLoginNavigation(user: any) {
    if (user.isVerified === false) {
      return navigation.replace('OtpVerification', { email: user.email });
    }
    // RootNavigator handles routing to ProfileSetupNavigator when isProfileComplete===false
  }

  async function onSubmit(data: FormData) {
    try {
      setApiError(null);
      // Combine country code + phone number before sending
      const fullPhone = data.phone
        ? `${selectedCountry.code}${data.phone.replace(/^0+/, '')}`
        : undefined;

      await signup(data.email, fullPhone, data.password);
      // On success, backend sends OTP to email → navigate to OTP screen
      navigation.navigate('OtpVerification', { email: data.email, source: 'signup' });
    } catch (err: any) {
      console.error('[Signup Error]:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong. Please try again.';
      setApiError(msg);
    }
  }

  async function onGoogleButtonPress() {
    try {
      setApiError(null);
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (idToken) {
        const res = await googleLogin(idToken);
        // Try extracting DOB from Google People API (best-effort, silent fail)
        try {
          const tokens = await GoogleSignin.getTokens();
          if (tokens.accessToken) {
            const peopleRes = await fetch(
              'https://people.googleapis.com/v1/people/me?personFields=birthdays',
              { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            );
            const peopleData = await peopleRes.json();
            const bday = peopleData?.birthdays?.[0]?.date;
            if (bday?.year && bday?.month && bday?.day) {
              const dob = `${bday.year}-${String(bday.month).padStart(2, '0')}-${String(bday.day).padStart(2, '0')}`;
              useAuthStore.getState().updateUser({ dob });
            }
          }
        } catch { /* DOB is optional */ }
        console.log('[Google Login Success]:', res.user?.email);
        handleLoginNavigation(res.user);
      }
    } catch (error: any) {
      console.error('[Google Login Error]:', error);
      if (error.code !== 'SIGN_IN_CANCELLED') {
        setApiError('Google sign in failed.');
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlobBackground>
        {/* Country Code Modal */}
        <CountryCodeModal
          visible={showCountryPicker}
          selected={selectedCountry}
          onSelect={setSelectedCountry}
          onClose={() => setShowCountryPicker(false)}
        />

        {/* Legal Modals */}
        <LegalModal
          visible={legalModal === 'terms'}
          type="terms"
          onClose={() => setLegalModal(null)}
        />
        <LegalModal
          visible={legalModal === 'privacy'}
          type="privacy"
          onClose={() => setLegalModal(null)}
        />

        <KeyboardAvoider style={styles.kav}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

          {/* Logo top-left */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="default" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Create Account</Text>

            {/* Google */}
            <TouchableOpacity 
              style={styles.socialBtn} 
              activeOpacity={0.75} 
              onPress={onGoogleButtonPress}
              disabled={isLoading}>
              <GoogleIcon />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Apple — iOS only (renders nothing on Android) */}
            <AppleSignInButton
              style={[styles.socialBtn, styles.socialBtnGap]}
              textStyle={styles.socialBtnText}
              disabled={isLoading}
              onSuccess={(user) => { setApiError(null); handleLoginNavigation(user); }}
              onError={setApiError}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === 'email' && styles.inputFocused,
                      errors.email && styles.inputError,
                    ]}
                    placeholder="Email address *"
                    placeholderTextColor="#94a3b8"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    selectionColor={colors.accent}
                    underlineColorAndroid="transparent"
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email.message}</Text>
                  )}
                </>
              )}
            />

            {/* Phone with country code picker */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <>
                  <View style={styles.phoneRow}>
                    {/* Country code badge – tappable */}
                    <TouchableOpacity
                      style={styles.countryCodeBtn}
                      onPress={() => setShowCountryPicker(true)}
                      activeOpacity={0.8}>
                      <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                      <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                      <ChevronDown />
                    </TouchableOpacity>
                    <TextInput
                      style={[
                        styles.phoneInput,
                        focusedField === 'phone' && styles.inputFocused,
                        errors.phone && styles.inputError,
                      ]}
                      placeholder="Phone number"
                      placeholderTextColor="#94a3b8"
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                      underlineColorAndroid="transparent"
                      selectionColor="#0d9488"
                    />
                  </View>
                  {errors.phone && (
                    <Text style={styles.errorText}>{errors.phone.message}</Text>
                  )}
                </>
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <>
                  <View style={[
                    styles.passwordWrap,
                    focusedField === 'password' && styles.inputFocused,
                    errors.password && styles.inputError,
                  ]}>
                    <TextInput
                      style={styles.passwordField}
                      placeholder="Password *"
                      placeholderTextColor="#94a3b8"
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      underlineColorAndroid="transparent"
                      selectionColor="#0d9488"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text style={styles.errorText}>{errors.password.message}</Text>
                  )}
                  {/* Password strength hints */}
                  {!!value && (
                    <View style={styles.strengthContainer}>
                      {[
                        { label: 'At least 8 characters', ok: value.length >= 8 },
                        { label: 'Uppercase letter (A-Z)', ok: /[A-Z]/.test(value) },
                        { label: 'Lowercase letter (a-z)', ok: /[a-z]/.test(value) },
                        { label: 'Number (0-9)', ok: /[0-9]/.test(value) },
                        { label: 'Special character (!@#$%)', ok: /[^A-Za-z0-9]/.test(value) },
                      ].map((c, i) => (
                        <View key={i} style={styles.strengthRow}>
                          <Text style={[styles.strengthBullet, c.ok && styles.strengthBulletOk]}>
                            {c.ok ? '✓' : '○'}
                          </Text>
                          <Text style={[styles.strengthLabel, c.ok && styles.strengthLabelOk]}>
                            {c.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            />

            {/* Confirm Password */}
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value } }) => (
                <>
                  <View style={[
                    styles.passwordWrap,
                    focusedField === 'confirmPassword' && styles.inputFocused,
                    errors.confirmPassword && styles.inputError,
                  ]}>
                    <TextInput
                      style={styles.passwordField}
                      placeholder="Confirm Password *"
                      placeholderTextColor="#94a3b8"
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showConfirmPassword}
                      underlineColorAndroid="transparent"
                      selectionColor="#0d9488"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      activeOpacity={0.7}>
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
                  )}
                </>
              )}
            />

            {/* API Error Message */}
            {apiError && (
              <Text style={styles.apiErrorText}>{apiError}</Text>
            )}

            {/* Continue */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Continue</Text>}
            </TouchableOpacity>

            {/* Already have account */}
            <View style={styles.linkRow}>
              <Text style={styles.linkPlain}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.linkUnderline}>Log in</Text>
              </TouchableOpacity>
            </View>

            {/* Terms & Privacy */}
            <View style={[styles.linkRow, { marginTop: 8, flexWrap: 'wrap' }]}>
              <Text style={styles.termsPlain}>By signing up, you agree to our </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setLegalModal('terms')}>
                <Text style={styles.termsLink}>Terms &amp; Conditions</Text>
              </TouchableOpacity>
              <Text style={styles.termsPlain}> and </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setLegalModal('privacy')}>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoider>
      </BlobBackground>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  kav: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SCREEN_W < 375 ? 16 : 24, paddingTop: SCREEN_W < 375 ? 12 : 16, paddingBottom: SCREEN_W < 375 ? 24 : 32 },

  logoRow: { marginBottom: 60, alignItems: 'flex-start' },

  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: SCREEN_W < 375 ? 21 : 25,
    fontWeight: '400',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 34,
  },

  // social buttons — rounded-lg
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  socialBtnGap: { marginTop: 8 },
  socialBtnText: { fontSize: 16, color: '#334155', fontWeight: '400' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 16, color: '#94a3b8' },

  // Inputs
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: SCREEN_W < 375 ? 14 : 16,
    color: '#0f172a',
    marginTop: 9,
  },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 2,
  },
  apiErrorText: {
    fontSize: 11,
    color: '#ef4444',
    textAlign: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  countryCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 9,
    gap: 4,
  },
  countryFlag: { fontSize: 14 },
  countryCodeText: { fontSize: 13, color: '#0f172a', fontWeight: '500' },
  phoneInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: SCREEN_W < 375 ? 14 : 16,
    color: '#0f172a',
  },

  passwordWrap: {
    position: 'relative',
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  passwordField: {
    width: '100%',
    paddingHorizontal: 11,
    paddingVertical: 9,
    paddingRight: 44,
    fontSize: SCREEN_W < 375 ? 14 : 16,
    color: '#0f172a',
  },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', padding: 1 },

  // Password strength indicator
  strengthContainer: { marginTop: 8, marginBottom: 4, paddingHorizontal: 2 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  strengthBullet: { fontSize: 12, color: '#94a3b8', width: 18 },
  strengthBulletOk: { color: '#0d9488' },
  strengthLabel: { fontSize: 12, color: '#94a3b8' },
  strengthLabelOk: { color: '#0d9488' },

  // primary CTA — rounded-lg
  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
  },
  primaryBtnText: { color: '#ffffff', fontSize: SCREEN_W < 375 ? 15 : 17, fontWeight: '400', letterSpacing: 0.1 },

  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  linkPlain: { fontSize: SCREEN_W < 375 ? 11 : 13, color: '#64748b' },
  linkUnderline: { fontSize: SCREEN_W < 375 ? 14 : 17, color: '#0d9488', fontWeight: '500', textDecorationLine: 'underline' },
  termsPlain: { fontSize: SCREEN_W < 375 ? 10 : 12, color: '#64748b' },
  termsLink: { fontSize: SCREEN_W < 375 ? 11 : 13, color: '#0d9488', textDecorationLine: 'underline' },

  linkDivider: { marginVertical: 6, alignItems: 'center' },
  linkDividerLine: {
    width: '60%',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
});
