import './globals.css';
import Providers from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QuickTask',
  description: 'Simple task management with payment unlock',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
