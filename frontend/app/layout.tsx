import type { Metadata } from "next";
import { Archivo, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/lib/providers";
import { RequestProgress } from "@/components/common/RequestProgress";
import "./globals.css";

/**
 * Three voices, one per role.
 *
 * Archivo is a grotesque drawn for signage and official print — it sets
 * headings tight and confident. Public Sans is the typeface of US federal
 * public records, which is exactly the register a document registry wants for
 * running text. IBM Plex Mono is the "stamp": scope markings, record IDs and
 * timestamps, never prose.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocTracker — Document Registry",
  description:
    "File, route and approve documents across departments, with access controlled by role and scope.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${archivo.variable} ${plexMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <RequestProgress />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
