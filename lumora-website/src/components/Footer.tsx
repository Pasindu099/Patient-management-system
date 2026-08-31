import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-[#0B1F3A] text-white/70">
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Brand */}
        <div>
          <div className="mb-5 flex items-center gap-3">
            <Image src="/logo-icon-dark.png" alt="Lumora Dental Studio"
              width={56} height={56} className="w-14 h-14 object-contain" />
            <div>
              <p className="font-serif text-2xl tracking-widest text-white">LUMORA</p>
              <p className="text-xs tracking-[0.35em] uppercase text-gold mt-0.5">Dental Studio</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/50 max-w-xs">
            Your one-stop dental destination for gentle, modern dental care.
          </p>
          <div className="flex gap-4 mt-6">
            <a href="https://www.instagram.com/lumoradentalstudio2026?igsi=MTV6bnBkb24wN2ZnaQ==" aria-label="Instagram" target="_blank" rel="noreferrer"
              className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-gold hover:text-gold transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61593978023102" aria-label="Facebook" target="_blank" rel="noreferrer"
              className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-gold hover:text-gold transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="https://www.linkedin.com/company/146178897/admin/dashboard/" aria-label="LinkedIn" target="_blank" rel="noreferrer"
              className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-gold hover:text-gold transition-colors">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Links */}
        <div>
          <p className="text-xs tracking-widest uppercase text-gold mb-6">Quick Links</p>
          <ul className="space-y-3">
            {[
              { href: '/#services', label: 'Our Services' },
              { href: '/#about',    label: 'About Us' },
              { href: '/#gallery',  label: 'Gallery' },
              { href: '/book',      label: 'Book Appointment' },
              { href: '/#contact',  label: 'Contact' },
            ].map(l => (
              <li key={l.href}>
                <Link href={l.href}
                  className="text-sm text-white/50 hover:text-gold transition-colors tracking-wide">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs tracking-widest uppercase text-gold mb-6">Contact</p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-sm text-white/50">
              <MapPin className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <span>151/B Negambo Road,<br />Minuwangoda</span>
            </li>
            <li>
              <a href="tel:+94761662434"
                className="flex items-center gap-3 text-sm text-white/50 hover:text-gold transition-colors">
                <Phone className="w-4 h-4 text-gold flex-shrink-0" />
                0761662434
              </a>
            </li>
            <li>
              <a href="mailto:lumoradentalstudio@gmail.com"
                className="flex items-center gap-3 text-sm text-white/50 hover:text-gold transition-colors">
                <Mail className="w-4 h-4 text-gold flex-shrink-0" />
                lumoradentalstudio@gmail.com
              </a>
            </li>
          </ul>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-white/30 tracking-wide">Monday - Sunday</p>
            <p className="text-sm text-white/50 mt-1">9:00 AM - 8:00 PM</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-center text-xs text-white/25 tracking-wide">
          © {new Date().getFullYear()} Lumora Dental Studio. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
