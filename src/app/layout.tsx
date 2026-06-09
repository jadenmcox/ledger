import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Single typeface system — Inter handles display, body, and numbers (via
// font-variant-numeric: tabular-nums). No slashed zeros.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  // We still expose mono + serif vars to keep existing class hooks working,
  // but they all resolve to Inter in globals.css.
});

export const metadata: Metadata = {
  title: "Budgetly — Personal Budget",
  description: "A clean place to watch your money.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budgetly",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f4",
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
