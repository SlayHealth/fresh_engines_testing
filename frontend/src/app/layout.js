import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-shell.css";
import { CompatibilityProvider } from "../contexts/CompatibilityContext";
import { ToastContainer } from "../components/Toast";
import { ConfirmDialogContainer } from "../components/ConfirmDialog";
import MobileBottomNav from "../components/MobileBottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SlayHealth Premarital Portal",
  description: "Cardiometabolic timeline projections and premarital compatibility engines.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <CompatibilityProvider>
          {children}
          <MobileBottomNav />
        </CompatibilityProvider>
        <ToastContainer />
        <ConfirmDialogContainer />
      </body>
    </html>
  );
}
