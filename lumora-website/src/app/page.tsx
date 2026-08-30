import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Shield, Sparkles, Heart,
  Clock, Award, Users, ChevronDown,
  Phone, Mail, MapPin, Star,
} from 'lucide-react'
import { ScrollReveal } from '@/components/ScrollReveal'

// ─── DATA ─────────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    icon: Sparkles,
    title: 'Cosmetic Dentistry',
    desc: 'Veneers, teeth whitening, composite bonding and smile makeovers crafted to enhance your natural beauty.',
    treatments: ['Teeth Whitening', 'Veneers', 'Composite Bonding', 'Smile Design'],
  },
  {
    icon: Shield,
    title: 'Restorative Care',
    desc: 'From simple fillings to full-mouth rehabilitation — we restore function and confidence.',
    treatments: ['Fillings', 'Crowns & Bridges', 'Implants', 'Dentures'],
  },
  {
    icon: Heart,
    title: 'Preventive Dentistry',
    desc: 'Professional cleaning, scaling, and personalised oral health programmes to keep problems away.',
    treatments: ['Scaling & Polishing', 'Fluoride Treatment', 'Fissure Sealants', 'Oral Hygiene Coaching'],
  },
  {
    icon: Award,
    title: 'Orthodontics',
    desc: 'Discreet alignment solutions for teens and adults — braces and clear aligners available.',
    treatments: ['Clear Aligners', 'Traditional Braces', 'Retainers', 'Space Maintainers'],
  },
  {
    icon: Clock,
    title: 'Emergency Dental',
    desc: 'Toothache, broken tooth, or lost filling? We keep slots available for urgent care.',
    treatments: ['Toothache Relief', 'Emergency Extractions', 'Broken Tooth Repair', 'Lost Filling'],
  },
  {
    icon: Users,
    title: 'Family Dentistry',
    desc: 'Gentle, comprehensive care for every member of the family — from first teeth to golden years.',
    treatments: ['Children\'s Dentistry', 'Senior Care', 'Family Hygiene Plans', 'School Screenings'],
  },
]

const GALLERY_ITEMS = [
  { label: 'Reception & Waiting Lounge', aspect: 'tall', src: '/images/gallery-reception.jpg', alt: 'Lumora Dental Studio reception and waiting lounge' },
  { label: 'Treatment Suite', aspect: 'wide', src: '/images/gallery-treatment-suite.jpg', alt: 'Lumora Dental Studio treatment suite' },
  { label: 'Before & After - Smile Design', aspect: 'sq', src: '/images/gallery-smile-design.jpg', alt: 'Cosmetic smile design result' },
  { label: 'Panoramic X-Ray Suite', aspect: 'sq', src: '/images/gallery-xray-suite.jpg', alt: 'Lumora Dental Studio panoramic x-ray suite' },
  { label: 'Sterilisation Room', aspect: 'wide', src: '/images/gallery-sterilisation.jpg', alt: 'Lumora Dental Studio sterilisation room' },
  { label: 'Before & After - Whitening', aspect: 'tall', src: '/images/gallery-whitening.jpg', alt: 'Teeth whitening result' },
]

const STATS = [
  { value: '15+', label: 'Years of excellence' },
  { value: '8,000+', label: 'Smiles transformed' },
  { value: '3', label: 'Expert doctors' },
  { value: '98%', label: 'Patient satisfaction' },
]

