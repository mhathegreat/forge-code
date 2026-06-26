import './globals.css';

export const metadata = {
  title: 'KimiStudio',
  description: 'Self-hosted agentic coding studio powered by Kimi K2.6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
