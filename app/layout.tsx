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
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:bg-white dark:focus:text-slate-900"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
