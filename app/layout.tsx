import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rivers End Lodging',
  description: 'Direct room booking for Rivers End Lodging.',
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