import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// The family type pairing. These emit --ds-font-* rather than --font-*: the
// design system's Tailwind bridge defines --font-sans FROM --ds-font-body, so
// naming them --font-sans would create a variable cycle. globals.css maps the
// legacy --font-sans/mono/serif hooks onto these.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--ds-font-body",
  subsets: ["latin"],
});

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--ds-font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Budgetly: Personal Budget",
  description: "A clean place to watch your money.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budgetly",
  },
  // Legacy iOS standalone hint; Next 16 doesn't emit it from appleWebApp alone.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // Matches --ds-page.
  themeColor: "#fcfcfb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hankenGrotesk.variable} ${schibstedGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
