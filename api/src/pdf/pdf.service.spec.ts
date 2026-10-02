import * as PDFDocument from 'pdfkit';
import { marked } from 'marked';
import { PdfService } from './pdf.service';

// `marked.lexer()` está mockeado (ver test-support/marked.mock.js) — cada
// test fija los tokens a mano, simulando exactamente lo que marked.lexer()
// produciría para un markdown dado, documentado en los comentarios reales
// de pdf.service.ts (soft breaks, párrafo en negrita como subtítulo, listas
// anidadas). Así se prueba el renderizado sin depender del lexer real
// (ESM-only, ver jest.config.js).
const lexerMock = marked.lexer as jest.Mock;

let textSpy: jest.SpyInstance;
let fontSpy: jest.SpyInstance;
let fontSizeSpy: jest.SpyInstance;

beforeEach(() => {
  lexerMock.mockReset();
  lexerMock.mockReturnValue([]);
  // spyOn con passthrough (sin mockImplementation): sigue dibujando el PDF
  // real, solo observa qué se le pidió dibujar.
  textSpy = jest.spyOn((PDFDocument as any).prototype, 'text');
  fontSpy = jest.spyOn((PDFDocument as any).prototype, 'font');
  fontSizeSpy = jest.spyOn((PDFDocument as any).prototype, 'fontSize');
});

afterEach(() => {
  textSpy.mockRestore();
  fontSpy.mockRestore();
  fontSizeSpy.mockRestore();
});

function textCallsWith(substring: string) {
  return textSpy.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes(substring));
}

describe('PdfService.fromMarkdown — encabezado y pie', () => {
  it('produce un PDF real (cabecera %PDF) con el título y el disclaimer de autoría', async () => {
    const service = new PdfService();

    const buffer = await service.fromMarkdown('', 'Resumen semanal — Producto');

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(textCallsWith('Resumen semanal — Producto')).toHaveLength(1);
    expect(textCallsWith('Generado por la IA de WeeklyFeedback')).toHaveLength(1);
  });
});

describe('PdfService.fromMarkdown — heading', () => {
  it('un heading de depth 2 usa fontSize 16 y negrita', async () => {
    lexerMock.mockReturnValue([{ type: 'heading', depth: 2, tokens: [{ type: 'text', text: 'Logros de la semana' }] }]);
    const service = new PdfService();

    await service.fromMarkdown('## Logros de la semana', 'Título');

    expect(fontSizeSpy).toHaveBeenCalledWith(16); // 20 - 2*2
    expect(textCallsWith('Logros de la semana')).toHaveLength(1);
  });
});

describe('PdfService.fromMarkdown — párrafo en negrita como subtítulo (sin heading real)', () => {
  it('"**Logros**  " (strong + texto en blanco residual) se renderiza como subtítulo, fontSize 13', async () => {
    lexerMock.mockReturnValue([
      {
        type: 'paragraph',
        tokens: [
          { type: 'strong', tokens: [{ type: 'text', text: 'Logros de la semana' }] },
          { type: 'text', text: '  ' },
        ],
      },
    ]);
    const service = new PdfService();

    await service.fromMarkdown('**Logros de la semana**  ', 'Título');

    expect(fontSizeSpy).toHaveBeenCalledWith(13);
    expect(textCallsWith('Logros de la semana')).toHaveLength(1);
  });

  it('un párrafo con strong pero con MÁS contenido detrás no se trata como subtítulo', async () => {
    lexerMock.mockReturnValue([
      {
        type: 'paragraph',
        tokens: [
          { type: 'strong', tokens: [{ type: 'text', text: 'Ana' }] },
          { type: 'text', text: ': terminó la migración' },
        ],
      },
    ]);
    const service = new PdfService();

    await service.fromMarkdown('**Ana**: terminó la migración', 'Título');

    // fontSize 13 es la marca del camino de "subtítulo" — no debe dispararse acá.
    expect(fontSizeSpy).not.toHaveBeenCalledWith(13);
    expect(textCallsWith(': terminó la migración')).toHaveLength(1);
  });
});

describe('PdfService.fromMarkdown — soft break dentro de un párrafo', () => {
  it('un salto de línea simple ("**Nombre**\\ndescripción") se renderiza como espacio, no como salto de línea crudo', async () => {
    lexerMock.mockReturnValue([
      {
        type: 'paragraph',
        tokens: [
          { type: 'strong', tokens: [{ type: 'text', text: 'Bruno' }] },
          { type: 'text', text: '\ndescripción del bloqueo' },
        ],
      },
    ]);
    const service = new PdfService();

    await service.fromMarkdown('irrelevante, el lexer está mockeado', 'Título');

    const calls = textSpy.mock.calls.filter((call) => typeof call[0] === 'string' && call[0].includes('descripción del bloqueo'));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(' descripción del bloqueo');
    expect(calls[0][0]).not.toContain('\n');
  });
});

describe('PdfService.fromMarkdown — listas', () => {
  it('lista desordenada usa el marcador "•", ordenada usa "1.", "2."...', async () => {
    lexerMock.mockReturnValueOnce([
      {
        type: 'list',
        ordered: false,
        items: [{ type: 'list_item', tokens: [{ type: 'text', text: 'Primer punto' }] }],
      },
    ]);
    const service = new PdfService();
    await service.fromMarkdown('- Primer punto', 'Título');
    expect(textCallsWith('•')).toHaveLength(1);

    lexerMock.mockReturnValueOnce([
      {
        type: 'list',
        ordered: true,
        items: [{ type: 'list_item', tokens: [{ type: 'text', text: 'Primero' }] }],
      },
    ]);
    await service.fromMarkdown('1. Primero', 'Título');
    expect(textCallsWith('1.')).toHaveLength(1);
  });

  it('un item con una sub-lista debajo (no solo item.tokens[0]) renderiza también el bloque anidado, con más indent', async () => {
    lexerMock.mockReturnValue([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            type: 'list_item',
            tokens: [
              { type: 'text', text: 'Ana', tokens: [{ type: 'text', text: 'Ana' }] },
              {
                type: 'list',
                ordered: true,
                items: [{ type: 'list_item', tokens: [{ type: 'text', text: 'Terminó la migración' }] }],
              },
            ],
          },
        ],
      },
    ]);
    const service = new PdfService();

    await service.fromMarkdown('irrelevante', 'Título');

    expect(textCallsWith('Ana')).toHaveLength(1);
    expect(textCallsWith('Terminó la migración')).toHaveLength(1);
    // El marcador de la sub-lista ordenada ("1.") se indenta más que el de
    // la lista exterior (12 vs 12+14=26) — se comprueba vía la opción `indent`.
    const outerCall = textSpy.mock.calls.find((c) => typeof c[0] === 'string' && c[0] === '•  ');
    const innerCall = textSpy.mock.calls.find((c) => typeof c[0] === 'string' && c[0] === '1.  ');
    expect(outerCall?.[2]?.indent ?? outerCall?.[1]?.indent).toBe(12);
    expect(innerCall?.[2]?.indent ?? innerCall?.[1]?.indent).toBe(26);
  });
});
