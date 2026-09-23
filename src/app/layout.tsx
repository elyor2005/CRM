import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "CRM — Distribution",
  description: "Mobile-first CRM for wholesale cleaning-chemicals distribution",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
