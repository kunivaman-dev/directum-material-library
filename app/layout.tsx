import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Библиотека материалов Directum",
  description: "Фирменные иконки, логотипы и правила использования материалов Directum.",
  icons: { icon: "/assets/directum-site-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
