// Practice KPI engine — ADMIN ONLY.
//
// Every figure here is an aggregate across many patients and bills. Nothing in
// this module may be surfaced to a DOCTOR, HEAD_NURSE, NURSE or RECEPTIONIST
// session; callers gate on the 'kpi.admin' permission before invoking.
//
// Money is integer cents throughout (v2 convention). Where a legacy Float
// mirror is the only populated column on old rows, we fall back to it via
// `centsOf()` so historical periods do not silently report zero.
//
// Attribution model: a doctor "owns" revenue through the visit they ran —
// Visit.doctorId → VisitInvoice → Invoice → Payment. Invoices raised outside a
// visit (standalone billing) have no doctor and are reported separately as
// `unattributed` rather than being silently dropped or spread around.

import { prisma } from './prisma'

export interface KpiRange {
  from: Date
  to: Date
  branchId?: string
}

// Prefer the authoritative cents column; fall back to the legacy float mirror
// for rows written before the cents migration.
function centsOf(cents: number | null | undefined, legacy: number | null | undefined): number {
  if (cents) return cents
  return legacy ? Math.round(legacy * 100) : 0
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function avg(total: number, count: number): number {
  if (count <= 0) return 0
  return Math.round(total / count)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// ─── SHAPES ───────────────────────────────────────────────────────────────────

export interface DoctorKpi {
  doctorId: string
  doctorName: string

  // Financial
  billedCents: number
  collectedCents: number
  outstandingCents: number
  collectionRate: number | null       // collected / billed, %
  listPriceCents: number              // what the catalog said these lines cost
  discountCents: number               // list − charged, from BillOverride
  discountRate: number | null
  revenuePerVisitCents: number
  revenuePerPatientCents: number
  revenueByCategory: { label: string; cents: number; coded: boolean }[]

  // Quoting / conversion
  quotedItems: number
  quotedCents: number
  convertedItems: number
  convertedCents: number
  quoteConversionRate: number | null   // by item count
  quoteValueConversionRate: number | null

  // Productivity
  visits: number
  uniquePatients: number
  newPatients: number
  proceduresByCategory: { label: string; count: number; coded: boolean }[]
  chairMinutes: number
  avgChairMinutes: number | null
  scheduledMinutes: number             // only for appointment-sourced visits
  chairUtilisation: number | null      // actual / scheduled, %

  // Treatment plans
  planItemsPlanned: number
  planItemsCompleted: number
  planCompletionRate: number | null
  avgVisitsPerCompletedPlan: number | null
  avgDaysPlanToCompletion: number | null

  // Retention
  followUpsDue: number
  followUpsKept: number
  followUpAdherence: number | null
  returningPatients: number
  patientReturnRate: number | null      // returned to *this* doctor, %
  noShows: number
  cancellations: number
  scheduledAppointments: number
  noShowRate: number | null

  // Quality (advisory — see caveats in the API response)
  retreatments: number
  retreatmentRate: number | null
  prescriptions: number
  prescriptionItems: number
  prescriptionsPerVisit: number | null
}

export interface KpiResult {
  range: { from: string; to: string; branchId: string | null }
  doctors: DoctorKpi[]
  clinic: {
    billedCents: number
    collectedCents: number
    outstandingCents: number
    collectionRate: number | null
    visits: number
    uniquePatients: number
    newPatients: number
    unattributed: { invoices: number; billedCents: number; collectedCents: number }
  }
  coverage: {
    // What share of the underlying rows carry the KPI linkage columns. Low
    // coverage means category splits are grouped by free text, not catalog
    // category — the UI shows this so a thin number is never read as fact.
    invoiceLinesCoded: number | null
    planItemsCoded: number | null
    planItemsVisitLinked: number | null
    visitsWithNextVisitDate: number | null
  }
}

// Window, in months, in which repeat work on the same tooth counts as a
// re-treatment. Deliberately conservative.
const RETREATMENT_WINDOW_MONTHS = 6

// ─── ENGINE ───────────────────────────────────────────────────────────────────

export async function computeKpis({ from, to, branchId }: KpiRange): Promise<KpiResult> {
  const branchWhere = branchId ? { branchId } : {}

  const [doctors, visits, standaloneInvoices, plans, appointments, prescriptions, priorVisits] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: 'DOCTOR' },
        select: { id: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
      }),

      // The spine: every visit in range, with its bill, its chair timings and
      // the plan items it closed.
      prisma.visit.findMany({
        where: { visitDate: { gte: from, lte: to }, ...branchWhere },
        select: {
          id: true,
          doctorId: true,
          patientId: true,
          visitDate: true,
          completedAt: true,
          nextVisitDate: true,
          status: true,
          invoices: {
            select: {
              invoice: {
                select: {
                  id: true,
                  status: true,
                  totalCents: true, total: true,
                  amountPaidCents: true, amountPaid: true,
                  balanceCents: true, balance: true,
                  items: {
                    select: {
                      description: true,
                      toothNumbers: true,
                      totalCents: true, total: true,
                      fee: { select: { category: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          overrides: { select: { listPriceCents: true, chargedCents: true } },
          completedPlanItems: { select: { id: true, planId: true } },
        },
      }),

      // Bills with no visit behind them — reported, never attributed.
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          visitInvoices: { none: {} },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          id: true,
          totalCents: true, total: true,
          amountPaidCents: true, amountPaid: true,
        },
      }),

      // Quoting: everything presented in the window, whatever became of it.
      prisma.treatmentPlan.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          createdById: true,
          patientId: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              status: true,
              completedAt: true,
              completedVisitId: true,
              feeCents: true, fee: true,
              patientEstCents: true, patientEst: true,
              feeRef: { select: { category: true } },
            },
          },
        },
      }),

      prisma.appointment.findMany({
        where: { startTime: { gte: from, lte: to }, ...branchWhere },
        select: {
          providerId: true, patientId: true, status: true,
          startTime: true, durationMins: true,
          arrivedAt: true, completedAt: true,
        },
      }),

      prisma.prescription.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { doctorId: true, _count: { select: { items: true } } },
      }),

      // Everything before the window, used to decide "new vs returning" and to
      // detect repeat work on a tooth already treated earlier.
      prisma.visit.findMany({
        where: { visitDate: { lt: from } },
        select: {
          doctorId: true, patientId: true, visitDate: true,
          invoices: {
            select: {
              invoice: {
                select: { items: { select: { description: true, toothNumbers: true } } },
              },
            },
          },
        },
      }),
    ])

  // Chair timings live on the queue item, not the visit, so pull them keyed by
  // doctor+patient+day and match them up.
  const queueItems = await prisma.receptionQueueItem.findMany({
    where: {
      startedAt: { gte: from, lte: to },
      assignedDoctorId: { not: null },
      ...branchWhere,
    },
    select: {
      assignedDoctorId: true, patientId: true, source: true,
      startedAt: true, finishedAt: true,
    },
  })

  const doctorIndex = new Map(doctors.map(d => [d.id, d.name]))

  // ── per-doctor accumulators ────────────────────────────────────────────────
  const acc = new Map<string, ReturnType<typeof blankAcc>>()
  const bucket = (id: string) => {
    let b = acc.get(id)
    if (!b) { b = blankAcc(); acc.set(id, b) }
    return b
  }

  // Coverage counters — how much of the data actually carries KPI linkage.
  let invoiceLines = 0, invoiceLinesCoded = 0
  let planItems = 0, planItemsCoded = 0, planItemsCompleted = 0, planItemsVisitLinked = 0
  let visitsCounted = 0, visitsWithNextDate = 0

  // ── VISITS: revenue, volume, categories, follow-up intent ─────────────────
  for (const visit of visits) {
    const b = bucket(visit.doctorId)
    b.visits += 1
    b.patients.add(visit.patientId)
    visitsCounted += 1
    if (visit.nextVisitDate) {
      visitsWithNextDate += 1
      // `after` guards against the visit that *set* the target counting as the
      // visit that kept it — common for short-interval reviews, where the
      // originating visit falls inside the grace window.
      b.followUpTargets.push({
        patientId: visit.patientId,
        due: visit.nextVisitDate,
        after: visit.visitDate,
      })
    }

    for (const link of visit.invoices) {
      const inv = link.invoice
      if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') continue
      b.billedCents += centsOf(inv.totalCents, inv.total)
      b.collectedCents += centsOf(inv.amountPaidCents, inv.amountPaid)
      b.outstandingCents += centsOf(inv.balanceCents, inv.balance)

      for (const item of inv.items) {
        invoiceLines += 1
        const cents = centsOf(item.totalCents, item.total)
        // Catalog category when the line is coded; free text otherwise.
        const coded = !!item.fee
        if (coded) invoiceLinesCoded += 1
        const label = item.fee?.category ?? item.description ?? 'Unlabelled'
        const row = b.categoryRevenue.get(label) ?? { cents: 0, count: 0, coded }
        row.cents += cents
        row.count += 1
        row.coded = row.coded && coded
        b.categoryRevenue.set(label, row)

        if (item.toothNumbers) {
          b.treatedTeeth.push({
            patientId: visit.patientId,
            tooth: item.toothNumbers,
            description: item.description ?? '',
            date: visit.visitDate,
          })
        }
      }
    }

    // List-vs-charged: the silent discount log.
    for (const o of visit.overrides) {
      b.listPriceCents += o.listPriceCents
      b.discountCents += Math.max(0, o.listPriceCents - o.chargedCents)
    }

    for (const item of visit.completedPlanItems) {
      b.planVisitsByPlan.set(item.planId, (b.planVisitsByPlan.get(item.planId) ?? new Set()).add(visit.id))
    }
  }

  // ── QUEUE: chair time, new-patient acquisition ────────────────────────────
  for (const q of queueItems) {
    if (!q.assignedDoctorId) continue
    const b = bucket(q.assignedDoctorId)
    if (q.startedAt && q.finishedAt) {
      const mins = Math.max(0, Math.round((q.finishedAt.getTime() - q.startedAt.getTime()) / 60_000))
      // Guard against a queue item left open overnight skewing the mean.
      if (mins > 0 && mins <= 8 * 60) {
        b.chairMinutes += mins
        b.chairSessions += 1
      }
    }
  }

  // "New to this doctor" is decided against real visit history, not the
  // queue's self-reported patientType, which is often UNKNOWN.
  const seenBefore = new Map<string, Set<string>>()  // doctorId -> patientIds
  const seenAnywhereBefore = new Set<string>()
  for (const pv of priorVisits) {
    seenAnywhereBefore.add(pv.patientId)
    const set = seenBefore.get(pv.doctorId) ?? new Set<string>()
    set.add(pv.patientId)
    seenBefore.set(pv.doctorId, set)
  }
  for (const [doctorId, b] of acc) {
    const prior = seenBefore.get(doctorId) ?? new Set<string>()
    for (const patientId of b.patients) {
      if (prior.has(patientId)) b.returningPatients += 1
      if (!seenAnywhereBefore.has(patientId)) b.newPatients += 1
    }
  }

  // ── PLANS: quote conversion, completion, cycle time ───────────────────────
  for (const plan of plans) {
    const b = bucket(plan.createdById)
    for (const item of plan.items) {
      planItems += 1
      if (item.feeRef) planItemsCoded += 1
      const value = item.patientEstCents || item.feeCents ||
                    Math.round((item.patientEst || item.fee) * 100)

      b.quotedItems += 1
      b.quotedCents += value

      if (item.status === 'COMPLETED') {
        planItemsCompleted += 1
        if (item.completedVisitId) planItemsVisitLinked += 1
        b.convertedItems += 1
        b.convertedCents += value
        if (item.completedAt) {
          b.planCycleDays.push(daysBetween(plan.createdAt, item.completedAt))
        }
      }

      const label = item.feeRef?.category ?? 'Uncategorised'
      const row = b.categoryProcedures.get(label) ?? { count: 0, coded: !!item.feeRef }
      if (item.status === 'COMPLETED') row.count += 1
      row.coded = row.coded && !!item.feeRef
      b.categoryProcedures.set(label, row)
    }
  }

  // ── APPOINTMENTS: no-show, cancellation, scheduled chair time ─────────────
  for (const a of appointments) {
    const b = bucket(a.providerId)
    b.scheduledAppointments += 1
    if (a.status === 'NO_SHOW') b.noShows += 1
    if (a.status === 'CANCELLED') b.cancellations += 1
    if (a.status === 'COMPLETED') b.scheduledMinutes += a.durationMins
  }

  // ── PRESCRIPTIONS ─────────────────────────────────────────────────────────
  for (const rx of prescriptions) {
    const b = bucket(rx.doctorId)
    b.prescriptions += 1
    b.prescriptionItems += rx._count.items
  }

  // ── FOLLOW-UP ADHERENCE ───────────────────────────────────────────────────
  // A follow-up counts as "kept" if the patient was seen by anyone within a
  // fortnight either side of the intended date. Only follow-ups whose due date
  // has already passed are counted, so a pending one is never scored as missed.
  const allVisitDates = new Map<string, Date[]>()
  for (const v of [...visits, ...priorVisits]) {
    const list = allVisitDates.get(v.patientId) ?? []
    list.push(v.visitDate)
    allVisitDates.set(v.patientId, list)
  }
  const laterVisits = await prisma.visit.findMany({
    where: { visitDate: { gt: to } },
    select: { patientId: true, visitDate: true },
  })
  for (const v of laterVisits) {
    const list = allVisitDates.get(v.patientId) ?? []
    list.push(v.visitDate)
    allVisitDates.set(v.patientId, list)
  }

  const GRACE_DAYS = 14
  const now = new Date()
  for (const b of acc.values()) {
    for (const target of b.followUpTargets) {
      if (target.due > now) continue           // not yet due — not a miss
      b.followUpsDue += 1
      const dates = allVisitDates.get(target.patientId) ?? []
      const kept = dates.some(d =>
        d.getTime() > target.after.getTime() &&
        Math.abs(daysBetween(target.due, d)) <= GRACE_DAYS)
      if (kept) b.followUpsKept += 1
    }
  }

  // ── RE-TREATMENT ──────────────────────────────────────────────────────────
  // Same patient, same tooth, treated again within the window. Matched on
  // tooth number only — descriptions are free text, so this is a signal to
  // investigate, never a verdict.
  const windowMs = RETREATMENT_WINDOW_MONTHS * 30 * 86_400_000
  const priorTeeth = new Map<string, Date[]>()
  for (const pv of priorVisits) {
    for (const link of pv.invoices) {
      for (const item of link.invoice.items) {
        if (!item.toothNumbers) continue
        const key = `${pv.patientId}::${item.toothNumbers}`
        priorTeeth.set(key, [...(priorTeeth.get(key) ?? []), pv.visitDate])
      }
    }
  }
  for (const b of acc.values()) {
    const withinPeriod = new Map<string, Date[]>()
    for (const t of b.treatedTeeth) {
      const key = `${t.patientId}::${t.tooth}`
      withinPeriod.set(key, [...(withinPeriod.get(key) ?? []), t.date])
    }
    for (const [key, dates] of withinPeriod) {
      const all = [...(priorTeeth.get(key) ?? []), ...dates].sort((x, y) => x.getTime() - y.getTime())
      for (let i = 1; i < all.length; i++) {
        if (all[i].getTime() - all[i - 1].getTime() <= windowMs) b.retreatments += 1
      }
    }
  }

  // ── PROJECT TO OUTPUT ─────────────────────────────────────────────────────
  const doctorRows: DoctorKpi[] = [...acc.entries()]
    .filter(([id]) => doctorIndex.has(id))
    .map(([doctorId, b]) => {
      const uniquePatients = b.patients.size
      const planIds = [...b.planVisitsByPlan.keys()]
      const visitsPerPlan = planIds.length
        ? planIds.reduce((s, id) => s + (b.planVisitsByPlan.get(id)?.size ?? 0), 0) / planIds.length
        : null

      return {
        doctorId,
        doctorName: doctorIndex.get(doctorId) ?? 'Unknown',

        billedCents: b.billedCents,
        collectedCents: b.collectedCents,
        outstandingCents: b.outstandingCents,
        collectionRate: rate(b.collectedCents, b.billedCents),
        listPriceCents: b.listPriceCents,
        discountCents: b.discountCents,
        discountRate: rate(b.discountCents, b.listPriceCents),
        revenuePerVisitCents: avg(b.collectedCents, b.visits),
        revenuePerPatientCents: avg(b.collectedCents, uniquePatients),
        revenueByCategory: [...b.categoryRevenue.entries()]
          .map(([label, v]) => ({ label, cents: v.cents, coded: v.coded }))
          .sort((x, y) => y.cents - x.cents),

        quotedItems: b.quotedItems,
        quotedCents: b.quotedCents,
        convertedItems: b.convertedItems,
        convertedCents: b.convertedCents,
        quoteConversionRate: rate(b.convertedItems, b.quotedItems),
        quoteValueConversionRate: rate(b.convertedCents, b.quotedCents),

        visits: b.visits,
        uniquePatients,
        newPatients: b.newPatients,
        proceduresByCategory: [...b.categoryProcedures.entries()]
          .map(([label, v]) => ({ label, count: v.count, coded: v.coded }))
          .filter(r => r.count > 0)
          .sort((x, y) => y.count - x.count),
        chairMinutes: b.chairMinutes,
        avgChairMinutes: b.chairSessions ? Math.round(b.chairMinutes / b.chairSessions) : null,
        scheduledMinutes: b.scheduledMinutes,
        chairUtilisation: rate(b.chairMinutes, b.scheduledMinutes),

        planItemsPlanned: b.quotedItems,
        planItemsCompleted: b.convertedItems,
        planCompletionRate: rate(b.convertedItems, b.quotedItems),
        avgVisitsPerCompletedPlan: visitsPerPlan ? Math.round(visitsPerPlan * 10) / 10 : null,
        avgDaysPlanToCompletion: b.planCycleDays.length
          ? Math.round(b.planCycleDays.reduce((s, d) => s + d, 0) / b.planCycleDays.length)
          : null,

        followUpsDue: b.followUpsDue,
        followUpsKept: b.followUpsKept,
        followUpAdherence: rate(b.followUpsKept, b.followUpsDue),
        returningPatients: b.returningPatients,
        patientReturnRate: rate(b.returningPatients, uniquePatients),
        noShows: b.noShows,
        cancellations: b.cancellations,
        scheduledAppointments: b.scheduledAppointments,
        noShowRate: rate(b.noShows + b.cancellations, b.scheduledAppointments),

        retreatments: b.retreatments,
        retreatmentRate: rate(b.retreatments, b.visits),
        prescriptions: b.prescriptions,
        prescriptionItems: b.prescriptionItems,
        prescriptionsPerVisit: b.visits ? Math.round((b.prescriptions / b.visits) * 100) / 100 : null,
      }
    })
    .sort((a, b) => b.collectedCents - a.collectedCents)

  const clinicBilled = doctorRows.reduce((s, d) => s + d.billedCents, 0)
  const clinicCollected = doctorRows.reduce((s, d) => s + d.collectedCents, 0)
  const allPatients = new Set<string>()
  for (const b of acc.values()) for (const p of b.patients) allPatients.add(p)

  return {
    range: { from: from.toISOString(), to: to.toISOString(), branchId: branchId ?? null },
    doctors: doctorRows,
    clinic: {
      billedCents: clinicBilled,
      collectedCents: clinicCollected,
      outstandingCents: doctorRows.reduce((s, d) => s + d.outstandingCents, 0),
      collectionRate: rate(clinicCollected, clinicBilled),
      visits: doctorRows.reduce((s, d) => s + d.visits, 0),
      uniquePatients: allPatients.size,
      newPatients: doctorRows.reduce((s, d) => s + d.newPatients, 0),
      unattributed: {
        invoices: standaloneInvoices.length,
        billedCents: standaloneInvoices.reduce((s, i) => s + centsOf(i.totalCents, i.total), 0),
        collectedCents: standaloneInvoices.reduce((s, i) => s + centsOf(i.amountPaidCents, i.amountPaid), 0),
      },
    },
    coverage: {
      invoiceLinesCoded: rate(invoiceLinesCoded, invoiceLines),
      planItemsCoded: rate(planItemsCoded, planItems),
      planItemsVisitLinked: rate(planItemsVisitLinked, planItemsCompleted),
      visitsWithNextVisitDate: rate(visitsWithNextDate, visitsCounted),
    },
  }
}

function blankAcc() {
  return {
    billedCents: 0,
    collectedCents: 0,
    outstandingCents: 0,
    listPriceCents: 0,
    discountCents: 0,
    categoryRevenue: new Map<string, { cents: number; count: number; coded: boolean }>(),
    categoryProcedures: new Map<string, { count: number; coded: boolean }>(),

    quotedItems: 0,
    quotedCents: 0,
    convertedItems: 0,
    convertedCents: 0,
    planCycleDays: [] as number[],
    planVisitsByPlan: new Map<string, Set<string>>(),

    visits: 0,
    patients: new Set<string>(),
    newPatients: 0,
    returningPatients: 0,
    chairMinutes: 0,
    chairSessions: 0,
    scheduledMinutes: 0,

    followUpTargets: [] as { patientId: string; due: Date; after: Date }[],
    followUpsDue: 0,
    followUpsKept: 0,

    noShows: 0,
    cancellations: 0,
    scheduledAppointments: 0,

    treatedTeeth: [] as { patientId: string; tooth: string; description: string; date: Date }[],
    retreatments: 0,

    prescriptions: 0,
    prescriptionItems: 0,
  }
}
