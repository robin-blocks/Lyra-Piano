import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lyra - AI Piano Teacher',
  description: 'Your AI companion for mastering the keys. Learn piano through natural conversation with Lyra.',
  keywords: ['piano', 'AI', 'music education', 'ElevenLabs', 'Gemini'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
