import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Profile — FanSport",
  description:
    "Update your FanSport profile, avatar, cover image, bio, and favorite team.",
};

export default function MeLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}