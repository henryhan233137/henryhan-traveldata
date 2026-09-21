import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "侦探旅行档案",
  description: "可编辑、可分享、可离线使用的私人旅行规划与行程档案。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
