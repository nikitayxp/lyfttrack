import type { Metadata } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { CookieConsentBanner } from "@/components/ui/cookie-consent-banner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LyftTrack",
  description:
    "Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews.",
  keywords: ["fitness", "workout tracker", "gym app", "LyftTrack", "blog", "training"],
  applicationName: "LyftTrack",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "LyftTrack",
    description:
      "Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews.",
    siteName: "LyftTrack",
  },
  twitter: {
    card: "summary",
    title: "LyftTrack",
    description:
      "Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body className={`${spaceGrotesk.variable} ${bebasNeue.variable} antialiased`}>
        {children}
        <CookieConsentBanner />
        <Toaster position="bottom-center" richColors={false} />
      </body>
    </html>
  );
}
