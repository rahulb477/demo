import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit POS",
  description: "Point of sale, inventory and analytics for modern retail",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
