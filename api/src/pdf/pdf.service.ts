import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { marked } from 'marked';
import { sanitizeText } from './text.utils';

const DISCLAIMER = 'Generado por la IA de WeeklyFeedback a partir de la información de los empleados.';

// Paleta de marca — mismos valores que web/src/app/[locale]/globals.css
// (--color-primary-700, --color-logo-accent) y el ícono
// web/src/app/icon.svg, para que el PDF se vea como parte del mismo
// producto que la web, no como un documento genérico aparte.
const BRAND_DARK = '#176140';
const BRAND_TEXT = '#141c18';
const BRAND_MUTED = '#677a71';
const BRAND_BORDER = '#dde4e1';
const ICON_GRADIENT_START = '#4E9068';
const ICON_GRADIENT_END = '#2E5E42';
const ICON_ACCENT = '#3B7453';

interface InlineToken {
  type: string;
  text?: string;
  tokens?: InlineToken[];
}

interface BlockToken {
  type: string;
  text?: string;
  // A nivel de bloque suelto (párrafo/heading) son tokens inline; dentro de
  // un item de lista (`list_item.tokens`) son otros BlockToken — puede
  // haber un bloque de texto seguido de una sub-lista anidada. Unión en vez
  // de dos interfaces para no duplicar todo lo demás.
  tokens?: InlineToken[] | BlockToken[];
  depth?: number;
  items?: BlockToken[];
  ordered?: boolean;
}

@Injectable()
export class PdfService {
  // Convierte el markdown que devuelve AggregateService (sección 10 del doc
  // de producto) a un PDF con negritas/listas/títulos reales — no usa un
  // navegador headless (Puppeteer), solo pdfkit con sus fuentes estándar
  // (Helvetica) y dibujo vectorial (el logo se redibuja con las mismas
  // coordenadas SVG de icon.svg, no hace falta rasterizar nada).
  async fromMarkdown(markdown: string, title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 56, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, title);

      const tokens = marked.lexer(sanitizeText(markdown)) as unknown as BlockToken[];
      this.renderBlocks(doc, tokens);

