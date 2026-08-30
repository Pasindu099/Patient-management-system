import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { VisitForm } from '@/components/visits/VisitForm'
import { DoctorMedicalHistoryPanel } from '@/components/patients/DoctorMedicalHistoryPanel'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { getAge, getPatientDisplayName, formatDate } from '@/lib/utils'
import { formatCents } from '@/lib/money'
import type { Metadata } from 'next'
import { can, DOCTOR_ROLES, isDoctorRole } from '@/lib/permissions'
import { getOrCreateSession, periodForTime } from '@/lib/sessions'

export const metadata: Metadata = { title: 'New Visit' }

interface Props {
  searchParams: Promise<{ patientId?: string; queueId?: string }>
}

function generatePatientNumber() {
  const num = String(Math.floor(Math.random() * 900000) + 100000)
  return `PT-${num}`
}

async function uniquePatientNumber() {
  let patientNumber = generatePatientNumber()
  for (let attempt = 0; attempt < 10; attempt++) {
    const exists = await prisma.patient.findUnique({ where: { patientNumber } })
    if (!exists) return patientNumber
    patientNumber = generatePatientNumber()
  }
  return patientNumber
}

function splitQueueName(queueItem: any) {
  const rawName = (
    queueItem.displayName ||
    [queueItem.intakeSubmission?.firstName, queueItem.intakeSubmission?.lastName].filter(Boolean).join(' ')
  ).trim()
  if (!rawName) return { firstName: `Token ${queueItem.queueNumber}`, lastName: 'Patient' }
  const parts = rawName.split(/\s+/)
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Patient',
  }
}

async function createTemporaryPatientForQueue(queueItem: any, userId: string) {
  const patientNumber = await uniquePatientNumber()
  const { firstName, lastName } = splitQueueName(queueItem)
  const phone = queueItem.contactPhone || 'Pending'

  const result = await prisma.$transaction(async tx => {
    const patient = await tx.patient.create({
      data: {
        patientNumber,
        firstName,
        lastName,
        dateOfBirth: new Date('1900-01-01T00:00:00.000Z'),
        gender: 'PREFER_NOT_TO_SAY',
        phone,
        notes: 'Temporary profile created from queue token. Reception should complete the paper form later.',
        firstVisitDate: new Date(),
        medicalHistory: {
          create: {
            allergies: [],
            medications: [],
            conditions: [{
              condition: 'Profile pending',
              status: 'PENDING',
              notes: { source: 'QUEUE_TOKEN', queueItemId: queueItem.id },
            }],
          },
        },
      },
    })

    await tx.receptionQueueItem.update({
      where: { id: queueItem.id },
      data: {
        patientId: patient.id,
        displayName: `${firstName} ${lastName}`.trim(),
        contactPhone: phone,
        intakeStatus: 'PAPER_PENDING',
        patientType: queueItem.patientType === 'EXISTING' ? 'EXISTING' : 'NEW',
      },
    })

    await tx.intakeSubmission.upsert({
      where: { queueItemId: queueItem.id },
      create: {
        branchId: queueItem.branchId,
        queueItemId: queueItem.id,
        matchedPatientId: patient.id,
        tokenNumber: queueItem.queueNumber,
        source: 'TEMP_PROFILE',
        patientType: queueItem.patientType === 'EXISTING' ? 'EXISTING' : 'NEW',
        reviewStatus: 'PENDING',
        firstName,
        lastName,
        phone,
        reason: queueItem.reason,
        rawData: { createdFrom: 'doctor_start_visit', queueItemId: queueItem.id },
      },
      update: {
        matchedPatientId: patient.id,
        reviewStatus: 'PENDING',
        firstName,
        lastName,
        phone,
        reason: queueItem.reason,
      },
    })

    await tx.auditLog.create({
      data: {
        userId,
        patientId: patient.id,
        action: 'CREATE',
        resource: 'temporary_patient_from_queue',
        resourceId: patient.id,
        details: { queueItemId: queueItem.id, queueNumber: queueItem.queueNumber, patientNumber },
      },
    })

    return patient
  })

  return result
}

async function latestDoctorStatus(doctorId: string) {
  return prisma.doctorStatusEvent.findFirst({
    where: { doctorId },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
  })
}

