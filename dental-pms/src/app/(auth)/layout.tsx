import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg shadow-blue-900/40 p-3">
            <Image src="/logo-icon.png" alt="Lumora Dental Studio"
              width={80} height={80} priority className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">LUMORA</h1>
          <p className="text-slate-400 text-base mt-1">Dental Studio · Practice Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Need help? WhatsApp support:{' '}
          <a
            href="https://wa.me/4915257666032"
            target="_blank"
            rel="noreferrer"
            className="text-slate-300 hover:text-white underline-offset-4 hover:underline"
          >
            +49 152 57666032
          </a>
        </p>
      </div>
    </div>
  )
}
