import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: { default: "Bengkel Anargya", template: "%s · Bengkel Anargya" },
  description: "Catat posisi alat dan stok bahan bengkel Anargya ITS EV Team.",
  applicationName: "Bengkel Anargya",
  appleWebApp: { capable: true, title: "Bengkel", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1211",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
