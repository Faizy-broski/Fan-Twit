import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { Geist, Geist_Mono } from "next/font/google";
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
    default: "FanTwit — Social Discussion for Sports Fans",
    template: "%s | FanTwit",
  },
  description:
    "FanTwit is the StockTwits of sports. Follow team threads by symbol like $ARS or $LAL, post takes, and chat with fans across every league.",
  authors: [
    {
      name: "FanTwit",
    },
  ],
  openGraph: {
    title: "FanTwit — Social Discussion for Sports Fans",
    description:
      "Follow team threads by symbol like $ARS or $LAL and chat with fans across every league.",
    type: "website",
    siteName: "FanTwit",
  },
  twitter: {
    card: "summary_large_image",
    title: "FanTwit — Social Discussion for Sports Fans",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
