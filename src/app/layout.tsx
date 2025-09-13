import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'CFDI Processor - Sistema Empresarial',
  description: 'Sistema completo de procesamiento de facturas CFDI mexicanas con IA, sincronización en la nube y análisis empresarial avanzado',
  keywords: 'CFDI, facturas, México, procesamiento, IA, contabilidad, empresarial',
  authors: [{ name: 'CFDI Processor Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-inter antialiased bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}