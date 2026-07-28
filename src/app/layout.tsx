import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Outfit, Cormorant_Garamond } from "next/font/google";
import { Providers } from "@/components/providers";
import { brand } from "@/config/brand";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: brand.title,
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.name,
  },
  openGraph: {
    title: brand.title,
    description: brand.description,
    siteName: brand.name,
    locale: "pt_BR",
    type: "website",
    images: [{ url: brand.logos.icon }],
  },
  twitter: {
    card: "summary",
    title: brand.title,
    description: brand.description,
    images: [brand.logos.icon],
  },
  icons: {
    icon: brand.logos.icon,
    shortcut: brand.logos.icon,
    apple: brand.logos.icon,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#fcfcfc" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
