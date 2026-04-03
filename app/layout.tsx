import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Firefly Training Prep',
  description: 'Streamline your Adobe Firefly custom model training',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f4f8]">{children}</body>
    </html>
  );
}
