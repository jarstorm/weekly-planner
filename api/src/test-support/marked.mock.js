// `marked` (v16+) solo publica un build ESM (sin "require" en su "exports"
// map), así que cualquier test que cargue PdfService (que hace
// `import { marked } from 'marked'`) rompe Jest en CommonJS — ver
// jest.config.js, moduleNameMapper. Nada en la suite comprueba el HTML real
// que genera `marked`, así que este shim solo necesita no explotar.
module.exports = { marked: (markdown) => String(markdown) };
