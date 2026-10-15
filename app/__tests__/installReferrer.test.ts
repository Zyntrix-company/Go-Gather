import { parseInstallReferrer } from '../src/utils/installReferrer';

// The module under test imports pendingInviteStore, which persists via AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const TOKEN = '3f2b8c1e-9a47-4d6e-b1f0-5c7a2e9d4b10';

describe('parseInstallReferrer', () => {
  it('parses the raw referrer Play hands back', () => {
    expect(parseInstallReferrer(`invite=friend/${TOKEN}`)).toEqual({ type: 'friend', token: TOKEN });
  });

  it('parses a value that is still percent-encoded', () => {
    expect(parseInstallReferrer(`invite=event%2F${TOKEN}`)).toEqual({ type: 'event', token: TOKEN });
  });

  it('finds the invite among other referrer params', () => {
    expect(parseInstallReferrer(`utm_source=google-play&invite=trip/${TOKEN}&utm_medium=organic`)).toEqual({
      type: 'trip',
      token: TOKEN,
    });
  });

  it('returns null when there is nothing to act on', () => {
    expect(parseInstallReferrer(null)).toBeNull();
    expect(parseInstallReferrer('')).toBeNull();
    expect(parseInstallReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
  });

  it('rejects unknown types and malformed tokens', () => {
    expect(parseInstallReferrer(`invite=group/${TOKEN}`)).toBeNull();
    expect(parseInstallReferrer('invite=friend/')).toBeNull();
    expect(parseInstallReferrer('invite=friend/../../etc')).toBeNull();
    expect(parseInstallReferrer('invite=%E0%A4%A')).toBeNull();
  });
});
