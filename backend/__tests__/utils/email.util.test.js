const {
  sanitizeAuthEmail,
  normalizeAuthEmail,
  resolveAuthEmail,
} = require('../../src/utils/email.util');

describe('email.util', () => {
  describe('sanitizeAuthEmail', () => {
    it('lowercases and trims without removing Gmail dots', () => {
      expect(sanitizeAuthEmail('  Vanshahuja.Dev@gmail.com  ')).toBe('vanshahuja.dev@gmail.com');
    });

    it('preserves plus-address tags', () => {
      expect(sanitizeAuthEmail('user+tag@gmail.com')).toBe('user+tag@gmail.com');
    });
  });

  describe('normalizeAuthEmail', () => {
    it('removes Gmail dots and subaddresses for duplicate detection', () => {
      expect(normalizeAuthEmail('john.doe+tag@gmail.com')).toBe('johndoe@gmail.com');
      expect(normalizeAuthEmail('vanshahuja.dev@gmail.com')).toBe('vanshahujadev@gmail.com');
    });
  });

  describe('resolveAuthEmail', () => {
    it('keeps display and normalized separate', () => {
      expect(resolveAuthEmail('vanshahuja.dev@gmail.com')).toEqual({
        display: 'vanshahuja.dev@gmail.com',
        normalized: 'vanshahujadev@gmail.com',
      });
    });

    it('does not merge different Gmail local parts', () => {
      expect(resolveAuthEmail('vansahuja.dev@gmail.com')?.normalized).toBe('vansahujadev@gmail.com');
      expect(resolveAuthEmail('vanshahujadev@gmail.com')?.normalized).toBe('vanshahujadev@gmail.com');
    });
  });
});
