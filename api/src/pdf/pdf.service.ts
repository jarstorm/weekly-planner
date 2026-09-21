import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { marked } from 'marked';

const DISCLAIMER = 'Generado por la IA de WeeklyFeedback a partir de la información de los empleados.';

interface InlineToken {
  type: string;
  text?: string;
  tokens?: InlineToken[];
}

interface BlockToken {
  type: string;
  text?: string;
  tokens?: InlineToken[];
  depth?: number;
  items?: BlockToken[];
}

@Injectable()
export class PdfService {
  // Convierte el markdown que devuelve AggregateService (sección 10 del doc
  // de producto) a un PDF con negritas/listas/títulos reales — no usa un
  // navegador headless (Puppeteer), solo pdfkit con sus fuentes estándar
  // (Helvetica), así no hay que empaquetar Chromium ni archivos de fuente.
  async fromMarkdown(markdown: string, title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 56, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'left' });
      doc.moveDown(1);

      const tokens = marked.lexer(markdown) as unknown as BlockToken[];
      this.renderBlocks(doc, tokens);

      this.addDisclaimerFooter(doc);
      doc.end();
    });
  }

  private renderBlocks(doc: PDFKit.PDFDocument, tokens: BlockToken[]) {
    for (const token of tokens) {
      switch (token.type) {
        case 'heading':
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fontSize(20 - (token.depth ?? 2) * 2);
          this.renderInline(doc, token.tokens ?? [{ type: 'text', text: token.text }]);
          doc.moveDown(0.3);
          break;
        case 'paragraph':
          doc.font('Helvetica').fontSize(11);
          this.renderInline(doc, token.tokens ?? [{ type: 'text', text: token.text }]);
          doc.moveDown(0.5);
          break;
        case 'list':
          doc.font('Helvetica').fontSize(11);
          for (const item of token.items ?? []) {
            const inline = item.tokens?.[0]?.tokens ?? [{ type: 'text', text: item.text }];
            doc.text('•  ', { continued: true, indent: 12 });
            this.renderInline(doc, inline);
          }
          doc.moveDown(0.5);
          break;
        default:
          if (token.text) {
            doc.font('Helvetica').fontSize(11).text(token.text);
            doc.moveDown(0.3);
          }
      }
    }
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
        doc.text(t.text ?? this.plainText(t), { continued });
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

  private addDisclaimerFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Escribir dentro del margen inferior dispara una página nueva
      // (pdfkit pagina automático si el texto cae fuera del área de
      // contenido) — se anula el margen mientras se escribe el footer y
      // se restaura después, patrón estándar para pies de página en pdfkit.
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor('#667a71')
        .text(DISCLAIMER, doc.page.margins.left, doc.page.height - 40, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center',
          lineBreak: false,
        });
      doc.fillColor('black');
      doc.page.margins.bottom = originalBottomMargin;
    }
  }
}