async function ensureDirectTreatmentQueue(patientId: string, doctorId: string) {
  const existing = await prisma.receptionQueueItem.findFirst({
    where: {
      patientId,
      assignedDoctorId: doctorId,
      status: 'IN_CHAIR',
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const branch =
    await prisma.userBranch.findFirst({
      where: { userId: doctorId },
      orderBy: { isPrimary: 'desc' },
      select: { branchId: true },
    }) ??
    await prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    }).then(row => row ? { branchId: row.id } : null)

  if (!branch?.branchId) redirect('/dashboard')

  const now = new Date()
  const period = periodForTime(now)
  const clinicSession = period ? await getOrCreateSession(prisma, branch.branchId, now, period) : null
  const lastQueueItem = await prisma.receptionQueueItem.findFirst({
    where: clinicSession
      ? { sessionId: clinicSession.id }
      : { branchId: branch.branchId, status: { in: ['CHECKED_IN', 'ASSIGNED', 'IN_CHAIR'] } },
    orderBy: { queueNumber: 'desc' },
    select: { queueNumber: true },
  })

  const item = await prisma.receptionQueueItem.create({
    data: {
      patientId,
      branchId: branch.branchId,
      assignedDoctorId: doctorId,
      calledById: doctorId,
      sessionId: clinicSession?.id ?? null,
      queueNumber: (lastQueueItem?.queueNumber ?? 0) + 1,
      status: 'IN_CHAIR',
      source: 'FOLLOW_UP',
      patientType: 'EXISTING',
      intakeStatus: 'MATCHED',
      priority: 100,
      calledAt: now,
      startedAt: now,
    },
    select: { id: true, queueNumber: true },
  })

  await prisma.doctorStatusEvent.create({
    data: {
      doctorId,
      branchId: branch.branchId,
      queueItemId: item.id,
      status: 'WITH_PATIENT',
      note: `Direct patient treatment started`,
    },
  })

  return item.id
}

export default async function NewVisitPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'clinical.visit')) redirect('/queue')
  const params = await searchParams

  if (!params.patientId && !params.queueId) redirect('/visits')

  if (isDoctorRole(session.user.role)) {
    if (params.queueId) {
      const queueItem = await prisma.receptionQueueItem.findUnique({
        where: { id: params.queueId },
        select: { status: true, assignedDoctorId: true },
      })
      if (
        !queueItem ||
        queueItem.status !== 'IN_CHAIR' ||
        (queueItem.assignedDoctorId && queueItem.assignedDoctorId !== session.user.id)
      ) {
        redirect('/dashboard')
      }
    } else {
      const latestStatus = await latestDoctorStatus(session.user.id)
      if (latestStatus?.status !== 'READY') redirect('/dashboard')
      if (params.patientId) {
        const queueId = await ensureDirectTreatmentQueue(params.patientId, session.user.id)
        redirect(`/visits/new?patientId=${params.patientId}&queueId=${queueId}`)
      }
    }
  }

  if (!params.patientId && params.queueId) {
    const queueItem = await prisma.receptionQueueItem.findUnique({
      where: { id: params.queueId },
      include: {
        patient: { select: { id: true } },
        assignedDoctor: { select: { id: true, name: true } },
        intakeSubmission: {
          select: {
            firstName: true,
            lastName: true,
            reason: true,
            allergies: true,
            medicalWarnings: true,
          },
        },
      },
    })
    if (!queueItem) notFound()
    if (queueItem.patient?.id) redirect(`/visits/new?patientId=${queueItem.patient.id}&queueId=${queueItem.id}`)
    const patient = await createTemporaryPatientForQueue(queueItem, session.user.id)
    redirect(`/visits/new?patientId=${patient.id}&queueId=${queueItem.id}`)
  }

  const patient = await prisma.patient.findUnique({
    where: { id: params.patientId!, deletedAt: null },
    include: {
      medicalHistory: true,
      visits: {
        orderBy: { visitDate: 'desc' },
        take: 3,
        include: {
          doctor: { select: { name: true } },
          prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      treatmentPlans: {
        where: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          items:  { some: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
          items: {
            where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
            orderBy: [{ phase: 'asc' }, { sequence: 'asc' }],
          },
        },
      },
    },
  })

  if (!patient) notFound()

  // Step 1 "Review history": outstanding balance across all unpaid invoices
  const balanceAgg = await prisma.invoice.aggregate({
    where: { patientId: patient.id, balanceCents: { gt: 0 }, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
    _sum: { balanceCents: true },
  })
  const outstandingBalanceCents = balanceAgg._sum.balanceCents ?? 0

  const doctors = await prisma.user.findMany({
    where: { isActive: true, role: { in: [...DOCTOR_ROLES] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  })

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  const fees = await prisma.treatmentFee.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, category: true, subcategory: true, name: true, priceCents: true },
  })

  const allergies = (patient.medicalHistory?.allergies as any[]) ?? []
  const lastVisit = patient.visits[0]
  const queueItem = params.queueId
    ? await prisma.receptionQueueItem.findUnique({
        where: { id: params.queueId },
        select: { id: true, assignedDoctorId: true, branchId: true, reason: true },
      })
    : null
  const pendingPlanItems = patient.treatmentPlans.flatMap(plan =>
    plan.items.map(item => ({
      id: item.id,
      sourcePlanItemId: item.id,
      description: item.procedureName,
      tooth: item.toothNumbers ?? '',
      price: item.fee,
    }))
  )

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      <Link href="/visits" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back
      </Link>

      {/* Allergy alert */}
      {allergies.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border-2 border-red-500 rounded-xl px-5 py-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-red-900">⚠️ Allergy Alert</p>
            <p className="text-base text-red-700">
              {allergies.map((a: any) => `${a.substance} — ${a.reaction}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 1: REVIEW HISTORY (read-only, opens automatically) ───────── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">1. Review history</p>

      <div className="section-card">
        <div className="section-card-body">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getPatientDisplayName(patient)}</h1>
              <p className="text-base text-gray-500">
                {patient.patientNumber} · {getAge(patient.dateOfBirth)} yrs · {patient.gender}
                {patient.nicNumber ? ` · NIC: ${patient.nicNumber}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {outstandingBalanceCents > 0 && (
                <span className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                  Owes {formatCents(outstandingBalanceCents)}
                </span>
              )}
              <Link href={`/patients/${patient.id}`} className="btn-secondary !text-sm !px-3 !py-2">
                Full profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      <DoctorMedicalHistoryPanel patient={patient} />

      {/* Active treatment plan progress */}
      {patient.treatmentPlans.length > 0 && (
        <div className="section-card border-2 border-amber-200 bg-amber-50">
          <div className="section-card-header bg-amber-100">
            <h2 className="text-base font-bold text-amber-900">Active treatment plan</h2>
          </div>
          <div className="section-card-body space-y-2 text-sm">
            {patient.treatmentPlans.map(plan => (
              <div key={plan.id}>
                <p className="font-semibold text-amber-900">{plan.title}</p>
                <ul className="mt-1 space-y-1">
                  {plan.items.map(item => (
                    <li key={item.id} className="flex justify-between text-gray-700">
                      <span>{item.procedureName}{item.toothNumbers ? ` (T${item.toothNumbers})` : ''}</span>
                      <span className="text-xs font-semibold text-amber-700 uppercase">{item.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last visit summary — most important for the doctor */}
      {lastVisit && (
        <div className="section-card border-2 border-blue-200 bg-blue-50">
          <div className="section-card-header bg-blue-100">
            <h2 className="text-base font-bold text-blue-900">Last visit — {formatDate(lastVisit.visitDate)}</h2>
            <span className="text-sm text-blue-600">Dr. {lastVisit.doctor.name}</span>
          </div>
          <div className="section-card-body space-y-2 text-sm">
            {lastVisit.chiefComplaint && (
              <div className="flex gap-2">
                <span className="font-semibold text-blue-700 w-28 flex-shrink-0">Complaint</span>
                <span className="text-gray-800">{lastVisit.chiefComplaint}</span>
              </div>
            )}
            {lastVisit.diagnosis && (
              <div className="flex gap-2">
                <span className="font-semibold text-blue-700 w-28 flex-shrink-0">Diagnosis</span>
                <span className="text-gray-800">{lastVisit.diagnosis}</span>
              </div>
            )}
            {lastVisit.treatmentDone && (
              <div className="flex gap-2">
                <span className="font-semibold text-blue-700 w-28 flex-shrink-0">Treatment done</span>
                <span className="text-gray-800">{lastVisit.treatmentDone}</span>
              </div>
            )}
            {lastVisit.nextVisitPlan && (
              <div className="flex gap-2">
                <span className="font-semibold text-blue-700 w-28 flex-shrink-0">Plan for today</span>
                <span className="text-gray-800 font-semibold">{lastVisit.nextVisitPlan}</span>
              </div>
            )}
            {lastVisit.prescriptions[0] && (
              <div className="flex gap-2">
                <span className="font-semibold text-blue-700 w-28 flex-shrink-0">Prescribed</span>
                <span className="text-gray-800">
                  {lastVisit.prescriptions[0].items.map(i => i.drugName).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visit form */}
      <VisitForm
        patient={JSON.parse(JSON.stringify(patient))}
        doctors={doctors}
        branches={branches}
        fees={fees}
        currentUser={session.user}
        defaultDoctorId={queueItem?.assignedDoctorId || (isDoctorRole(session.user.role) ? session.user.id : doctors[0]?.id ?? '')}
        pendingPlanItems={pendingPlanItems}
        queueId={queueItem?.id}
        defaultBranchId={queueItem?.branchId}
        defaultComplaint={queueItem?.reason ?? undefined}
      />
    </div>
  )
}
