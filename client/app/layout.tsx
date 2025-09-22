import type { Metadata } from 'next';
import { Providers } from './providers/provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart PDF Assistant',
  description: 'Upload PDFs and interact with them using AI-powered Q&A and summaries.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
