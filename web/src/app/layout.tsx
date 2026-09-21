import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WeeklyFeedback',
  description: 'El resumen semanal que se escribe solo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
