import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Defaults; the home page derives its title and description from the profile.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Cosplay & Streaming",
  description: "Cosplay gallery, featured videos and stream schedule.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
