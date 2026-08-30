import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import {
  ChevronLeft, Phone, MessageCircle,
  MapPin, Clock, User, Calendar,
  AlertTriangle, CheckCircle,
} from 'lucide-react'
import {
  formatDate, formatTime, formatDateTime, cn,
  APPOINTMENT_TYPE_LABELS, BOOKING_SOURCE_LABELS,
  BOOKING_SOURCE_COLORS, APPOINTMENT_STATUS_COLORS,
} from '@/lib/utils'
import { AppointmentActions } from '@/components/appointments/AppointmentActions'
import type { Metadata } from 'next'

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const a = await prisma.appointment.findUnique({
    where: { id },
    select: { appointmentNumber: true },
  })
  return { title: a?.appointmentNumber ?? 'Appointment' }
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient:  { include: { medicalHistory: { select: { allergies: true } } } },
      provider: { select: { id: true, name: true, role: true } },
      branch:   true,
      clinicalNotes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!appt) notFound()

  const allergies = (appt.patient.medicalHistory?.allergies as any[]) ?? []
  const statusColors = APPOINTMENT_STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-600'
  const isHighRisk = (appt.noShowRisk ?? 0) > 0.3

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      <Link href="/appointments" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to appointments
      </Link>

      {/* Allergy warning */}
      {allergies.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border-2 border-red-500 rounded-xl px-5 py-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-red-900">Allergy Alert</p>
            <p className="text-sm text-red-700">
              {(allergies as any[]).map((a: any) => `${a.substance} (${a.severity})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="section-card">
        <div className="section-card-header">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{appt.appointmentNumber}</h1>
              <span className={cn('text-sm font-semibold px-3 py-1 rounded-full', statusColors)}>
                {appt.status}
              </span>
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                BOOKING_SOURCE_COLORS[appt.bookingSource] ?? 'bg-gray-100 text-gray-600'
              )}>
                {BOOKING_SOURCE_LABELS[appt.bookingSource] ?? appt.bookingSource}
              </span>
            </div>
            <p className="text-base text-gray-500 mt-1">
              {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
            </p>
          </div>
          <AppointmentActions
            appointmentId={appt.id}
            currentStatus={appt.status}
            startTime={appt.startTime.toISOString()}
          />
        </div>

        <div className="section-card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Patient */}
          <InfoBlock icon={User} label="Patient">
            <Link href={`/patients/${appt.patient.id}`}
                  className="text-base font-semibold text-blue-600 hover:underline">
              {appt.patient.firstName} {appt.patient.lastName}
            </Link>
            <p className="text-sm text-gray-500">{appt.patient.patientNumber}</p>
            {appt.patient.nicNumber && (
              <p className="text-sm text-gray-500">NIC: {appt.patient.nicNumber}</p>
            )}
            <div className="flex gap-2 mt-2">
              {appt.patient.phone && (
                <>
                  <a href={`tel:${appt.patient.phone}`}
                     className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
                    <Phone className="w-4 h-4" />{appt.patient.phone}
                  </a>
                  <a href={`https://wa.me/${appt.patient.phone.replace(/\D/g,'')}`}
                     target="_blank"
                     className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800">
                    <MessageCircle className="w-4 h-4" />WhatsApp
                  </a>
                </>
              )}
            </div>
          </InfoBlock>

          {/* Time */}
          <InfoBlock icon={Clock} label="Date & time">
            <p className="text-base font-semibold text-gray-900">{formatDate(appt.startTime, 'EEEE, d MMMM yyyy')}</p>
            <p className="text-base text-gray-700">
              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
              <span className="text-gray-500"> ({appt.durationMins} min)</span>
            </p>
            {isHighRisk && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                <AlertTriangle className="w-3 h-3" />
                No-show risk {Math.round((appt.noShowRisk ?? 0) * 100)}%
              </span>
            )}
          </InfoBlock>

          {/* Provider */}
          <InfoBlock icon={Calendar} label="Provider">
            <p className="text-base font-semibold text-gray-900">{appt.provider.name}</p>
            <p className="text-sm text-gray-500">{appt.chair ?? 'No chair assigned'}</p>
          </InfoBlock>

          {/* Branch */}
          <InfoBlock icon={MapPin} label="Branch">
            <p className="text-base font-semibold text-gray-900">{appt.branch.name}</p>
            {appt.branch.address && <p className="text-sm text-gray-500">{appt.branch.address}</p>}
            {appt.branch.phone && (
              <a href={`tel:${appt.branch.phone}`} className="text-sm text-blue-600">{appt.branch.phone}</a>
            )}
          </InfoBlock>

          {/* Reason */}
          {appt.reason && (
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-gray-500 mb-1">Reason for visit</p>
              <p className="text-base text-gray-900 bg-gray-50 rounded-xl px-4 py-3">{appt.reason}</p>
            </div>
          )}

          {/* Confirmation */}
          {appt.confirmedAt && (
            <InfoBlock icon={CheckCircle} label="Confirmed">
              <p className="text-base text-gray-900">{formatDateTime(appt.confirmedAt)}</p>
              {appt.confirmedBy && <p className="text-sm text-gray-500">via {appt.confirmedBy}</p>}
            </InfoBlock>
          )}
        </div>
      </div>

      {/* Clinical notes */}
      {appt.clinicalNotes.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">Clinical notes</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {appt.clinicalNotes.map(note => (
              <div key={note.id} className="px-6 py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-500 uppercase">{note.noteType}</span>
                  <span className="text-sm text-gray-400">{note.author.name} · {formatDateTime(note.createdAt)}</span>
                </div>
                {note.content && <p className="text-base text-gray-700">{note.content}</p>}
                {note.subjective && (
                  <div className="text-sm text-gray-700 space-y-1">
                    {note.subjective && <p><strong>S:</strong> {note.subjective}</p>}
                    {note.objective  && <p><strong>O:</strong> {note.objective}</p>}
                    {note.assessment && <p><strong>A:</strong> {note.assessment}</p>}
                    {note.plan       && <p><strong>P:</strong> {note.plan}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBlock({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  )
}
