'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone } from 'lucide-react'

const LINKS = [
  { href: '/#services', label: 'Services' },
  { href: '/#about',    label: 'About' },
  { href: '/#gallery',  label: 'Gallery' },
  { href: '/#contact',  label: 'Contact' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open,     setOpen]     = useState(false)
  const pathname = usePathname()
  const solid = scrolled || pathname !== '/'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    fn()
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
      ${solid ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3 group">
          <Image src={solid ? '/logo-icon.png' : '/logo-icon-dark.png'}
            alt="Lumora Dental Studio"
            width={48} height={48} priority
            className="w-9 h-9 sm:w-12 sm:h-12 object-contain flex-shrink-0" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className={`font-serif text-xl sm:text-2xl tracking-widest transition-colors truncate
              ${solid ? 'text-stone-dark' : 'text-white'}`}>
              LUMORA
            </span>
            <span className={`text-[10px] sm:text-xs tracking-[0.28em] sm:tracking-[0.35em] uppercase transition-colors mt-0.5 truncate
              ${solid ? 'text-gold' : 'text-gold-light'}`}>
              Dental Studio
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`text-xs tracking-widest uppercase font-medium transition-colors duration-200
                ${solid ? 'text-stone hover:text-gold' : 'text-white/80 hover:text-white'}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-5">
          <a href="tel:+94761662434"
            className={`flex items-center gap-2 text-xs tracking-widest uppercase font-medium transition-colors
              ${solid ? 'text-stone hover:text-gold' : 'text-white/80 hover:text-white'}`}>
            <Phone className="w-3.5 h-3.5" />
            0761662434
          </a>
          <Link href="/book"
            className="px-6 py-3 bg-gold text-white text-xs tracking-widest uppercase font-medium
                       hover:bg-gold-dark transition-colors duration-200">
            Book Appointment
          </Link>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setOpen(o => !o)}
          className={`md:hidden flex h-11 w-11 items-center justify-center transition-colors ${solid ? 'text-stone-dark' : 'text-white'}`}
          aria-label="Toggle menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-cream-dark px-4 py-5 space-y-4 shadow-lg">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block text-sm tracking-widest uppercase text-stone hover:text-gold font-medium">
              {l.label}
            </Link>
          ))}
          <Link href="/book" onClick={() => setOpen(false)}
            className="block text-center px-6 py-3.5 bg-gold text-white text-xs tracking-widest uppercase font-medium">
            Book Appointment
          </Link>
        </div>
      )}
    </header>
  )
}
