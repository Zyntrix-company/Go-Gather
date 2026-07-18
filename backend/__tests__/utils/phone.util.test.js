const { phoneKey } = require('../../src/utils/phone.util');

// The key must stay identical to the phone_key generated column (migration 061).
// If these two ever drift, invites silently stop matching their invitee.
describe('phoneKey', () => {
  it('collapses every format the same number arrives in to one key', () => {
    const sameNumber = [
      '+91 98765 43210', // contact picker, country code + spaces
      '098765-43210', // local form with trunk prefix
      '9876543210', // typed at signup
      '+919876543210', // E.164
      '(98765) 43210', // parenthesised
    ];
    const keys = new Set(sameNumber.map(phoneKey));
    expect([...keys]).toEqual(['9876543210']);
  });

  it('does not collide two genuinely different numbers', () => {
    expect(phoneKey('+91 98765 43210')).not.toBe(phoneKey('+91 98765 43211'));
  });

  it('returns null for input that carries no number', () => {
    expect(phoneKey(null)).toBeNull();
    expect(phoneKey(undefined)).toBeNull();
    expect(phoneKey('')).toBeNull();
    expect(phoneKey('not a phone')).toBeNull();
  });

  it('keeps short numbers intact rather than padding them', () => {
    expect(phoneKey('12345')).toBe('12345');
  });
});
