import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import { Nav }    from '@/components/Nav'
import { Footer } from '@/components/Footer'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumoradental.lk'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title:       { default: 'Lumora Dental Studio', template: '%s | Lumora Dental Studio' },
  description: 'Book dental care at Lumora Dental Studio in Minuwangoda. Cosmetic dentistry, implants, whitening, orthodontics, emergency dental care and family dentistry.',
  keywords:    [
    'dentist Minuwangoda',
    'dental clinic Minuwangoda',
    'cosmetic dentist Minuwangoda',
    'teeth whitening Minuwangoda',
    'dental implants Minuwangoda',
    'emergency dentist Minuwangoda',
    'Lumora Dental Studio',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Lumora Dental Studio',
    title: 'Lumora Dental Studio | Dentist in Minuwangoda',
    description: 'Dental care in Minuwangoda for cosmetic dentistry, implants, whitening, orthodontics, emergency treatment and family dentistry.',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Lumora Dental Studio' }],
    locale: 'en_LK',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumora Dental Studio | Dentist in Minuwangoda',
    description: 'Book your dental appointment online at Lumora Dental Studio in Minuwangoda.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${cormorantGaramond.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
