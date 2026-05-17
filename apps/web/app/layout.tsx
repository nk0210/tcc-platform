import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCC — Trader's Command Center",
  description: "The world's first platform where trading is a sport",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}