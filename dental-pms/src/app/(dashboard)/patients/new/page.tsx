import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { NewPatientForm } from '@/components/patients/NewPatientForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Register New Patient' }

export default async function NewPatientPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'patients.manage')) redirect('/dashboard')
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-base text-gray-500
                   hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to patients
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Register new patient</h1>
        <p className="text-base text-gray-500 mt-1">
          Fill in the patient's details below. Fields marked * are required.
        </p>
      </div>

      <NewPatientForm />
    </div>
  )
}
