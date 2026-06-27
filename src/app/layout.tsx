import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// Body / UI / numbers — Inter handles all the small, dense, tabular work (via
// font-variant-numeric: tabular-nums). No slashed zeros.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  // We still expose mono + serif vars to keep existing class hooks working,
  // but they all resolve to Inter in globals.css.
});

// Display — Bricolage Grotesque, a modern grotesque with character. Used for
// headings and the big numbers on the dashboard via the `.display` class.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
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
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
