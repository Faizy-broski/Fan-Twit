import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Profile — FanTwit",
  description:
    "Update your FanTwit profile, avatar, cover image, bio, and favorite team.",
};

export default function MeLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}