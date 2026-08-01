import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "AgencyOS — The operating system for marketing agencies",
    template: "%s · AgencyOS",
  },
  description:
    "AgencyOS unifies lead-to-renewal in one configurable workspace: CRM, projects, approvals, time, finance, and a branded client portal.",
  keywords: [
    "AgencyOS",
    "agency CRM",
    "marketing agency software",
    "client portal",
    "project management",
    "approvals",
    "retainers",
  ],
  authors: [{ name: "AgencyOS" }],
  openGraph: {
    title: "AgencyOS — The operating system for marketing agencies",
    description:
      "Lead → deal → client → delivery → approval → report → renewal. One workspace, deeply configurable.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgencyOS",
    description: "The operating system for marketing agencies.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
