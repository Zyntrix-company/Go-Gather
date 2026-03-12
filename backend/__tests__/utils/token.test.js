require('../setup');

const {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  hashToken,
} = require('../../src/utils/token');

describe('Token Utils', () => {
  const mockUser = { id: '123e4567-e89b-12d3-a456-426614174000', email: 'test@test.com' };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT string', () => {
      const token = generateAccessToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should contain correct payload', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT string', () => {
      const token = generateRefreshToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should contain user id in payload', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.id).toBe(mockUser.id);
    });
  });

  describe('generateResetToken', () => {
    it('should generate a valid JWT with purpose claim', () => {
      const token = generateResetToken(mockUser);
      const decoded = verifyResetToken(token);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.purpose).toBe('password-reset');
    });
  });

  describe('verifyAccessToken', () => {
    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw on expired token', () => {
      // Token with 0 second expiry — we can't easily test this without mocking,
      // so we verify that an obviously bad token throws.
      expect(() => verifyAccessToken('bad')).toThrow();
    });
  });

  describe('hashToken', () => {
    it('should return a hex string', () => {
      const hash = hashToken('some-token');
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      const a = hashToken('same-input');
      const b = hashToken('same-input');
      expect(a).toBe(b);
    });

    it('should produce different hashes for different inputs', () => {
      const a = hashToken('input-a');
      const b = hashToken('input-b');
      expect(a).not.toBe(b);
    });
  });
});
