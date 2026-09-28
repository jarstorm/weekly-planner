import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone: bundle de servidor autocontenido con solo los node_modules
  // que realmente usa (traced), en vez de necesitar `npm install` completo
  // en la VPS de producción (1GB RAM, no aguanta el build ahí).
  output: 'standalone',
};

export default withNextIntl(nextConfig);
