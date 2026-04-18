import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StadiumFlow",
  description:
    "Smart venue companion: live crowd density, wait times and suggestions for large sporting venues.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
