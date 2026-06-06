const { normalizeAuthEmail } = require('../../src/utils/email.util');

describe('normalizeAuthEmail', () => {
  it('lowercases and trims email', () => {
    expect(normalizeAuthEmail('  Test@Example.COM  ')).toBe('test@example.com');
  });

  it('removes Gmail dots and subaddresses', () => {
    expect(normalizeAuthEmail('john.doe+tag@gmail.com')).toBe('johndoe@gmail.com');
    expect(normalizeAuthEmail('vansahuja.dev@gmail.com')).toBe('vansahujadev@gmail.com');
  });

  it('converts googlemail.com to gmail.com', () => {
    expect(normalizeAuthEmail('user@googlemail.com')).toBe('user@gmail.com');
  });

  it('does not merge different Gmail local parts', () => {
    expect(normalizeAuthEmail('vanshahujadev@gmail.com')).toBe('vanshahujadev@gmail.com');
    expect(normalizeAuthEmail('vansahuja.dev@gmail.com')).toBe('vansahujadev@gmail.com');
    expect(normalizeAuthEmail('vanshahujadev@gmail.com')).not.toBe(
      normalizeAuthEmail('vansahuja.dev@gmail.com'),
    );
  });

  it('returns null for invalid input', () => {
    expect(normalizeAuthEmail('')).toBeNull();
    expect(normalizeAuthEmail(null)).toBeNull();
    expect(normalizeAuthEmail('not-an-email')).toBeNull();
  });
});
