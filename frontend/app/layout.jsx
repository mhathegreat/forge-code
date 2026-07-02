import './globals.css';

export const metadata = {
  title: 'Forge',
  description: 'Self-hosted AI coding studio — plan, build, and run software with an autonomous agent.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Forge', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  themeColor: '#0a0a0b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
