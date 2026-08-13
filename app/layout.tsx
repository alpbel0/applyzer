import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kovan Startup Studio · Staj Başvurusu",
  description: "Kovan Startup Studio AI ve otomasyon staj başvurusu",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
