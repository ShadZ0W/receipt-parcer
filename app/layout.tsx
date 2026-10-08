import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Receipt to Excel | VectraFlux",
  description: "Turn invoices and receipts into Excel spreadsheets in seconds.",
  other: {
    "google-site-verification": "HSlZE57nAQLyVcFJ2ldyAGDEarFo2Z_ZS3fen_LDC5U",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        
        {/* Global Studio Header */}
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-tight text-gray-900">VectraFlux</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Receipt Parser</span>
          </div>
          <nav className="text-sm">
            <a 
              href="https://receipt-parcer-sooty.vercel.app" 
              className="text-gray-600 hover:text-indigo-600 font-medium transition-colors"
            >
              Studio Home
            </a>
          </nav>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">
          {children}
        </main>

        {/* Global Studio Footer */}
        <footer className="border-t bg-white px-6 py-6 text-center text-sm text-gray-500">
          <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto gap-4">
            <p>© 2026 VectraFlux. All rights reserved.</p>
            <div className="flex space-x-6 text-xs">
              <span className="hover:text-gray-800 transition-colors">Built by Luqman Nurhakim</span>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}