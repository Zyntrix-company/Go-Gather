import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_WELCOME_SEEN_KEY = '@GatherGo/auth_welcome_seen';

export async function getAuthWelcomeSeen(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(AUTH_WELCOME_SEEN_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

/** Call after the user engages with the marketing welcome (first-time gate). */
export async function setAuthWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_WELCOME_SEEN_KEY, 'true');
  } catch {
    // non-fatal
  }
}
