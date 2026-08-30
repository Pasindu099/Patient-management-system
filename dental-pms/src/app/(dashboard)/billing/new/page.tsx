import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NewInvoiceForm } from '@/components/billing/NewInvoiceForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'New Invoice' }

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  await auth()
  const params = await searchParams

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  // Pre-fill patient if coming from patient profile
  let patient = null
  if (params.patientId) {
    patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
      select: { id: true, firstName: true, lastName: true, patientNumber: true, nicNumber: true },
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/billing" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to billing
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">New invoice</h1>
        <p className="text-base text-gray-500 mt-1">Create an invoice for a patient visit or treatment.</p>
      </div>

      <NewInvoiceForm branches={branches} prefilledPatient={patient} />
    </div>
  )
}
