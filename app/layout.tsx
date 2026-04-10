import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'High Desert Lodge',
  description: 'Direct room booking for High Desert Lodge.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}