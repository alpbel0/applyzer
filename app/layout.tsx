import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Applyzer",
  description: "Aday başvuru ve değerlendirme platformu",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
