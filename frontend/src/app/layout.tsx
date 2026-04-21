import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DevOverlayInit from "@/components/dev/DevOverlayInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InteractiveDocs - 智能文档编辑器",
  description: "基于 AI 的智能文档编辑平台，支持关键词提取、摘要生成和章节编辑",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <DevOverlayInit />
        {children}
      </body>
    </html>
  );
}
