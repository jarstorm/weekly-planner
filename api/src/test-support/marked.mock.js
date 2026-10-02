// `marked` (v16+) solo publica un build ESM (sin "require" en su "exports"
// map), así que cualquier test que cargue PdfService (que hace
// `import { marked } from 'marked'`) rompe Jest en CommonJS — ver
// jest.config.js, moduleNameMapper. Nada en la suite comprueba el HTML real
// que genera `marked`, así que este shim solo necesita no explotar.
module.exports = {
  marked: Object.assign(
    (markdown) => String(markdown),
    // PdfService llama a marked.lexer(), no a marked() — pdf.service.spec.ts
    // sobreescribe esto por test con tokens fijos (simulando lo que marked.lexer()
    // produciría), así no hace falta el lexer real para probar el renderizado.
    { lexer: jest.fn(() => []) },
  ),
};
