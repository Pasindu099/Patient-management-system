import type { Metadata } from 'next'
import { BookingForm } from '@/components/BookingForm'
import { Shield, Clock, Award } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Book a Dentist Appointment in Minuwangoda',
  description: 'Book a dental appointment online at Lumora Dental Studio in Minuwangoda for check-ups, whitening, cosmetic dentistry, orthodontics, implants and emergency dental care.',
  alternates: { canonical: '/book' },
  openGraph: {
    title: 'Book a Dentist Appointment in Minuwangoda | Lumora Dental Studio',
    description: 'Choose a Lumora dentist, view available slots and book your dental appointment online.',
    url: '/book',
  },
}

export default function BookPage() {
  return (
    <div className="min-h-screen bg-cream pt-24 sm:pt-28 pb-12 sm:pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-14">
          <p className="text-[11px] sm:text-xs tracking-[0.28em] sm:tracking-[0.4em] uppercase text-gold mb-3">Reserve Your Visit</p>
          <h1 className="font-serif text-4xl sm:text-6xl text-stone-dark leading-tight">Book an Appointment</h1>
          <div className="gold-line" />
          <p className="text-stone mt-4 max-w-xl mx-auto leading-relaxed">
            Choose a doctor and an available time slot below.
            Your appointment is confirmed instantly — no waiting for a call back.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">

          {/* Form */}
          <div className="lg:col-span-2">
            <BookingForm />
          </div>

          {/* Sidebar info */}
          <div className="space-y-6">
            {[
              {
                icon:  Shield,
                title: 'Secure & Private',
                desc:  'Your personal information is handled with strict confidentiality and never shared with third parties.',
              },
              {
                icon:  Clock,
                title: 'Instant Confirmation',
                desc:  'Your appointment is booked the moment you submit the form. Keep your reference number — our team will contact you only if anything changes.',
              },
              {
                icon:  Award,
                title: 'Experienced Team',
                desc:  'Dr. Amitha Perera brings over 25 years of dental experience to every visit.',
              },
            ].map(item => (
              <div key={item.title} className="bg-white p-5 sm:p-6 border border-cream-dark">
                <div className="w-10 h-10 bg-cream-dark flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-gold" />
                </div>
                <h3 className="font-medium text-stone-dark text-base mb-2">{item.title}</h3>
                <p className="text-stone text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}

            {/* Contact fallback */}
            <div className="bg-[#0B1F3A] p-6">
              <p className="text-xs tracking-widest uppercase text-gold mb-3">Prefer to call?</p>
              <p className="text-white font-serif text-2xl mb-1">0761662434</p>
              <p className="text-white/50 text-xs">Mon-Sun · 9:00 AM - 8:00 PM</p>
              <a href="https://wa.me/94761662434" target="_blank"
                className="inline-block mt-4 text-xs tracking-widest uppercase text-gold hover:text-gold-light transition-colors">
                WhatsApp us →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
