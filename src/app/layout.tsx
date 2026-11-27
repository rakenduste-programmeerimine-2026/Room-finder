import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { AppHeader } from "./_components/app-header";
import { Toaster } from "./_components/toaster";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Ruumileidja",
  description: "Leia ürituse jaoks parim aeg ja ruum TLÜ-s.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="et" className={`${plexSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppHeader />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
