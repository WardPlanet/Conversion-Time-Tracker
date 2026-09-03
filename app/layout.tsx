import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract Trainer Time Tracker",
  description: "Time tracking and booking management for Planet DDS contract trainers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-brand-darkBlue">{children}</body>
    </html>
  );
}
