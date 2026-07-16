import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { Geist, Geist_Mono } from "next/font/google";
import { createSupabaseServerComponentClient } from "@/integrations/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: {
    default: "FanSport — Social Discussion for Sports Fans",
    template: "%s | FanSport",
  },
  description:
    "FanSport is the StockTwits of sports. Follow team threads by symbol like $ARS or $LAL, post takes, and chat with fans across every league.",
  authors: [
    {
      name: "FanSport",
    },
  ],
  openGraph: {
    title: "FanSport — Social Discussion for Sports Fans",
    description:
      "Follow team threads by symbol like $ARS or $LAL and chat with fans across every league.",
    type: "website",
    siteName: "FanSport",
  },
  twitter: {
    card: "summary_large_image",
    title: "FanSport — Social Discussion for Sports Fans",
    description:
      "Follow team threads by symbol like $ARS or $LAL and chat with fans across every league.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the session server-side (from the request's cookies) so the
  // client's first render already knows whether a user is signed in,
  // instead of starting logged-out and flashing to logged-in once the
  // browser resolves its own session lookup. This opts the app into
  // dynamic rendering, which is already the case in practice — nearly
  // every page here is a client component driven by live/session data.
  const supabase = await createSupabaseServerComponentClient();
  const initialUser = supabase
    ? (await supabase.auth.getSession()).data.session?.user ?? null
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers initialUser={initialUser}>{children}</Providers>
      </body>
    </html>
  );
}
