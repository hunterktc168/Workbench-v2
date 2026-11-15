import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Workbench — AI Venture Operating System',
  description: 'A local-first AI workspace for developing ventures, coordinating agents, and managing strategic work.',
  openGraph: {
    title: 'Workbench — AI Venture Operating System',
    description: 'A local-first AI workspace for developing ventures, coordinating agents, and managing strategic work.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Workbench — AI Venture Operating System',
    description: 'A local-first AI workspace for developing ventures, coordinating agents, and managing strategic work.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
