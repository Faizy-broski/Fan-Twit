import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Alerts — FanTwit",
  description:
    "View likes on your posts and mentions of your favorite team.",
};

export default function AlertsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}