/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '\\.spec\\.ts$',
  // `marked` v16+ es ESM-only (sin condición "require" en su exports map) —
  // cualquier test que cargue PdfService (y por tanto a `marked`) rompe
  // Jest en CommonJS. Redirigido a un shim propio, ver test-support/marked.mock.js.
  moduleNameMapper: {
    '^marked$': '<rootDir>/test-support/marked.mock.js',
  },
};
