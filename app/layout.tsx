import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import PwaRegister from "./pwa-register";
import PushSubscriber from "./components/PushSubscriber";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planning साथी",
  description: "Vehicle placement tracker by ZAST Logisolutions",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Planning साथी",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <Providers>
          {children}
          <PushSubscriber />
        </Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
