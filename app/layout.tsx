import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Network Alert Monitor',
  description: 'Simulated router, switch and firewall monitoring with automated alerts.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
