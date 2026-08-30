import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { queueStatusForVisit, closeVisitsForPaidInvoice } from '@/lib/visit-sync'
import { can, isDoctorRole } from '@/lib/permissions'
import { toCents, fromCents } from '@/lib/money'
import { recordLedgerTx } from '@/lib/ledger'
import { determinePatientType, deductForVisit, alertLowStock } from '@/lib/inventory'
import { periodForTime, getOrCreateSession } from '@/lib/sessions'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

function genNumber(prefix: string) {
  return `${prefix}-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

async function latestDoctorStatus(doctorId: string) {
  return prisma.doctorStatusEvent.findFirst({
    where: { doctorId },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'clinical.visit')) {
    return NextResponse.json({ error: 'Only doctors can record visits' }, { status: 403 })
  }

  const body = await req.json()
  const {
    patientId, doctorId, branchId,
    chiefComplaint, examination, diagnosis,
    treatmentDone, nextVisitPlan, nextVisitDate, status,
    treatmentItems, futureTreatmentItems, completedPlanItemIds,
    prescription, payment, queueId, patientType: patientTypeOverride, nextAppointment, xray,
  } = body

  if (!patientId || !doctorId || !chiefComplaint) {
    return NextResponse.json({ error: 'patientId, doctorId and chiefComplaint are required' }, { status: 400 })
  }

  if (isDoctorRole(session.user.role)) {
    if (doctorId !== session.user.id) {
      return NextResponse.json({ error: 'Doctors can only record their own visits' }, { status: 403 })
    }

    if (queueId) {
      const queueItem = await prisma.receptionQueueItem.findUnique({
        where: { id: queueId },
        select: { status: true, assignedDoctorId: true },
      })
      if (
        !queueItem ||
        queueItem.status !== 'IN_CHAIR' ||
        (queueItem.assignedDoctorId && queueItem.assignedDoctorId !== session.user.id)
      ) {
        return NextResponse.json(
          { error: 'Receive this patient to chair from the doctor dashboard before recording treatment.' },
          { status: 409 }
        )
      }
    } else {
      const latestStatus = await latestDoctorStatus(session.user.id)
      if (latestStatus?.status !== 'READY') {
        return NextResponse.json(
          { error: 'Start your session before recording treatment.' },
          { status: 409 }
        )
      }
    }
  }

  // Adult/child determination drives which BOM is deducted — derived from
  // DOB, but the doctor can override it in the wizard.
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { dateOfBirth: true } })
  const patientType = patientTypeOverride || (patient ? determinePatientType(patient.dateOfBirth) : 'ADULT')

  // Generate visit number
  let visitNumber = genNumber('VIS')
  while (await prisma.visit.findUnique({ where: { visitNumber } })) {
    visitNumber = genNumber('VIS')
  }

  // Run everything in a transaction
  const result = await prisma.$transaction(async tx => {

    // 1. Create the visit
    const visit = await tx.visit.create({
      data: {
        visitNumber,
        patientId,
        doctorId,
        branchId:      branchId || null,
        chiefComplaint,
        examination:   examination || null,
        diagnosis:     diagnosis   || null,
        treatmentDone: treatmentDone || null,
        nextVisitPlan: nextVisitPlan || null,
        // KPI: follow-up adherence needs a date, not just the free-text plan.
        // Prefer the booked appointment; fall back to the doctor's stated date.
        nextVisitDate: nextAppointment?.startTime
          ? new Date(nextAppointment.startTime)
          : nextVisitDate ? new Date(nextVisitDate) : null,
        status:        status || 'IN_PROGRESS',
        completedAt:   status === 'READY_TO_PAY' || status === 'COMPLETED' ? new Date() : null,
        // End visit (step 8): finalizing at creation locks it immediately —
        // there is no separate "draft then finalize" edit step for a new visit
        lockedAt:      status === 'READY_TO_PAY' || status === 'COMPLETED' ? new Date() : null,
        patientType,
      },
    })

    if (queueId) {
      const queueStatus = queueStatusForVisit(visit.status)
      const queueItem = await tx.receptionQueueItem.findUnique({
        where: { id: queueId },
        select: { startedAt: true },
      })
      await tx.receptionQueueItem.update({
        where: { id: queueId },
        data: {
          visitId: visit.id,
          assignedDoctorId: doctorId,
          status: queueStatus,
          startedAt: queueItem?.startedAt ?? new Date(),
          finishedAt: queueStatus === 'COMPLETED' || queueStatus === 'PAID' ? new Date() : null,
        },
      })
    }

    // 1a. Attach X-ray to patient documents when the doctor uploads one.
    let xrayDocumentId: string | null = null
    if (xray?.file?.dataUrl) {
      const match = String(xray.file.dataUrl).match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        const mimeType = xray.file.mimeType || match[1] || 'application/octet-stream'
        const extFromName = path.extname(xray.file.fileName || '').toLowerCase()
        const ext = extFromName || (mimeType === 'application/pdf' ? '.pdf' : '.jpg')
        const safeName = `xray-${patientId}-${Date.now()}${ext}`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'xrays')
        await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, safeName), Buffer.from(match[2], 'base64'))

        const doc = await tx.patientDocument.create({
          data: {
            patientId,
            documentType: 'xray',
            title: `${xray.type || 'X-ray'}${xray.notes ? ` - ${xray.notes}` : ''}`,
            fileName: xray.file.fileName || safeName,
            fileUrl: `/uploads/xrays/${safeName}`,
            fileSize: xray.file.fileSize || null,
            mimeType,
            uploadedById: session.user.id,
          },
        })
        xrayDocumentId = doc.id
      }
    }

    // 1b. Silent override log: list price vs what the doctor actually charged.
    // Feeds the Admin price-override report; never shown as a "discount".
    if (treatmentItems?.length > 0) {
      const overrides = treatmentItems.filter((item: any) =>
        item.listPrice != null && toCents(item.listPrice) !== toCents(item.price))
      for (const item of overrides) {
        await tx.billOverride.create({
          data: {
            visitId:        visit.id,
            description:    item.description,
            toothNumbers:   item.toothNumber || null,
            listPriceCents: toCents(item.listPrice),
            chargedCents:   toCents(item.price),
            doctorId,
          },
        })
      }
    }

    // 2. Create prescription if provided
    let rxId: string | null = null
    if (prescription && prescription.items?.length > 0) {
      let rxNumber = genNumber('RX')
      while (await tx.prescription.findUnique({ where: { prescriptionNumber: rxNumber } })) {
        rxNumber = genNumber('RX')
      }
      const rx = await tx.prescription.create({
        data: {
          prescriptionNumber: rxNumber,
          patientId,
          doctorId,
          visitId: visit.id,
          notes: prescription.notes || null,
          items: {
            create: prescription.items.map((item: any) => ({
              drugName:     item.drugName,
              dose:         item.dose,
              frequency:    item.frequency,
              duration:     item.duration,
              instructions: item.instructions || null,
              quantity:     item.quantity ?? 1,
            })),
          },
        },
      })
      rxId = rx.id
    }

    // 3. Create invoice if payment provided
    let invoiceId: string | null = null
    if (payment && treatmentItems?.length > 0) {
      let invoiceNumber = genNumber('INV')
      while (await tx.invoice.findUnique({ where: { invoiceNumber } })) {
        invoiceNumber = genNumber('INV')
      }

      // All arithmetic in integer cents; float columns are legacy mirrors
      const subtotalCents = toCents(payment.subtotal ?? 0)
      const discountCents = toCents(payment.discount ?? 0)
      const totalCents    = payment.total != null ? toCents(payment.total) : subtotalCents
      const paidNowCents  = payment.type === 'full'
        ? toCents(payment.cash) + toCents(payment.card) + toCents(payment.transfer)
        : 0
      const balanceCents  = payment.type === 'full'
        ? Math.max(0, totalCents - paidNowCents)
        : totalCents

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          patientId,
          branchId:    branchId || null,
          currency:    'LKR',
          status:      payment.type === 'waive' && totalCents === 0 ? 'PAID' : 'SENT',
          subtotalCents,
          discountCents,
          taxCents:        0,
          totalCents,
          amountPaidCents: paidNowCents,
          balanceCents,
          subtotal:   fromCents(subtotalCents), // legacy mirrors
          discount:   fromCents(discountCents),
          tax:        0,
          total:      fromCents(totalCents),
          amountPaid: fromCents(paidNowCents),
          balance:    fromCents(balanceCents),
          notes:       payment.notes || null,
          items: {
            create: treatmentItems.map((item: any) => ({
              description:  item.description,
              toothNumbers: item.toothNumber || null,
              feeId:        item.feeId || null,   // KPI: catalog linkage
              quantity:     1,
              unitPriceCents: toCents(item.price),
              totalCents:     toCents(item.price),
              unitPrice:    fromCents(toCents(item.price)),
              total:        fromCents(toCents(item.price)),
            })),
          },
        },
      })
      invoiceId = invoice.id

      // Link visit to invoice
      await tx.visitInvoice.create({
        data: { visitId: visit.id, invoiceId: invoice.id },
      })

      // Record payment if full payment
      if (payment.type === 'full' && paidNowCents > 0) {
        const methods = [
          { method: 'cash',          amountCents: toCents(payment.cash)     },
          { method: 'card',          amountCents: toCents(payment.card)     },
          { method: 'bank_transfer', amountCents: toCents(payment.transfer) },
        ].filter(m => m.amountCents > 0)

        for (const m of methods) {
          const created = await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amountCents: m.amountCents,
              amount:    fromCents(m.amountCents), // legacy mirror
              currency:  'LKR',
              method:    m.method,
              processedById: session.user.id,
            },
          })
          await recordLedgerTx(tx, {
            direction:        'IN',
            amountCents:      m.amountCents,
            categoryCode:     'PATIENT_PAYMENT',
            branchId:         branchId || null,
            recordedByUserId: session.user.id,
            refType:          'payment',
            refId:            created.id,
          })
        }

        // Update invoice if fully paid, then close the visit and queue item
        // so the patient doesn't linger in the payment/reception queues
        if (paidNowCents >= totalCents) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data:  { status: 'PAID', paidDate: new Date(), balanceCents: 0, balance: 0 },
          })
          await closeVisitsForPaidInvoice(tx, invoice.id)
        }
      }

      // Create installment plan if installment payment
      if (payment.type === 'installment' && payment.installments) {
        const schedule = Object.entries(payment.installments.schedule ?? {})
          .map(([number, amount]) => ({
            number: Number(number),
            amountCents: toCents(Number(amount) || 0),
          }))
          .filter(item => item.number > 0 && item.amountCents > 0)
          .sort((a, b) => a.number - b.number)

        const perInstallmentCents = schedule[0]?.amountCents
          ?? toCents(payment.installments.amountPerInstallment)

        await tx.installmentPlan.create({
          data: {
            invoiceId:  invoice.id,
            patientId,
            totalAmountCents: toCents(payment.installments.total),
            totalAmount: fromCents(toCents(payment.installments.total)), // legacy mirror
            numberOfInstallments: payment.installments.numberOfInstallments,
            amountPerInstallmentCents: perInstallmentCents,
            amountPerInstallment: fromCents(perInstallmentCents),
            createdById: session.user.id,
            installments: {
              create: schedule.map(item => ({
                number: item.number,
                amountCents: item.amountCents,
                amount: fromCents(item.amountCents),
              })),
            },
          },
        })
      }
    }

    // 4. Save future visit plan as structured treatment-plan items.
    if (futureTreatmentItems?.length > 0) {
      const totalFeeCents = futureTreatmentItems.reduce(
        (sum: number, item: any) => sum + toCents(Number(item.price) || 0), 0)

      await tx.treatmentPlan.create({
        data: {
          patientId,
          createdById: session.user.id,
          title: `Next visit plan from ${visitNumber}`,
          description: nextVisitPlan || null,
          totalFeeCents,
          patientPortionCents: totalFeeCents,
          totalFee: fromCents(totalFeeCents), // legacy mirrors
          patientPortion: fromCents(totalFeeCents),
          status: 'PLANNED',
          items: {
            create: futureTreatmentItems.map((item: any, index: number) => ({
              procedureName: item.description,
              toothNumbers:  item.tooth || null,
              feeId:         item.feeId || null,   // KPI: catalog linkage
              feeCents:        toCents(Number(item.price) || 0),
              patientEstCents: toCents(Number(item.price) || 0),
              fee:           Number(item.price) || 0,
              patientEst:    Number(item.price) || 0,
              status:        'PLANNED',
              sequence:      item.sequence ?? index + 1,
            })),
          },
        },
      })
    }

    // 4b. Schedule only the immediate next appointment requested by the doctor.
    let nextAppointmentId: string | null = null
    if (nextAppointment?.startTime && branchId) {
      const startTime = new Date(nextAppointment.startTime)
      const durationMins = Number(nextAppointment.durationMins) || 30
      const endTime = new Date(startTime.getTime() + durationMins * 60 * 1000)
      const period = periodForTime(startTime)
      if (!period) throw new Error('Next appointment must be inside clinic sessions: 9:00-14:00 or 16:00-21:00.')

      const conflict = await tx.appointment.findFirst({
        where: {
          providerId: doctorId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          OR: [
            { startTime: { gte: startTime, lt: endTime } },
            { endTime:   { gt: startTime, lte: endTime } },
            { startTime: { lte: startTime }, endTime: { gte: endTime } },
          ],
        },
        select: { appointmentNumber: true },
      })
      if (conflict) throw new Error(`Next appointment conflicts with ${conflict.appointmentNumber}. Choose another time.`)

      const clinicSession = await getOrCreateSession(tx, branchId, startTime, period)
      const selectedTreatmentText = Array.isArray(nextAppointment.treatmentItems) && nextAppointment.treatmentItems.length > 0
        ? nextAppointment.treatmentItems
            .map((item: any) => `${item.description}${item.tooth ? ` (T${item.tooth})` : ''}`)
            .join(', ')
        : null
      let appointmentNumber = genNumber('APT')
      while (await tx.appointment.findUnique({ where: { appointmentNumber } })) {
        appointmentNumber = genNumber('APT')
      }

      const appointment = await tx.appointment.create({
        data: {
          appointmentNumber,
          patientId,
          providerId: doctorId,
          branchId,
          type: nextAppointment.type || 'FOLLOW_UP',
          status: 'SCHEDULED',
          bookingSource: 'RECEPTIONIST',
          startTime,
          endTime,
          durationMins,
          reason: nextAppointment.reason || nextVisitPlan || 'Follow-up treatment',
          notes: [
            `Booked by doctor during visit ${visitNumber}. Only the immediate next session was scheduled.`,
            selectedTreatmentText ? `Selected treatment: ${selectedTreatmentText}` : null,
          ].filter(Boolean).join('\n'),
          sessionId: clinicSession.id,
          slotKind: 'APPOINTMENT',
        },
      })
      nextAppointmentId = appointment.id
    }

    // 5. Mark selected previous-plan items completed when they are done in this visit.
    if (completedPlanItemIds?.length > 0) {
      await tx.treatmentPlanItem.updateMany({
        where: {
          id: { in: completedPlanItemIds },
          plan: { patientId },
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          // KPI: naming the visit that closed the item makes "average visits to
          // complete a plan" an exact count rather than a date-range guess.
          completedVisitId: visit.id,
        },
      })
    }

    // 6. Update patient last visit date
    await tx.patient.update({
      where: { id: patientId },
      data:  { lastVisitDate: new Date() },
    })

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        userId:     session.user.id,
        patientId,
        action:     'CREATE',
        resource:   'visit',
        resourceId: visit.id,
        details:    {
          visitNumber,
          status,
          invoiceId,
          rxId,
          queueId: queueId || null,
          nextAppointmentId,
          xray: xray ? {
            requested: !!xray.requested,
            taken: !!xray.taken,
            type: xray.type || null,
            charge: xray.charge || 0,
            documentId: xrayDocumentId,
          } : null,
        },
      },
    })

    // 8. Auto-deduct inventory for treatments performed today. Never blocks
    // the clinical save — deductForVisit swallows its own errors.
    let lowStockCrossed: { itemName: string; branchId: string; newQuantity: number; threshold: number }[] = []
    if (branchId && treatmentItems?.length > 0) {
      lowStockCrossed = await deductForVisit(tx, {
        branchId, visitId: visit.id, patientType,
        userId: session.user.id, treatmentItems,
      })
    }

    return { visitId: visit.id, visitNumber, invoiceId, rxId, lowStockCrossed }
  })

  // Fire low-stock SMS alerts outside the transaction (network call)
  for (const c of result.lowStockCrossed) {
    await alertLowStock(prisma, c.branchId, c.itemName, c.newQuantity, c.threshold)
  }

  // Visit is saved — the nurse-assist diagnosis draft (if any) has served its
  // purpose and would otherwise resurface stale findings on a future visit.
  if (queueId) {
    await prisma.diagnosisDraft.deleteMany({ where: { queueItemId: queueId } }).catch(() => {})
  }

  return NextResponse.json(result, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const status    = searchParams.get('status')
  const today     = searchParams.get('today')

  const where: any = {}
  if (patientId) where.patientId = patientId
  if (status)    where.status    = status
  if (today === 'true') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    where.visitDate = { gte: start, lte: end }
  }

  const visits = await prisma.visit.findMany({
    where,
    orderBy: { visitDate: 'desc' },
    take: 50,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
      doctor:  { select: { id: true, name: true } },
      branch:  { select: { name: true } },
      invoices: { include: { invoice: { include: { installmentPlan: { include: { installments: true } } } } } },
      prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  return NextResponse.json(visits)
}