      this.addFooter(doc);
      doc.end();
    });
  }

  // Ícono "burbuja + check" a escala arbitraria — mismo path SVG que
  // web/src/app/icon.svg y BrandMark.tsx, con translate+scale en vez de
  // reescribir coordenadas a mano (así los tres quedan sincronizados si el
  // logo cambia: copiar y pegar el mismo path).
  private drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
    doc.save();
    doc.translate(x, y).scale(size / 64);

    const gradient = doc.linearGradient(0, 0, 64, 64);
    gradient.stop(0, ICON_GRADIENT_START).stop(1, ICON_GRADIENT_END);
    doc.roundedRect(0, 0, 64, 64, 15).fill(gradient);

    doc.path('M20 15H44a6 6 0 0 1 6 6V36a6 6 0 0 1-6 6H29L19 50V42a6 6 0 0 1-5-6V21a6 6 0 0 1 6-6Z').fill('#ffffff');

    doc
      .path('M21 23H43 M21 30.5H30 M34.5 30.5l3.2 3.2 6-6.4')
      .lineWidth(3.4)
      .lineCap('round')
      .lineJoin('round')
      .stroke(ICON_ACCENT);

    doc.restore();
  }

  private addHeader(doc: PDFKit.PDFDocument, title: string) {
    const startX = doc.page.margins.left;
    const startY = doc.page.margins.top;

    this.drawLogo(doc, startX, startY, 30);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(BRAND_TEXT)
      .text('Weekly', startX + 38, startY + 8, { continued: true })
      .fillColor(ICON_ACCENT)
      .text('Feedback');
    doc.fillColor(BRAND_TEXT);

    const ruleY = startY + 34;
    doc
      .moveTo(startX, ruleY)
      .lineTo(doc.page.width - doc.page.margins.right, ruleY)
      .lineWidth(1)
      .strokeColor(BRAND_BORDER)
      .stroke();

    doc.y = ruleY + 16;
    doc.x = startX;
    doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND_TEXT).text(title, { align: 'left' });
    doc.fillColor(BRAND_TEXT);
    doc.moveDown(1);
  }

  private renderBlocks(doc: PDFKit.PDFDocument, tokens: BlockToken[]) {
    for (const token of tokens) {
      switch (token.type) {
        case 'heading':
          doc.moveDown(0.6);
          doc
            .font('Helvetica-Bold')
            .fontSize(20 - (token.depth ?? 2) * 2)
            .fillColor(BRAND_DARK);
          this.renderInline(doc, token.tokens ?? [{ type: 'text', text: token.text }]);
          doc.fillColor(BRAND_TEXT);
          doc.moveDown(0.35);
          break;
        case 'paragraph': {
          // El prompt de AggregateService (sección 10 del doc de producto)
          // genera los títulos de sección como "**Logros de la semana**  "
          // (con un salto de línea "duro" pegado, dos espacios al final) —
          // negrita simple, no un heading `##` real. marked dejaba esos dos
          // espacios como un segundo token 'text' residual (probado contra
          // markdown real de Groq, no solo el de prueba) — así que la
          // detección tolera texto en blanco después del strong, no exige
          // que sea el único token.
          const first = token.tokens?.[0];
          const restIsBlank = (token.tokens ?? []).slice(1).every((t) => t.type === 'text' && !(t.text ?? '').trim());
          if (first?.type === 'strong' && restIsBlank) {
            doc.moveDown(0.6);
            doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_DARK);
            doc.text(this.plainText(first));
            doc.fillColor(BRAND_TEXT);
            doc.moveDown(0.3);
            break;
          }
          doc.font('Helvetica').fontSize(11).fillColor(BRAND_TEXT);
          this.renderInline(doc, token.tokens ?? [{ type: 'text', text: token.text }]);
          doc.moveDown(0.5);
          break;
        }
        case 'list':
          this.renderList(doc, token, 12);
          doc.moveDown(0.5);
          break;
        default:
          if (token.text) {
            doc.font('Helvetica').fontSize(11).fillColor(BRAND_TEXT).text(token.text);
            doc.moveDown(0.3);
          }
      }
    }
  }

  // Cada item de una lista puede traer, después de su texto, bloques
  // adicionales — el caso real que rompía esto: "- **Ana**" seguido de una
  // sub-lista numerada con el contenido de verdad. Antes solo se leía
  // item.tokens[0], perdiendo cualquier bloque siguiente (informes
  // entregados con el nombre de la persona y nada más debajo, ver
  // docs/pruebas-produccion.md). Ahora recorre todos los bloques del item
  // y baja recursivamente en las sub-listas, con más indent.
  private renderList(doc: PDFKit.PDFDocument, listToken: BlockToken, indent: number) {
    doc.font('Helvetica').fontSize(11).fillColor(BRAND_TEXT);
    (listToken.items ?? []).forEach((item, i) => {
      const blocks = (item.tokens as BlockToken[] | undefined) ?? [{ type: 'text', text: item.text }];
      const marker = listToken.ordered ? `${i + 1}.  ` : '•  ';

      blocks.forEach((block, blockIndex) => {
        if (block.type === 'list') {
          this.renderList(doc, block, indent + 14);
          return;
        }
        const inline = (block.tokens as InlineToken[] | undefined) ?? [{ type: 'text', text: block.text }];
        if (blockIndex === 0) {
          doc.fillColor(BRAND_DARK).text(marker, { continued: true, indent });
          doc.fillColor(BRAND_TEXT);
        } else {
          doc.text(' '.repeat(marker.length), { continued: true, indent });
        }
        this.renderInline(doc, inline);
      });
    });
  }

  private renderInline(doc: PDFKit.PDFDocument, tokens: InlineToken[]) {
    tokens.forEach((t, i) => {
      const isLast = i === tokens.length - 1;
      const continued = !isLast;
      if (t.type === 'strong') {
        doc.font('Helvetica-Bold');
        doc.text(this.plainText(t), { continued });
        doc.font('Helvetica');
      } else if (t.type === 'em') {
        doc.font('Helvetica-Oblique');
        doc.text(this.plainText(t), { continued });
        doc.font('Helvetica');
      } else {
        // Un salto de línea simple dentro de un párrafo/item ("**Nombre**\ndescripción",
        // el modelo lo genera así en vez de como bloques separados) es un
        // "soft break" en markdown — se renderiza como espacio, no como
        // salto de línea. pdfkit con `continued: true` no rompe línea ahí
        // solo, deja un hueco en blanco hasta el margen y sigue en la
        // misma línea visual (visto en producción: título en negrita,
        // hueco enorme, y el texto pegado a continuación). Normalizar
        // aquí en vez de tocar sanitizeText (ese limpia el markdown
        // entero antes del lexer; esto es solo cómo se pinta un token ya
        // partido).
        const text = (t.text ?? this.plainText(t)).replace(/\n+/g, ' ');
        doc.text(text, { continued });
      }
    });
  }

  // Para negrita/cursiva anidada (p. ej. "**muy** importante" dentro de un
  // strong) alcanza con el texto plano — el prompt no genera anidamientos
  // más profundos que eso.
  private plainText(token: InlineToken): string {
    if (token.text) return token.text;
    return (token.tokens ?? []).map((t) => t.text ?? '').join('');
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const pageNumber = i - range.start + 1;
      // Escribir dentro del margen inferior dispara una página nueva
      // (pdfkit pagina automático si el texto cae fuera del área de
      // contenido) — se anula el margen mientras se escribe el footer y
      // se restaura después, patrón estándar para pies de página en pdfkit.
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      const footerY = doc.page.height - 46;
      doc
        .moveTo(doc.page.margins.left, footerY)
        .lineTo(doc.page.width - doc.page.margins.right, footerY)
        .lineWidth(0.5)
        .strokeColor(BRAND_BORDER)
        .stroke();

      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(BRAND_MUTED)
        .text(DISCLAIMER, doc.page.margins.left, footerY + 8, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 60,
          lineBreak: false,
        });

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND_MUTED)
        .text(`${pageNumber}/${range.count}`, doc.page.width - doc.page.margins.right - 40, footerY + 8, {
          width: 40,
          align: 'right',
          lineBreak: false,
        });

      doc.fillColor(BRAND_TEXT);
      doc.page.margins.bottom = originalBottomMargin;
    }
  }
}
