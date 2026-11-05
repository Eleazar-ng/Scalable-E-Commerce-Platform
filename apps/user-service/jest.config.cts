module.exports = {
  displayName: 'user-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest', 
      { tsconfig: '<rootDir>/tsconfig.spec.json', useESM: true }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/user-service',
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs|rxjs|@godaddy/terminus))',
    "node_modules/(?!jose)"
  ],
};
