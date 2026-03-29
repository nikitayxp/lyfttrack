import type { Metadata } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
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
  title: "LyftTrack - App Sample Website",
  description:
    "Official LyftTrack website experience with app showcase, bilingual blog, theme switch and interactive training previews.",
  keywords: ["fitness", "workout tracker", "gym app", "LyftTrack", "blog", "training"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${bebasNeue.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