const TESTIMONIALS = [
  {
    name: 'Priyanka Fernando',
    rating: 5,
    text: 'The most comfortable dental experience I have ever had. The studio is beautiful, the team is gentle, and my smile has never looked better.',
  },
  {
    name: 'Rohan Wickramasinghe',
    rating: 5,
    text: 'I was always anxious about dental visits. Lumora completely changed that. Professional, calm, and genuinely caring.',
  },
  {
    name: 'Ayesha Nizam',
    rating: 5,
    text: 'My veneers look absolutely natural. Dr. Perera understood exactly what I wanted. Highly recommend to anyone looking for cosmetic work.',
  },
]

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const dentistSchema = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  name: 'Lumora Dental Studio',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://lumoradental.lk',
  logo: '/logo.png',
  image: '/images/about-clinic.jpg',
  telephone: '+94 11 234 5678',
  email: 'hello@lumoradental.lk',
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '45 Bauddhaloka Mawatha',
    addressLocality: 'Colombo 07',
    addressCountry: 'LK',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '19:00',
    },
  ],
  medicalSpecialty: [
    'Cosmetic Dentistry',
    'Restorative Dentistry',
    'Preventive Dentistry',
    'Orthodontics',
    'Emergency Dental Care',
    'Family Dentistry',
  ],
  sameAs: [],
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dentistSchema) }}
      />
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#07162E] via-[#0D2C5C] to-[#123F84]" />

        {/* Subtle accent orb */}
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, #2F6FEE 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative text-center px-6 max-w-4xl mx-auto">
          {/* Eyebrow */}
          <p className="text-xs tracking-[0.5em] uppercase text-gold mb-6 animate-fade-in">
            Colombo's Premium Dental Studio
          </p>

          {/* Headline */}
          <h1 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-white mb-6 leading-none animate-fade-in"
            style={{ animationDelay: '0.1s' }}>
            Your Smile,
            <br />
            <span className="text-gold">Perfected.</span>
          </h1>

          {/* Subline */}
          <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in font-light"
            style={{ animationDelay: '0.2s' }}>
            Where clinical excellence meets aesthetic precision.
            Experience dentistry designed around your comfort and your vision.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
            style={{ animationDelay: '0.3s' }}>
            <Link href="/book"
              className="px-10 py-4 bg-gold text-white text-sm tracking-[0.2em] uppercase font-medium
                         hover:bg-gold-dark transition-all duration-300 flex items-center gap-3 justify-center">
              Book an Appointment
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/#services"
              className="px-10 py-4 border border-white/30 text-white text-sm tracking-[0.2em] uppercase font-medium
                         hover:border-gold hover:text-gold transition-all duration-300">
              Our Services
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ── STATS STRIP ────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-cream-dark">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="font-serif text-4xl text-gold">{s.value}</p>
              <p className="text-xs tracking-widest uppercase text-stone mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ───────────────────────────────────────────────────────── */}
      <section id="services" className="section bg-cream">
        <div className="section-container">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="text-xs tracking-[0.4em] uppercase text-gold mb-3">What We Offer</p>
              <h2 className="font-serif text-5xl text-stone-dark">Our Services</h2>
              <div className="gold-line" />
              <p className="text-stone mt-4 max-w-xl mx-auto leading-relaxed">
                Comprehensive dental care under one roof — from routine hygiene to complex smile transformations.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service, i) => (
              <ScrollReveal key={service.title} delay={i * 80}>
                <div className="service-card group h-full">
                  <div className="w-12 h-12 bg-cream-dark flex items-center justify-center mb-5 group-hover:bg-gold/10 transition-colors">
                    <service.icon className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="font-serif text-2xl text-stone-dark mb-3">{service.title}</h3>
                  <p className="text-stone text-sm leading-relaxed mb-5">{service.desc}</p>
                  <ul className="space-y-1.5">
                    {service.treatments.map(t => (
                      <li key={t} className="flex items-center gap-2 text-xs text-stone/70">
                        <span className="w-1 h-1 bg-gold rounded-full flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="text-center mt-12">
              <Link href="/book" className="btn-gold">
                Book a Consultation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── ABOUT ──────────────────────────────────────────────────────────── */}
      <section id="about" className="section bg-white">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            <ScrollReveal>
              <div className="relative">
                <div className="relative aspect-[4/5] bg-cream-dark overflow-hidden">
                  <Image
                    src="/images/about-clinic.jpg"
                    alt="Lumora Dental Studio clinic team"
                    width={1200}
                    height={1500}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
                {/* Accent frame */}
                <div className="absolute -bottom-4 -right-4 w-2/3 h-2/3 border border-gold/30 -z-10" />
              </div>
            </ScrollReveal>

            {/* Text */}
            <ScrollReveal delay={150}>
              <p className="text-xs tracking-[0.4em] uppercase text-gold mb-4">Our Story</p>
              <h2 className="font-serif text-5xl text-stone-dark mb-2 leading-tight">
                A Studio Built<br />for Your Smile
              </h2>
              <div className="w-12 h-px bg-gold my-6" />
              <p className="text-stone leading-relaxed mb-5">
                Founded over 15 years ago, Lumora Dental Studio was created with a singular belief — that dental care should feel as good as it looks. We combine the precision of modern dentistry with an environment designed to put even the most anxious patient at ease.
              </p>
              <p className="text-stone leading-relaxed mb-8">
                Our team of specialist dentists, hygienists and support staff are united by a commitment to continuing education, genuine patient care, and results that stand the test of time.
              </p>

              {/* Doctor cards */}
              <div className="space-y-4">
                {[
                  { name: 'Dr. W.A.K. Perera',  title: 'Principal Dentist & Cosmetic Specialist', exp: '20+ years' },
                  { name: 'Dr. Nimali Silva',    title: 'Oral Surgeon & Implantologist',           exp: '12 years' },
                  { name: 'Dr. Saman Perera',    title: 'Orthodontist',                            exp: '10 years' },
                ].map(doc => (
                  <div key={doc.name} className="flex items-center gap-4 p-4 bg-cream border border-cream-dark">
                    <div className="w-12 h-12 bg-gold/20 flex items-center justify-center flex-shrink-0 text-gold font-serif text-lg">
                      {doc.name.split(' ')[1][0]}
                    </div>
                    <div>
                      <p className="font-medium text-stone-dark text-sm">{doc.name}</p>
                      <p className="text-xs text-stone">{doc.title}</p>
                    </div>
                    <span className="ml-auto text-xs text-gold tracking-wide">{doc.exp}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="section bg-[#0B1F3A]">
        <div className="section-container">
          <ScrollReveal>
            <div className="text-center mb-14">
              <p className="text-xs tracking-[0.4em] uppercase text-gold mb-3">Patient Stories</p>
              <h2 className="font-serif text-5xl text-white">What Our Patients Say</h2>
              <div className="gold-line" />
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 100}>
                <div className="border border-white/10 p-8 hover:border-gold/40 transition-colors">
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-gold text-gold" />
                    ))}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                  <p className="text-gold text-xs tracking-widest uppercase">{t.name}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────────────── */}
      <section id="gallery" className="section bg-cream">
        <div className="section-container">
          <ScrollReveal>
            <div className="text-center mb-14">
              <p className="text-xs tracking-[0.4em] uppercase text-gold mb-3">Our Space</p>
              <h2 className="font-serif text-5xl text-stone-dark">The Studio</h2>
              <div className="gold-line" />
              <p className="text-stone mt-4 max-w-lg mx-auto">
                Designed to feel more like a luxury spa than a dental clinic.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {GALLERY_ITEMS.map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 60}>
                <div className={`bg-stone-light/20 flex items-end overflow-hidden group cursor-pointer
                  ${item.aspect === 'tall' ? 'row-span-2 aspect-[3/4]' : item.aspect === 'wide' ? 'aspect-[4/3]' : 'aspect-square'}`}>
                  <div className="w-full h-full bg-cream-dark relative">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      width={1200}
                      height={1200}
                      sizes="(min-width: 768px) 33vw, 50vw"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                      <p className="text-xs text-white tracking-widest uppercase text-center">{item.label}</p>
                    </div>
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gold/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────────────────────────────── */}
      <section id="contact" className="section bg-white">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            {/* Info */}
            <ScrollReveal>
              <p className="text-xs tracking-[0.4em] uppercase text-gold mb-3">Find Us</p>
              <h2 className="font-serif text-5xl text-stone-dark mb-2">Get in Touch</h2>
              <div className="w-12 h-px bg-gold my-6" />
              <p className="text-stone leading-relaxed mb-10">
                We would love to hear from you. Call, email, or drop in — our team is ready to help you take the first step towards a healthier, more beautiful smile.
              </p>

              <div className="space-y-6">
                {[
                  { icon: MapPin, label: 'Address',       value: '45 Bauddhaloka Mawatha, Colombo 07, Sri Lanka', href: null },
                  { icon: Phone,  label: 'Phone',         value: '+94 11 234 5678', href: 'tel:+94112345678' },
                  { icon: Mail,   label: 'Email',         value: 'hello@lumoradental.lk', href: 'mailto:hello@lumoradental.lk' },
                  { icon: Clock,  label: 'Opening Hours', value: 'Monday – Saturday  ·  9:00 AM – 7:00 PM', href: null },
                ].map(item => (
                  <div key={item.label} className="flex gap-4">
                    <div className="w-10 h-10 bg-cream-dark flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs tracking-widest uppercase text-stone/50 mb-1">{item.label}</p>
                      {item.href
                        ? <a href={item.href} className="text-stone-dark hover:text-gold transition-colors text-sm">{item.value}</a>
                        : <p className="text-stone-dark text-sm">{item.value}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link href="/book" className="btn-gold">
                  Book Online Now
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </ScrollReveal>

            {/* Map placeholder */}
            <ScrollReveal delay={150}>
              <div className="h-full min-h-[400px] bg-cream-dark flex items-center justify-center">
                <div className="text-center text-stone/40">
                  <MapPin className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-sm tracking-widest uppercase">Embed Google Map here</p>
                  <p className="text-xs mt-2">Replace with Google Maps iframe</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── BOOKING CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gold">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-5xl text-white mb-5">
              Ready to Transform Your Smile?
            </h2>
            <p className="text-white/80 mb-8 text-lg font-light leading-relaxed">
              Book your appointment today and take the first step towards the smile you deserve.
            </p>
            <Link href="/book"
              className="inline-flex items-center gap-3 px-12 py-5 bg-white text-gold text-sm
                         tracking-[0.2em] uppercase font-medium hover:bg-cream transition-colors">
              Book Your Appointment
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </>
  )
}

