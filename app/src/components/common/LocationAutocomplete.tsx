import React, { useEffect, useRef } from 'react';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const GOOGLE_PLACES_KEY = 'AIzaSyAsbr3dMzYaenHLCmrHD-gTYo5cZ_aZ6YA';

interface Props {
  initialValue?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  variant?: 'create' | 'edit';
}

export default function LocationAutocomplete({
  initialValue = '',
  onChangeText,
  placeholder = 'Search location...',
  variant = 'create',
}: Props) {
  const ref = useRef<any>(null);

  useEffect(() => {
    ref.current?.setAddressText(initialValue || '');
  }, [initialValue]);

  const isEdit = variant === 'edit';

  return (
    <GooglePlacesAutocomplete
      ref={ref}
      placeholder={placeholder}
      onPress={(data) => {
        onChangeText(data.description);
      }}
      query={{ key: GOOGLE_PLACES_KEY, language: 'en' }}
      textInputProps={{
        onChangeText,
        placeholderTextColor: '#94a3b8',
      }}
      styles={{
        container: { flex: 0, zIndex: 1000, elevation: 1000 },
        textInputContainer: isEdit
          ? {
              backgroundColor: '#f8fafc',
              borderWidth: 1.5,
              borderColor: '#e2e8f0',
              borderRadius: 10,
            }
          : {
              borderWidth: 2,
              borderColor: '#e2e8f0',
              borderRadius: 12,
              backgroundColor: 'transparent',
            },
        textInput: {
          fontSize: 13,
          color: '#0f172a',
          backgroundColor: 'transparent',
          marginBottom: 0,
          paddingHorizontal: 12,
          height: 42,
        },
        listView: {
          position: 'absolute',
          top: 48,
          left: 0,
          right: 0,
          zIndex: 1000,
          elevation: 1000,
          backgroundColor: '#fff',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        row: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: '#fff',
        },
        description: {
          fontSize: 13,
          color: '#0f172a',
        },
        separator: {
          height: 1,
          backgroundColor: '#f1f5f9',
          marginHorizontal: 14,
        },
      }}
      fetchDetails={false}
      enablePoweredByContainer={false}
      debounce={300}
      minLength={2}
      keepResultsAfterBlur={false}
      keyboardShouldPersistTaps="always"
      flatListProps={{ scrollEnabled: false, nestedScrollEnabled: false }}
    />
  );
}
