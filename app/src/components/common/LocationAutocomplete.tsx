import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type TextStyle,
} from 'react-native';

const GOOGLE_PLACES_KEY = 'AIzaSyAsbr3dMzYaenHLCmrHD-gTYo5cZ_aZ6YA';
const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;
const MAX_SUGGESTIONS = 6;

type Prediction = {
  place_id: string;
  description: string;
};

interface Props {
  initialValue?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  variant?: 'create' | 'edit';
}

async function fetchPredictions(input: string): Promise<Prediction[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}` +
    `&key=${GOOGLE_PLACES_KEY}` +
    `&language=en`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    return [];
  }
  return (json.predictions ?? []).slice(0, MAX_SUGGESTIONS);
}

export default function LocationAutocomplete({
  initialValue = '',
  onChangeText,
  placeholder = 'Search location...',
  variant = 'create',
}: Props) {
  const [text, setText] = useState(initialValue);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setText(initialValue || '');
  }, [initialValue]);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => () => clearDebounce(), [clearDebounce]);

  const runSearch = useCallback(
    (query: string) => {
      clearDebounce();
      if (query.trim().length < MIN_QUERY_LEN) {
        setPredictions([]);
        setLoading(false);
        setOpen(false);
        return;
      }

      setLoading(true);
      setOpen(true);
      const requestId = ++requestIdRef.current;

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await fetchPredictions(query.trim());
          if (requestIdRef.current !== requestId) return;
          setPredictions(results);
          setOpen(results.length > 0);
        } catch {
          if (requestIdRef.current !== requestId) return;
          setPredictions([]);
          setOpen(false);
        } finally {
          if (requestIdRef.current === requestId) setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [clearDebounce],
  );

  const handleChange = (value: string) => {
    setText(value);
    onChangeText(value);
    runSearch(value);
  };

  const handleSelect = (description: string) => {
    clearDebounce();
    requestIdRef.current += 1;
    setText(description);
    onChangeText(description);
    setPredictions([]);
    setOpen(false);
    setLoading(false);
  };

  const isEdit = variant === 'edit';
  const inputWrapStyle = isEdit ? styles.textInputContainerEdit : styles.textInputContainerCreate;

  return (
    <View style={styles.root}>
      <View style={inputWrapStyle}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={text}
          onChangeText={handleChange}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 180);
          }}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#0d9488" style={styles.spinner} />
        ) : null}
      </View>

      {open && predictions.length > 0 ? (
        <View style={isEdit ? styles.listViewInline : styles.listView}>
          {predictions.map((item, index) => (
            <React.Fragment key={item.place_id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => handleSelect(item.description)}
              >
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  textInputContainerCreate: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInputContainerEdit: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    height: 42,
  } as TextStyle,
  spinner: {
    marginRight: 10,
  },
  listView: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 1001,
    elevation: 1001,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  listViewInline: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
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
});
