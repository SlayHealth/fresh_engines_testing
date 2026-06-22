import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CompatibilityProvider } from "../contexts/CompatibilityContext";

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
        </CompatibilityProvider>
      </body>
    </html>
  );
}
