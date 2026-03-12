module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/index.js',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterSetup: [],
  verbose: true,
};
