'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, ChevronRight, ChevronLeft, Plus, Trash2,
  Pill, Receipt, FileText, ClipboardList, Check, AlertCircle,
  Calendar, Share2, X, Upload, Image as ImageIcon,
} from 'lucide-react'
import { cn, formatLKR } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import { ToothChart, ToothState, TOOTH_CONDITIONS } from '@/components/visits/ToothChart'
import { TreatmentPlanStep, getPlanEntries, emptyProc, type Proc, type Fee } from '@/components/visits/TreatmentPlanStep'

const SL_DRUGS = [
  { name: 'Amoxicillin 500mg',       dose: '500mg',  frequency: 'Three times per day', duration: '5 days' },
  { name: 'Metronidazole 400mg',      dose: '400mg',  frequency: 'Three times per day', duration: '5 days' },
  { name: 'Ibuprofen 400mg',          dose: '400mg',  frequency: 'Three times per day', duration: '3 days', mealRelation: 'After meals' },
  { name: 'Paracetamol 500mg',        dose: '500mg',  frequency: 'Three times per day', duration: '3 days' },
  { name: 'Chlorhexidine mouthwash',  dose: '10ml',   frequency: 'Two times per day',   duration: '7 days' },
  { name: 'Diclofenac 50mg',          dose: '50mg',   frequency: 'Two times per day',   duration: '3 days', mealRelation: 'After meals' },
  { name: 'Clindamycin 150mg',        dose: '150mg',  frequency: 'Four times per day',  duration: '5 days' },
  { name: 'Dexamethasone 0.5mg',      dose: '0.5mg',  frequency: 'Once per day',        duration: '3 days' },
  { name: 'Omeprazole 20mg',          dose: '20mg',   frequency: 'Once per day',        duration: '5 days', mealRelation: 'Before meals' },
]

const DOSE_OPTIONS = ['125mg', '150mg', '200mg', '250mg', '400mg', '500mg', '625mg', '1g', '5ml', '10ml']
const FREQUENCY_OPTIONS = ['Once per day', 'Two times per day', 'Three times per day', 'Four times per day', 'Every 6 hours', 'Every 8 hours', 'As needed']
const RX_TIMING_OPTIONS = ['Morning', 'Evening', 'Night', 'Morning and evening', 'Morning, evening and night']
const MEAL_RELATION_OPTIONS = ['Before meals', 'After meals', 'With meals']

interface RxItem {
  id: string
  drugName: string
  dose: string
  frequency: string
  duration: string
  timing: string
  mealRelation: string
  instructions: string
}

interface XrayFilePayload {
  fileName: string
  mimeType: string
  fileSize: number
  dataUrl: string
}

// Treatment done today — each has a "charge" amount (what doctor tells patient to pay)
// and optional "next visit" flag
interface TxItem {
  id:          string
  description: string
  toothNumber: string
  listPrice:   number   // original fee from schedule
  chargeAmt:   number   // what doctor charges today
  deferToNext: boolean  // tick if doing next visit instead of today
  multiSession?: boolean // partial charge means future balance, not discount
  sourcePlanItemId?: string
  feeId?: string         // links to TreatmentFee — lets inventory auto-deduct match exactly
}

// Installment row — per-treatment, per-visit assignment
interface InstallRow {
  id:          string
  treatmentId: string
  visitNum:    number
  amount:      number
}

interface NextVisitItem {
  id: string
  description: string
  tooth: string
  price: number
  sourcePlanItemId?: string
  feeId?: string         // carried from the deferred treatment so the plan item stays catalog-linked
}

const uid = () => Math.random().toString(36).slice(2, 10)
const NEXT_APPOINTMENT_TIMES = [
  ...buildTimeSlots(9, 14),
  ...buildTimeSlots(16, 21),
]
const NEXT_APPOINTMENT_TYPES = [
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'ROOT_CANAL', label: 'Root canal' },
  { value: 'CROWN', label: 'Crown' },
  { value: 'IMPLANT', label: 'Implant' },
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'CHECKUP', label: 'Checkup' },
]

function buildTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = []
  for (let mins = startHour * 60; mins < endHour * 60; mins += 30) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
}

function dateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function diagnosisLabel(condition: ToothState['condition']) {
  return TOOTH_CONDITIONS.find(c => c.id === condition)?.label ?? condition
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Step 1 "Review history" is the read-only card shown above this wizard
// (see visits/new/page.tsx) — these are steps 2–8.
type Step = 'diagnosis' | 'plan' | 'treatment' | 'next' | 'prescription' | 'bill' | 'end'

const STEPS: { id: Step; label: string }[] = [
  { id: 'diagnosis',    label: 'Diagnosis'      },
  { id: 'plan',         label: 'Treatment Plan' },
  { id: 'treatment',    label: 'Treatment Done' },
  { id: 'next',         label: 'Next Visits'    },
  { id: 'prescription', label: 'Prescription'   },
  { id: 'bill',         label: 'Bill'           },
  { id: 'end',          label: 'End Visit'      },
]

interface Props {
  patient:         any
  doctors:         { id: string; name: string; role: string }[]
  branches:        { id: string; name: string }[]
  currentUser:     any
  defaultDoctorId: string
  pendingPlanItems?: NextVisitItem[]
  queueId?: string
  defaultBranchId?: string
  defaultComplaint?: string
  fees?: Fee[]
}

export function VisitForm({
  patient, doctors, branches, currentUser, defaultDoctorId, pendingPlanItems = [],
  queueId, defaultBranchId, defaultComplaint, fees = [],
}: Props) {
  const router = useRouter()
  const [step,     setStep]     = useState<Step>('diagnosis')
  const [doctorId, setDoctorId] = useState(defaultDoctorId)
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '')
  const [saving,   setSaving]   = useState(false)
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null)
  const [showRefer, setShowRefer] = useState(false)
  const [referDoctorId, setReferDoctorId] = useState('')
  const [referNote, setReferNote] = useState('')
  const [referring, setReferring] = useState(false)

  // STEP 1 — Diagnosis
  const [teeth,       setTeeth]       = useState<Record<number, ToothState>>({})
  const [complaint,   setComplaint]   = useState(defaultComplaint ?? '')
  const [examination, setExamination] = useState('')
  const [diagnosis,   setDiagnosis]   = useState('')
  const [nurseAssisted, setNurseAssisted] = useState<string | null>(null)
  const [xrayRequested, setXrayRequested] = useState(false)
  const [xrayTaken, setXrayTaken] = useState(false)
  const [xrayType, setXrayType] = useState('Periapical')
  const [xrayCharge, setXrayCharge] = useState(800)
  const [xrayNotes, setXrayNotes] = useState('')
  const [xrayFile, setXrayFile] = useState<File | null>(null)

  // Tooth entries the doctor has personally edited never get overwritten by
  // a later nurse-assist poll — the doctor is always the final authority.
  const teethRef = useRef(teeth)
  useEffect(() => { teethRef.current = teeth }, [teeth])
  const doctorTouchedTeeth = useRef<Set<number>>(new Set())

  function handleTeethChange(next: Record<number, ToothState>) {
    const prev = teethRef.current
    for (const key of Object.keys(next)) {
      const n = Number(key)
      if (JSON.stringify(prev[n]) !== JSON.stringify(next[n])) doctorTouchedTeeth.current.add(n)
    }
    setTeeth(next)
  }

  // Poll the nurse-assist draft (a nurse can be charting tooth findings for
  // this same patient while the doctor examines them) and merge in anything
  // new the doctor hasn't already touched themselves.
  useEffect(() => {
    if (!queueId) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/queue/${queueId}/diagnosis-draft`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const draft = (data.toothFindings ?? {}) as Record<string, ToothState>
        if (Object.keys(draft).length === 0) return

        const prev = teethRef.current
        let changed = false
        const merged = { ...prev }
        for (const [key, state] of Object.entries(draft)) {
          const n = Number(key)
          if (doctorTouchedTeeth.current.has(n)) continue
          if (JSON.stringify(prev[n]) !== JSON.stringify(state)) {
            merged[n] = state
            changed = true
          }
        }
        if (changed) {
          setTeeth(merged)
          setNurseAssisted(data.updatedByName ?? 'Nurse')
        }
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [queueId])

  // STEP 2 — Treatment plan (cascading dropdowns)
  const [planProcs, setPlanProcs] = useState<Proc[]>([emptyProc()])

  function goToPlan() {
    const selectedDiagnosisRows = Object.entries(teeth)
      .filter(([, state]) => state.selected)
      .map(([tooth, state]) => ({
        toothNumber: Number(tooth),
        state,
      }))
      .sort((a, b) => a.toothNumber - b.toothNumber)

    if (selectedDiagnosisRows.length > 0) {
      setPlanProcs(current => {
        const usableRows = current.filter(row => row.category || row.subcategory || row.feeId || row.tooth || row.note)
        const existingDiagnosisTeeth = new Set(usableRows.map(row => row.diagnosisTooth).filter(Boolean))
        const existingToothValues = new Set(usableRows.map(row => row.tooth.trim()).filter(Boolean))
        const additions = selectedDiagnosisRows
          .filter(row => !existingDiagnosisTeeth.has(row.toothNumber) && !existingToothValues.has(String(row.toothNumber)))
          .map(row => ({
            ...emptyProc(),
            tooth: String(row.toothNumber),
            note: row.state.notes
              ? `${diagnosisLabel(row.state.condition)} - ${row.state.notes}`
              : diagnosisLabel(row.state.condition),
            diagnosisTooth: row.toothNumber,
          }))

        const next = [...usableRows, ...additions]
        return next.length > 0 ? next : [emptyProc()]
      })
    }

    setStep('plan')
  }

  // STEP 3 — Treatment done today
  const [txItems, setTxItems] = useState<TxItem[]>([])

  // Build treatment rows from plan, pre-filling prices
  function goToTreatment() {
    const entries = getPlanEntries(planProcs, fees).filter(e => e.label)
    if (entries.length > 0) {
      setTxItems(current => {
        const used = new Set<string>()
        const synced = entries.map(e => {
          const match = current.find(t => {
            if (used.has(t.id)) return false
            if (e.feeId && t.feeId === e.feeId && t.toothNumber === e.tooth) return true
            return t.description === e.label && t.toothNumber === e.tooth
          })
          const listPrice = e.price ?? 0

          if (!match) {
            return {
              id:          uid(),
              description: e.label,
              toothNumber: e.tooth,
              listPrice,
              chargeAmt:   listPrice,
              deferToNext: false,
              multiSession: false,
              feeId:       e.feeId ?? undefined,
            }
          }

          used.add(match.id)
          const chargeWasDefault = match.chargeAmt === match.listPrice || match.chargeAmt === 0
          return {
            ...match,
            description: e.label,
            toothNumber: e.tooth,
            listPrice,
            chargeAmt: chargeWasDefault ? listPrice : match.chargeAmt,
            feeId:     e.feeId ?? undefined,
          }
        })
        const manualRows = current.filter(t => !used.has(t.id) && !t.feeId && t.description)
        return [...synced, ...manualRows]
      })
    } else if (txItems.length === 0) {
      setTxItems([{ id: uid(), description: '', toothNumber: '', listPrice: 0, chargeAmt: 0, deferToNext: false, multiSession: false }])
    }
    setStep('treatment')
  }

  function updateTx(id: string, field: keyof TxItem, value: any) {
    setTxItems(p => p.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  function togglePendingPlanItem(item: NextVisitItem) {
    setTxItems(p => {
      const exists = p.some(t => t.sourcePlanItemId === item.sourcePlanItemId)
      if (exists) return p.filter(t => t.sourcePlanItemId !== item.sourcePlanItemId)

      return [...p, {
        id:               uid(),
        description:      item.description,
        toothNumber:      item.tooth,
        listPrice:        item.price,
        chargeAmt:        item.price,
        deferToNext:      false,
        multiSession:     false,
        sourcePlanItemId: item.sourcePlanItemId,
      }]
    })
  }

  // Treatments actually being billed today (not deferred)
  const todayTx     = txItems.filter(t => t.description && !t.deferToNext)
  const deferredTx  = txItems.filter(t => t.description && t.deferToNext)
  const xrayChargeToday = xrayTaken ? xrayCharge : 0
  const subtotal    = todayTx.reduce((s, t) => s + t.chargeAmt, 0) + xrayChargeToday
  const futureBalance = todayTx.reduce((s, t) => s + (t.multiSession ? Math.max(0, t.listPrice - t.chargeAmt) : 0), 0)
  const totalDiscount = todayTx.reduce((s, t) => s + (!t.multiSession ? Math.max(0, t.listPrice - t.chargeAmt) : 0), 0)

  // STEP 4 — Next visits: deferred items + manual additions
  const [nextVisitItems, setNextVisitItems] = useState<NextVisitItem[]>([])
  const [nextNote, setNextNote] = useState('')
  const defaultNextAppointmentDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return dateInputValue(d)
  })()
  // Intended follow-up date, recorded whether or not an appointment is booked —
  // this is what makes follow-up adherence measurable for walk-back patients.
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [scheduleNextAppointment, setScheduleNextAppointment] = useState(false)
  const [nextAppointmentDate, setNextAppointmentDate] = useState(defaultNextAppointmentDate)
  const [nextAppointmentTime, setNextAppointmentTime] = useState('09:00')
  const [nextAppointmentDuration, setNextAppointmentDuration] = useState(30)
  const [nextAppointmentType, setNextAppointmentType] = useState('FOLLOW_UP')
  const [nextAppointmentReason, setNextAppointmentReason] = useState('')
  const [nextAppointmentItemIds, setNextAppointmentItemIds] = useState<string[]>([])

  function buildNextVisits() {
    // Seed next visit items from deferred treatments and unfinished multi-session balances.
    const fromDeferred = deferredTx.map(t => ({
      id:          uid(),
      description: t.description,
      tooth:       t.toothNumber,
      price:       t.chargeAmt || t.listPrice,
      feeId:       t.feeId,
    }))
    const fromMultiSession = todayTx
      .filter(t => t.multiSession && t.listPrice > t.chargeAmt)
      .map(t => ({
        id:          uid(),
        description: `Continue ${t.description}`,
        tooth:       t.toothNumber,
        price:       Math.max(0, t.listPrice - t.chargeAmt),
        feeId:       t.feeId,
      }))
    // Merge rather than seed-once: the doctor may go Back and defer another
    // treatment after this step has already been built.
    const seededItems = [...fromDeferred, ...fromMultiSession]
    if (seededItems.length > 0) {
      setNextVisitItems(prev => {
        const seen = new Set(prev.map(i => `${i.description}|${i.tooth}`))
        const additions = seededItems.filter(i => !seen.has(`${i.description}|${i.tooth}`))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
    }
    setStep('next')
  }

  // STEP 5 — Prescription
  const [rxItems, setRxItems] = useState<RxItem[]>([])
  const [rxNotes, setRxNotes] = useState('')

  function addRx() {
    setRxItems(p => [...p, { id: uid(), drugName: '', dose: '', frequency: '', duration: '', timing: '', mealRelation: '', instructions: '' }])
  }
  function updateRx(id: string, field: keyof RxItem, val: string) {
    setRxItems(p => p.map(r => r.id === id ? { ...r, [field]: val } : r))
  }
  function applyDrug(id: string, drug: typeof SL_DRUGS[0]) {
    setRxItems(p => p.map(r => r.id === id ? {
      ...r,
      drugName: drug.name,
      dose: drug.dose,
      frequency: drug.frequency,
      duration: drug.duration,
      mealRelation: drug.mealRelation ?? '',
    } : r))
  }
  function composeRxInstructions(rx: RxItem) {
    return [rx.timing, rx.mealRelation, rx.instructions].filter(Boolean).join(' - ')
  }

  // STEP 6 — Bill
  type PayType = 'full' | 'installment' | 'waive'
  const [payType,     setPayType]     = useState<PayType>('full')
  // Full payment split
  const [cashAmt,     setCashAmt]     = useState(0)
  const [cardAmt,     setCardAmt]     = useState(0)
  const [transferAmt, setTransferAmt] = useState(0)
  // Waive: doctor enters what they charge (subtotal already reflects this via chargeAmt)
  // so waive at bill level is additional overall discount
  const [billDiscount, setBillDiscount] = useState(0)
  // Installments — customisable per treatment
  const [installRows, setInstallRows] = useState<InstallRow[]>([])
  const [billNotes,   setBillNotes]   = useState('')

  function addInstallRow() {
    setInstallRows(p => [...p, { id: uid(), treatmentId: '', visitNum: 1, amount: 0 }])
  }
  function updateInstall(id: string, field: keyof InstallRow, val: any) {
    setInstallRows(p => p.map(r => r.id === id ? { ...r, [field]: val } : r))
  }
  function assignInstallmentRemainderToday() {
    const remaining = Math.max(0, totalPayable - installTotal)
    if (remaining <= 0) return
    setInstallRows(p => [...p, { id: uid(), treatmentId: todayTx[0]?.id ?? '', visitNum: 1, amount: remaining }])
  }
  function splitInstallmentsAcrossVisits(visitCount: number) {
    if (visitCount < 1 || totalPayable <= 0) return
    const perVisit = Math.floor((totalPayable / visitCount) * 100) / 100
    setInstallRows(Array.from({ length: visitCount }, (_, index) => ({
      id: uid(),
      treatmentId: todayTx[0]?.id ?? '',
      visitNum: index + 1,
      amount: index === visitCount - 1 ? Number((totalPayable - perVisit * (visitCount - 1)).toFixed(2)) : perVisit,
    })))
  }

  const totalPayable   = Math.max(0, subtotal - billDiscount)
  const paid           = cashAmt + cardAmt + transferAmt
  const installTotal   = installRows.reduce((s, r) => s + r.amount, 0)
  const installmentDelta = Number((installTotal - totalPayable).toFixed(2))
  const installmentBalanced = Math.abs(installmentDelta) <= 0.01
  const installByVisit = installRows.reduce((acc, r) => {
    acc[r.visitNum] = (acc[r.visitNum] ?? 0) + r.amount
    return acc
  }, {} as Record<number, number>)

  async function referPatient() {
    if (!queueId) { showToast('error', 'This visit is not linked to the queue'); return }
    if (!referDoctorId) { showToast('error', 'Choose a doctor to refer to'); return }
    setReferring(true)
    try {
      const res = await fetch(`/api/queue/${queueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedDoctorId: referDoctorId,
          referralNote: referNote || 'Referred for specialist treatment',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not refer patient')
      showToast('success', 'Patient referred', 'They are now at the top of the selected doctor queue.')
      router.push('/dashboard')
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setReferring(false)
    }
  }

  // Save
  async function handleSave(finalise = false) {
    if (!complaint.trim()) { showToast('error', 'Please enter the patient complaint'); return }
    setSaving(true)
    try {
      const planEntries = getPlanEntries(planProcs, fees)
      const planText = planEntries.map(e =>
        `${e.label}${e.tooth ? ` (T${e.tooth})` : ''}${e.note ? ` — ${e.note}` : ''}`
      ).join('; ')

      const txText = todayTx.map(t =>
        t.toothNumber ? `${t.description} (T${t.toothNumber})` : t.description
      ).join('; ')

      const nextText = nextNote ||
        (nextVisitItems.length > 0
          ? nextVisitItems.map(n => `${n.description}${n.tooth ? ` (T${n.tooth})` : ''}${n.price > 0 ? ` - ${formatLKR(n.price)}` : ''}`).join(', ')
          : null)

      // Treatment items for billing — use chargeAmt (what doctor charges)
      const treatmentItems = todayTx.map(t => ({
        listPrice:   t.listPrice,
        description: t.description,
        toothNumber: t.toothNumber,
        price:       t.chargeAmt,
        sourcePlanItemId: t.sourcePlanItemId,
        feeId:       t.feeId,
      }))
      if (xrayTaken && xrayCharge > 0) {
        treatmentItems.push({
          listPrice: xrayCharge,
          description: `X-ray - ${xrayType}`,
          toothNumber: '',
          price: xrayCharge,
          sourcePlanItemId: undefined,
          feeId: undefined,
        })
      }
      let xrayFilePayload: XrayFilePayload | null = null
      if (xrayFile) {
        xrayFilePayload = {
          fileName: xrayFile.name,
          mimeType: xrayFile.type || 'application/octet-stream',
          fileSize: xrayFile.size,
          dataUrl: await fileToDataUrl(xrayFile),
        }
      }

      const completedPlanItemIds = todayTx
        .map(t => t.sourcePlanItemId)
        .filter(Boolean)

      const futureTreatmentItems = nextVisitItems
        .filter(n => n.description.trim())
        .map((n, index) => ({
          description: n.description,
          tooth:       n.tooth,
          price:       n.price,
          sequence:    index + 1,
          feeId:       n.feeId,
        }))
      const selectedAppointmentItems = nextVisitItems.filter(item => nextAppointmentItemIds.includes(item.id))
      const appointmentTreatmentText = selectedAppointmentItems.length > 0
        ? selectedAppointmentItems.map(item => `${item.description}${item.tooth ? ` (T${item.tooth})` : ''}`).join(', ')
        : ''
      const nextAppointment = scheduleNextAppointment && nextAppointmentDate && nextAppointmentTime
        ? {
            startTime: `${nextAppointmentDate}T${nextAppointmentTime}:00`,
            durationMins: nextAppointmentDuration,
            type: nextAppointmentType,
            reason: nextAppointmentReason || appointmentTreatmentText || nextNote || futureTreatmentItems[0]?.description || 'Follow-up treatment',
            treatmentItems: selectedAppointmentItems.map(item => ({
              description: item.description,
              tooth: item.tooth,
              price: item.price,
            })),
          }
        : null

      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId:      patient.id,
          queueId:        queueId || null,
          doctorId,
          branchId:       branchId || null,
          chiefComplaint: complaint,
          examination:    examination || null,
          diagnosis:      diagnosis   || null,
          treatmentDone:  txText      || null,
          nextVisitPlan:  nextText,
          nextVisitDate:  expectedReturnDate || null,
          futureTreatmentItems,
          nextAppointment,
          completedPlanItemIds,
          toothFindings:  teeth,
          xray: xrayRequested ? {
            requested: xrayRequested,
            taken: xrayTaken,
            type: xrayType,
            charge: xrayChargeToday,
            notes: xrayNotes,
            file: xrayFilePayload,
          } : null,
          status:         finalise ? 'READY_TO_PAY' : 'IN_PROGRESS',
          treatmentItems,
          prescription:   rxItems.some(r => r.drugName)
            ? {
                items: rxItems
                  .filter(r => r.drugName)
                  .map(r => ({ ...r, instructions: composeRxInstructions(r) })),
                notes: rxNotes,
              }
            : null,
          payment: finalise ? {
            type:       payType,
            subtotal,
            discount:   totalDiscount + billDiscount,
            total:      totalPayable,
            cash:       cashAmt,
            card:       cardAmt,
            transfer:   transferAmt,
            notes:      billNotes,
          } : null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      showToast('success', finalise ? 'Visit completed — patient ready to pay' : 'Visit saved')
      if (finalise) {
        // Step 8 "End visit": the visit is now locked. Show the confirmation
        // screen instead of navigating away, so printing and returning to
        // the queue are both one deliberate tap.
        setSavedVisitId(json.visitId)
        setStep('end')
      } else {
        router.push(`/visits/${json.visitId}`)
      }
    } catch (e: any) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const stepIdx = STEPS.findIndex(s => s.id === step)
  const otherDoctors = doctors.filter(d => d.id !== currentUser.id)

  return (
    <div className="space-y-5">
      {queueId && otherDoctors.length > 0 && (
        <div className="section-card border-purple-200">
          <div className="section-card-body !py-4">
            {!showRefer ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">Need another doctor?</p>
                  <p className="text-sm text-gray-500">Refer this patient and place them at the top of that doctor's queue.</p>
                </div>
                <button onClick={() => setShowRefer(true)} className="btn-secondary !text-sm">
                  <Share2 className="w-4 h-4" />Refer patient
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="form-label">Refer to doctor</label>
                  <select value={referDoctorId} onChange={e => setReferDoctorId(e.target.value)} className="form-input">
                    <option value="">Choose doctor...</option>
                    {otherDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex-[2] min-w-[240px]">
                  <label className="form-label">Referral note</label>
                  <input value={referNote} onChange={e => setReferNote(e.target.value)} className="form-input" placeholder="e.g. Endodontic case / specialist review" />
                </div>
                <button onClick={referPatient} disabled={referring} className="btn-primary !bg-purple-600 hover:!bg-purple-700">
                  <Share2 className="w-4 h-4" />{referring ? 'Referring...' : 'Send to queue'}
                </button>
                <button onClick={() => setShowRefer(false)} className="btn-secondary !px-3">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step bar — progress only, forward-only flow (no tab jumping, no
          re-editing a step after it's been submitted) */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="flex">
          {STEPS.map((s, i) => {
            const done = i < stepIdx; const active = s.id === step
            return (
              <div key={s.id}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-semibold transition-colors border-r border-gray-200 last:border-0',
                  active ? 'bg-blue-600 text-white' : done ? 'bg-blue-50 text-blue-600' : 'text-gray-400')}>
                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  active ? 'bg-white text-blue-600' : done ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500')}>
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEP 2: DIAGNOSIS ─────────────────────────────────────────────── */}
      {step === 'diagnosis' && (
        <div className="section-card">
          <div className="section-card-header">
            <div><h2 className="text-xl font-bold text-gray-900">2. Diagnosis</h2>
            <p className="text-sm text-gray-500 mt-0.5">Complaint, examination and diagnosis</p></div>
          </div>
          <div className="section-card-body space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="form-label">Doctor *</label>
                <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="form-input">
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="form-label">Branch</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="form-input">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div><label className="form-label">Chief complaint *</label>
              <input value={complaint} onChange={e => setComplaint(e.target.value)}
                className="form-input text-lg" placeholder="What brings the patient in today?" autoFocus /></div>
            <div>
              <div className="flex items-center justify-between">
                <label className="form-label">Tooth chart</label>
                {nurseAssisted && (
                  <span className="text-xs font-semibold text-blue-600">
                    Includes findings added by {nurseAssisted}
                  </span>
                )}
              </div>
              <ToothChart teeth={teeth} onChange={handleTeethChange} />
            </div>
            <div><label className="form-label">Examination findings</label>
              <textarea value={examination} onChange={e => setExamination(e.target.value)}
                className="form-input !h-24 resize-none" placeholder="Swelling, tenderness, mobility..." /></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">X-ray</p>
                    <p className="text-xs font-semibold text-gray-500">Request, attach, and charge for an X-ray if taken.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={xrayRequested}
                    onChange={e => {
                      setXrayRequested(e.target.checked)
                      if (!e.target.checked) setXrayTaken(false)
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  X-ray needed
                </label>
              </div>
              {xrayRequested && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label !text-xs">Type</label>
                    <select value={xrayType} onChange={e => setXrayType(e.target.value)} className="form-input !py-2">
                      <option>Periapical</option>
                      <option>OPG</option>
                      <option>Bitewing</option>
                      <option>Occlusal</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <label className="flex items-end gap-2 text-sm font-bold text-gray-700 pb-2">
                    <input
                      type="checkbox"
                      checked={xrayTaken}
                      onChange={e => setXrayTaken(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    X-ray taken today
                  </label>
                  {xrayTaken && (
                    <>
                      <div>
                        <label className="form-label !text-xs">Charge (Rs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={xrayCharge || ''}
                          onChange={e => setXrayCharge(parseFloat(e.target.value) || 0)}
                          className="form-input !py-2 text-right font-bold"
                        />
                      </div>
                      <div>
                        <label className="form-label !text-xs">Attachment</label>
                        <label className="btn-secondary !py-2 !text-sm w-full justify-center cursor-pointer">
                          <Upload className="w-4 h-4" />
                          {xrayFile ? xrayFile.name : 'Attach X-ray'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={e => setXrayFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <label className="form-label !text-xs">Notes</label>
                    <input
                      value={xrayNotes}
                      onChange={e => setXrayNotes(e.target.value)}
                      className="form-input !py-2"
                      placeholder="e.g. PA X-ray tooth 36 before RCT"
                    />
                  </div>
                </div>
              )}
            </div>
            <div><label className="form-label">Diagnosis</label>
              <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                className="form-input" placeholder="e.g. Acute pulpitis tooth 26" /></div>
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
                <Save className="w-4 h-4" />Save & come back later</button>
              <button onClick={goToPlan} disabled={!complaint.trim()} className="btn-primary">
                Next: Treatment Plan <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: TREATMENT PLAN ────────────────────────────────────────── */}
      {step === 'plan' && (
        <div className="section-card">
          <div className="section-card-header">
            <div><h2 className="text-xl font-bold text-gray-900">3. Treatment Plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">Diagnosis teeth are added automatically; choose procedures and add more rows if needed</p></div>
          </div>
          <div className="section-card-body space-y-4">
            <TreatmentPlanStep entries={planProcs} onChange={setPlanProcs} fees={fees} />
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => setStep('diagnosis')} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />Back</button>
              <button onClick={goToTreatment} className="btn-primary">
                Next: Treatment Done Today <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: TREATMENT DONE TODAY ─────────────────────────────────── */}
      {step === 'treatment' && (
        <div className="section-card">
          <div className="section-card-header">
            <div><h2 className="text-xl font-bold text-gray-900">4. Treatment Done Today</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Confirm what was done and what you will charge. Switch anything you are not doing
              today to <span className="font-semibold text-amber-700">Next visit</span> — it moves
              to the next-visit plan instead of today&apos;s bill.
            </p></div>
          </div>
          <div className="section-card-body space-y-3">
            {pendingPlanItems.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                <p className="text-sm font-bold text-blue-900">Planned from last visit</p>
                <div className="space-y-2">
                  {pendingPlanItems.map(item => {
                    const selected = txItems.some(t => t.sourcePlanItemId === item.sourcePlanItemId)
                    return (
                      <button
                        key={item.sourcePlanItemId ?? item.id}
                        type="button"
                        onClick={() => togglePendingPlanItem(item)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                          selected ? 'border-blue-500 bg-white text-blue-900' : 'border-blue-100 bg-white/70 text-gray-700 hover:border-blue-300'
                        )}
                      >
                        <span className="min-w-0 text-sm font-semibold">
                          {selected && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                          {item.description}{item.tooth ? ` (T${item.tooth})` : ''}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-green-700">
                          {item.price > 0 ? formatLKR(item.price) : 'Quote required'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 px-1">
              <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Treatment</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Tooth</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">List price</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">You charge</div>
              <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">When</div>
            </div>

            {txItems.map((t, idx) => {
              const remaining = Math.max(0, t.listPrice - t.chargeAmt)
              const disc = t.multiSession ? 0 : remaining
              return (
                <div key={t.id} className={cn('grid grid-cols-12 gap-3 items-center rounded-xl p-3 border',
                  t.deferToNext || t.multiSession ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200')}>
                  <div className="col-span-3">
                    <input type="text" value={t.description}
                      onChange={e => updateTx(t.id, 'description', e.target.value)}
                      className="form-input !py-2 text-sm" autoFocus={idx === 0} />
                  </div>
                  <div className="col-span-2">
                    <input type="text" value={t.toothNumber}
                      onChange={e => updateTx(t.id, 'toothNumber', e.target.value)}
                      placeholder="26" className="form-input !py-2 text-center font-mono text-sm" />
                  </div>
                  {/* List price — read-only reference */}
                  <div className="col-span-2 text-right">
                    <p className={cn('text-sm font-semibold', t.listPrice > 0 ? 'text-gray-500' : 'text-gray-300')}>
                      {t.listPrice > 0 ? formatLKR(t.listPrice) : '—'}
                    </p>
                  </div>
                  {/* Charge amount — what doctor tells patient to pay */}
                  <div className="col-span-2">
                    <input type="number" min="0" step="any"
                      value={t.chargeAmt || ''}
                      onChange={e => updateTx(t.id, 'chargeAmt', parseFloat(e.target.value) || 0)}
                      disabled={t.deferToNext}
                      title={t.deferToNext ? 'Not charged today — this is the price quoted for the next visit' : undefined}
                      placeholder="0"
                      className={cn('form-input !py-2 text-right font-bold text-sm',
                        t.deferToNext && 'opacity-50 cursor-not-allowed')} />
                    {!t.deferToNext && disc > 0 && (
                      <p className="text-xs text-green-600 text-right mt-0.5">−{formatLKR(disc)} off</p>
                    )}
                    {!t.deferToNext && t.multiSession && remaining > 0 && (
                      <p className="text-xs text-amber-700 text-right mt-0.5">{formatLKR(remaining)} future</p>
                    )}
                    {/* Multi-session with the full fee charged today carries nothing forward */}
                    {!t.deferToNext && t.multiSession && remaining === 0 && t.listPrice > 0 && (
                      <p className="text-xs text-amber-700 text-right mt-0.5">
                        lower this to carry a balance
                      </p>
                    )}
                    {t.deferToNext && (
                      <p className="text-xs text-amber-700 text-right mt-0.5">not billed today</p>
                    )}
                  </div>
                  {/* When: doing it today, or holding it for the next visit */}
                  <div className="col-span-3 flex items-center justify-center gap-2">
                    <div className="flex rounded-lg bg-gray-200 p-0.5">
                      <button type="button"
                        title="Doing this treatment today — goes on today's bill"
                        onClick={() => updateTx(t.id, 'deferToNext', false)}
                        className={cn('h-7 rounded-md px-2.5 text-xs font-semibold transition-colors',
                          !t.deferToNext ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                        Today
                      </button>
                      <button type="button"
                        title="Not doing this today — moves to the next-visit plan, off today's bill"
                        onClick={() => {
                          updateTx(t.id, 'deferToNext', true)
                          updateTx(t.id, 'multiSession', false)
                        }}
                        className={cn('h-7 rounded-md px-2.5 text-xs font-semibold transition-colors',
                          t.deferToNext ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-amber-700')}>
                        Next visit
                      </button>
                    </div>
                    {!t.deferToNext && (
                      <button type="button"
                        title={t.multiSession ? 'This treatment continues in future sessions' : 'Mark as multi-session treatment'}
                        onClick={() => updateTx(t.id, 'multiSession', !t.multiSession)}
                        className={cn('h-7 rounded-lg px-2 text-xs font-semibold flex items-center gap-1 transition-colors',
                          t.multiSession ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-amber-100 hover:text-amber-700')}>
                        <Calendar className="w-3.5 h-3.5" />
                        {t.multiSession ? 'Future' : 'Multi'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <button onClick={() => setTxItems(p => [...p, { id: uid(), description: '', toothNumber: '', listPrice: 0, chargeAmt: 0, deferToNext: false, multiSession: false }])}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm">
              <Plus className="w-4 h-4" />Add treatment
            </button>

            {/* Deferred note */}
            {deferredTx.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                <span className="font-semibold">
                  {deferredTx.length} treatment{deferredTx.length > 1 ? 's' : ''} held for the next visit:
                </span>
                {' '}{deferredTx.map(t => t.description).join(', ')}
                <span className="block mt-0.5 text-amber-600">
                  Not billed today — carried into step 5 and shown when the patient returns.
                </span>
              </div>
            )}

            {/* Totals */}
            {todayTx.length > 0 && (
              <div className="flex justify-end">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-right space-y-1">
                  {futureBalance > 0 && (
                    <p className="text-sm text-amber-700 font-semibold">
                      Future session balance: {formatLKR(futureBalance)}
                    </p>
                  )}
                  {totalDiscount > 0 && (
                    <p className="text-sm text-green-600 font-semibold">
                      Total discount: −{formatLKR(totalDiscount)}
                    </p>
                  )}
                  <p className="text-sm text-blue-600">Total for today</p>
                  <p className="text-2xl font-bold text-blue-900">{formatLKR(subtotal)}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => setStep('plan')} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />Back</button>
              <button onClick={buildNextVisits} className="btn-primary">
                Next: Plan Future Visits <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: NEXT VISITS ───────────────────────────────────────────── */}
      {step === 'next' && (
        <div className="section-card">
          <div className="section-card-header">
            <div><h2 className="text-xl font-bold text-gray-900">5. Next Visits Plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">What the patient still needs — shown when they return</p></div>
          </div>
          <div className="section-card-body space-y-4">

            {/* Items for future visits */}
            <div className="space-y-2">
              {nextVisitItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <input type="text" value={item.description}
                      onChange={e => setNextVisitItems(p => p.map(x => x.id === item.id ? { ...x, description: e.target.value } : x))}
                      className="form-input !py-1.5 !text-sm" placeholder="Treatment description" />
                  </div>
                  <input type="text" value={item.tooth}
                    onChange={e => setNextVisitItems(p => p.map(x => x.id === item.id ? { ...x, tooth: e.target.value } : x))}
                    className="form-input !py-1.5 !text-sm w-16 text-center font-mono" placeholder="Tooth" />
                  <input type="number" min="0" step="any" value={item.price || ''}
                    onChange={e => setNextVisitItems(p => p.map(x => x.id === item.id ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                    className="form-input !py-1.5 !text-sm w-24 text-right font-semibold text-green-700 flex-shrink-0"
                    placeholder="Quote" />
                  <button onClick={() => setNextVisitItems(p => p.filter(x => x.id !== item.id))}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setNextVisitItems(p => [...p, { id: uid(), description: '', tooth: '', price: 0 }])}
              className="flex items-center gap-2 text-amber-600 hover:text-amber-800 font-semibold text-sm">
              <Plus className="w-4 h-4" />Add item for next visit
            </button>

            <div>
              <label className="form-label">Summary note for doctor at next visit</label>
              <input value={nextNote} onChange={e => setNextNote(e.target.value)}
                className="form-input" placeholder="e.g. Continue root canal tooth 26, review extraction site" />
              <p className="form-hint">This appears as the highlighted banner when the patient returns.</p>
            </div>

            <div>
              <label className="form-label">Expected return date</label>
              <input type="date" value={expectedReturnDate}
                onChange={e => setExpectedReturnDate(e.target.value)}
                className="form-input sm:max-w-[220px]" />
              <p className="form-hint">
                When you expect to see this patient again. Optional, and separate from booking an
                appointment below — set it even for patients who will just walk back in.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <input
                  type="checkbox"
                  checked={scheduleNextAppointment}
                  onChange={e => {
                    setScheduleNextAppointment(e.target.checked)
                    if (e.target.checked && nextAppointmentItemIds.length === 0 && nextVisitItems[0]) {
                      setNextAppointmentItemIds([nextVisitItems[0].id])
                    }
                  }}
                  className="h-4 w-4 rounded border-blue-300 text-blue-600"
                />
                Schedule the immediate next appointment
              </label>
              {scheduleNextAppointment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label !text-xs">Date</label>
                    <input
                      type="date"
                      value={nextAppointmentDate}
                      onChange={e => setNextAppointmentDate(e.target.value)}
                      className="form-input !py-2"
                    />
                  </div>
                  <div>
                    <label className="form-label !text-xs">Time</label>
                    <select
                      value={nextAppointmentTime}
                      onChange={e => setNextAppointmentTime(e.target.value)}
                      className="form-input !py-2"
                    >
                      {NEXT_APPOINTMENT_TIMES.map(time => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label !text-xs">Appointment type</label>
                    <select
                      value={nextAppointmentType}
                      onChange={e => setNextAppointmentType(e.target.value)}
                      className="form-input !py-2"
                    >
                      {NEXT_APPOINTMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label !text-xs">Duration</label>
                    <select
                      value={nextAppointmentDuration}
                      onChange={e => setNextAppointmentDuration(parseInt(e.target.value))}
                      className="form-input !py-2"
                    >
                      {[15, 30, 45, 60, 90, 120].map(mins => <option key={mins} value={mins}>{mins} min</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label !text-xs">Treatment for this appointment</label>
                    {nextVisitItems.length > 0 ? (
                      <div className="space-y-2 rounded-lg border border-blue-100 bg-white p-3">
                        {nextVisitItems.map(item => {
                          const checked = nextAppointmentItemIds.includes(item.id)
                          return (
                            <label key={item.id} className="flex items-start gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  setNextAppointmentItemIds(current =>
                                    e.target.checked
                                      ? [...current, item.id]
                                      : current.filter(id => id !== item.id)
                                  )
                                }}
                                className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600"
                              />
                              <span className="min-w-0">
                                <span className="font-semibold">{item.description || 'Untitled treatment'}</span>
                                {item.tooth ? <span className="text-gray-500"> - Tooth {item.tooth}</span> : null}
                                {item.price > 0 ? <span className="text-green-700"> - {formatLKR(item.price)}</span> : null}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-gray-500">
                        Add a next-visit treatment item above, then select it here.
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label !text-xs">Reason</label>
                    <input
                      value={nextAppointmentReason}
                      onChange={e => setNextAppointmentReason(e.target.value)}
                      className="form-input !py-2"
                      placeholder="e.g. Continue root canal tooth 22"
                    />
                  </div>
                </div>
              )}
              <p className="text-xs font-semibold text-blue-700">
                Schedule only the next upcoming visit. Further sessions can be booked during that appointment.
              </p>
            </div>

            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => setStep('treatment')} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />Back</button>
              <button onClick={() => setStep('prescription')} className="btn-primary">
                Next: Prescription <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 6: PRESCRIPTION ─────────────────────────────────────────── */}
      {step === 'prescription' && (
        <div className="section-card">
          <div className="section-card-header">
            <div><h2 className="text-xl font-bold text-gray-900">6. Prescription</h2>
            <span className="text-sm text-gray-400">Skip if no medicines needed</span></div>
          </div>
          <div className="section-card-body space-y-4">
            {rxItems.length === 0 ? (
              <div className="text-center py-8">
                <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-base text-gray-500 mb-4">No medicines added yet</p>
                <button onClick={addRx} className="btn-primary !bg-green-600">
                  <Plus className="w-4 h-4" />Add medicine</button>
              </div>
            ) : (
              <>
                {rxItems.map((rx, idx) => (
                  <div key={rx.id} className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-green-700">Medicine {idx + 1}</p>
                      <button onClick={() => setRxItems(p => p.filter(r => r.id !== rx.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SL_DRUGS.map(drug => (
                        <button key={drug.name} type="button" onClick={() => applyDrug(rx.id, drug)}
                          className={cn('text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                            rx.drugName === drug.name ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400')}>
                          {drug.name.split(' ')[0]}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Drug</label>
                        <input value={rx.drugName} onChange={e => updateRx(rx.id, 'drugName', e.target.value)} className="form-input !py-2" /></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Dose</label>
                        <select value={rx.dose} onChange={e => updateRx(rx.id, 'dose', e.target.value)} className="form-input !py-2">
                          <option value="">Select dose...</option>
                          {rx.dose && !DOSE_OPTIONS.includes(rx.dose) && <option value={rx.dose}>{rx.dose}</option>}
                          {DOSE_OPTIONS.map(dose => <option key={dose} value={dose}>{dose}</option>)}
                        </select></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Frequency</label>
                        <select value={rx.frequency} onChange={e => updateRx(rx.id, 'frequency', e.target.value)} className="form-input !py-2">
                          <option value="">Select frequency...</option>
                          {rx.frequency && !FREQUENCY_OPTIONS.includes(rx.frequency) && <option value={rx.frequency}>{rx.frequency}</option>}
                          {FREQUENCY_OPTIONS.map(frequency => <option key={frequency} value={frequency}>{frequency}</option>)}
                        </select></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Duration</label>
                        <input value={rx.duration} onChange={e => updateRx(rx.id, 'duration', e.target.value)} className="form-input !py-2" /></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Timing</label>
                        <select value={rx.timing} onChange={e => updateRx(rx.id, 'timing', e.target.value)} className="form-input !py-2">
                          <option value="">Any time</option>
                          {RX_TIMING_OPTIONS.map(timing => <option key={timing} value={timing}>{timing}</option>)}
                        </select></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Meals</label>
                        <select value={rx.mealRelation} onChange={e => updateRx(rx.id, 'mealRelation', e.target.value)} className="form-input !py-2">
                          <option value="">No meal instruction</option>
                          {MEAL_RELATION_OPTIONS.map(relation => <option key={relation} value={relation}>{relation}</option>)}
                        </select></div>
                    </div>
                    <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Additional instructions</label>
                      <input value={rx.instructions} onChange={e => updateRx(rx.id, 'instructions', e.target.value)} className="form-input !py-2" placeholder="e.g. Complete the full course" /></div>
                  </div>
                ))}
                <button onClick={addRx} className="flex items-center gap-2 text-green-600 hover:text-green-800 font-semibold text-sm">
                  <Plus className="w-4 h-4" />Add another</button>
                <div><label className="form-label">Notes</label>
                  <input value={rxNotes} onChange={e => setRxNotes(e.target.value)} className="form-input" /></div>
              </>
            )}
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => setStep('next')} className="btn-secondary"><ChevronLeft className="w-4 h-4" />Back</button>
              <button onClick={() => { setPayType('full'); setStep('bill') }} className="btn-primary">
                Next: Bill <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 7: BILL ─────────────────────────────────────────────────── */}
      {step === 'bill' && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-xl font-bold text-gray-900">7. Bill</h2>
          </div>
          <div className="section-card-body space-y-5">

            {/* Treatment summary with list price vs charged */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="grid grid-cols-3 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                <span>Treatment</span>
                <span className="text-right">List price</span>
                <span className="text-right">Charged</span>
              </div>
              {todayTx.map(t => (
                <div key={t.id} className="grid grid-cols-3 text-sm">
                  <span className="text-gray-700 truncate pr-2">
                    {t.description}{t.toothNumber ? ` (T${t.toothNumber})` : ''}
                  </span>
                  <span className={cn('text-right', t.chargeAmt < t.listPrice && !t.multiSession ? 'line-through text-gray-400' : 'text-gray-600')}>
                    {t.listPrice > 0 ? formatLKR(t.listPrice) : '—'}
                  </span>
                  <span className="text-right font-semibold text-gray-900">{formatLKR(t.chargeAmt)}</span>
                </div>
              ))}
              {xrayTaken && xrayCharge > 0 && (
                <div className="grid grid-cols-3 text-sm">
                  <span className="text-gray-700 truncate pr-2">X-ray - {xrayType}</span>
                  <span className="text-right text-gray-600">{formatLKR(xrayCharge)}</span>
                  <span className="text-right font-semibold text-gray-900">{formatLKR(xrayCharge)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-semibold">
                    <span>Treatment discount</span><span>−{formatLKR(totalDiscount)}</span>
                  </div>
                )}
                {futureBalance > 0 && (
                  <div className="flex justify-between text-sm text-amber-700 font-semibold">
                    <span>Future session balance</span><span>{formatLKR(futureBalance)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Subtotal</span><span>{formatLKR(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment type */}
            <div>
              <label className="form-label">Payment arrangement</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'full',        label: 'Full payment',     desc: 'Pay in full today'   },
                  { id: 'waive',       label: 'Additional waive', desc: 'Extra discount'      },
                ].map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => setPayType(opt.id as PayType)}
                    className={cn('p-4 rounded-xl border-2 text-left transition-all',
                      payType === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300')}>
                    <p className={cn('text-sm font-bold', payType === opt.id ? 'text-blue-700' : 'text-gray-900')}>{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Full payment split */}
            {payType === 'full' && (
              <div>
                <label className="form-label">Payment method</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Cash',     value: cashAmt,     set: setCashAmt     },
                    { label: 'Card',     value: cardAmt,     set: setCardAmt     },
                    { label: 'Transfer', value: transferAmt, set: setTransferAmt },
                  ].map(m => (
                    <div key={m.label}>
                      <label className="form-label !text-xs">{m.label} (Rs.)</label>
                      <input type="number" min="0" step="any" value={m.value || ''}
                        onChange={e => m.set(parseFloat(e.target.value) || 0)}
                        className="form-input text-right" />
                    </div>
                  ))}
                </div>
                {paid > 0 && paid !== totalPayable && (
                  <p className={cn('text-sm font-semibold mt-2 flex items-center gap-1',
                    paid > totalPayable ? 'text-amber-600' : 'text-gray-500')}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    {paid > totalPayable ? `Overpaid by ${formatLKR(paid - totalPayable)}` : `Underpaid by ${formatLKR(totalPayable - paid)}`}
                  </p>
                )}
              </div>
            )}

            {/* Installments — per treatment, per visit */}
            {payType === 'installment' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-700">Assign installment amounts by due visit</p>
                    <p className="text-xs font-semibold text-gray-500">The assigned schedule must equal the bill total before completing the visit.</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => splitInstallmentsAcrossVisits(3)} className="btn-secondary !px-3 !py-2 !text-xs">
                      Split 3 visits
                    </button>
                    <button type="button" onClick={assignInstallmentRemainderToday} className="btn-secondary !px-3 !py-2 !text-xs">
                      Assign balance today
                    </button>
                    <button type="button" onClick={addInstallRow} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-semibold">
                      <Plus className="w-3.5 h-3.5" />Add row
                    </button>
                  </div>
                </div>

                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <div className="col-span-5">Treatment</div>
                  <div className="col-span-3 text-center">Due visit</div>
                  <div className="col-span-3 text-right">Amount (Rs.)</div>
                  <div className="col-span-1" />
                </div>

                {installRows.map(row => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-center bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <div className="col-span-5">
                      <select value={row.treatmentId}
                        onChange={e => updateInstall(row.id, 'treatmentId', e.target.value)}
                        className="form-input !py-2 text-sm">
                        <option value="">Select treatment…</option>
                        {todayTx.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.description.length > 25 ? t.description.slice(0, 25) + '…' : t.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="1" max="20" value={row.visitNum}
                        onChange={e => updateInstall(row.id, 'visitNum', parseInt(e.target.value) || 1)}
                        className="form-input !py-2 text-center font-bold text-blue-700" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="0" step="any" value={row.amount || ''}
                        onChange={e => updateInstall(row.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="form-input !py-2 text-right font-semibold" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => setInstallRows(p => p.filter(r => r.id !== row.id))}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}

                {/* Visit summary */}
                {Object.keys(installByVisit).length > 0 && (
                  <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment schedule</p>
                    {Object.entries(installByVisit).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([vn, amt]) => (
                      <div key={vn} className="flex justify-between text-sm">
                        <span className={cn('font-semibold', parseInt(vn) === 1 ? 'text-blue-700' : 'text-gray-600')}>
                          {parseInt(vn) === 1 ? 'Today (Visit 1)' : `Visit ${vn}`}
                        </span>
                        <span className="font-bold text-gray-900">{formatLKR(amt as number)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                      <span>Total assigned</span>
                      <span className={cn(!installmentBalanced ? 'text-amber-600' : 'text-green-700')}>
                        {formatLKR(installTotal)}
                        {!installmentBalanced && ` (${formatLKR(Math.abs(installmentDelta))} ${installmentDelta < 0 ? 'unassigned' : 'over'})`}
                      </span>
                    </div>
                  </div>
                )}
                {!installmentBalanced && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Assign the remaining {formatLKR(Math.abs(installmentDelta))} before completing this visit.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Additional waive */}
            {payType === 'waive' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-amber-700">Additional waive / discount</p>
                <p className="text-xs text-amber-600">
                  Note: per-treatment discounts were already applied in Step 3.
                  This applies a further discount on the remaining total.
                </p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="form-label">Additional waive amount (Rs.)</label>
                    <input type="number" min="0" max={subtotal} step="any" value={billDiscount || ''}
                      onChange={e => setBillDiscount(parseFloat(e.target.value) || 0)}
                      className="form-input text-right text-xl font-bold" />
                  </div>
                  <button type="button" onClick={() => setBillDiscount(subtotal)} className="btn-secondary !text-sm mb-0.5">
                    Waive full</button>
                </div>
              </div>
            )}

            {/* Total box */}
            <div className="flex justify-end">
              <div className="rounded-2xl px-6 py-4 text-right border-2 bg-gray-50 border-gray-200 space-y-1">
                {(totalDiscount + billDiscount) > 0 && (
                  <p className="text-sm text-green-600 font-semibold">
                    Total discount: −{formatLKR(totalDiscount + billDiscount)}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  Total to pay today
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatLKR(totalPayable)}
                </p>
              </div>
            </div>

            <div><label className="form-label">Billing notes</label>
              <input value={billNotes} onChange={e => setBillNotes(e.target.value)}
                className="form-input" placeholder="Any payment notes" /></div>

            <div className="flex justify-between pt-3 border-t border-gray-100">
              <button onClick={() => setStep('prescription')} className="btn-secondary">
                <ChevronLeft className="w-4 h-4" />Back</button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-primary !bg-green-600 hover:!bg-green-700 min-w-[220px] justify-center"
              >
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : <><Check className="w-4 h-4" />Complete visit &amp; print</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 8: END VISIT ─────────────────────────────────────────────── */}
      {step === 'end' && savedVisitId && (
        <div className="section-card border-2 border-green-300 bg-green-50">
          <div className="section-card-header bg-green-100">
            <h2 className="text-xl font-bold text-green-900">8. Visit Ended</h2>
          </div>
          <div className="section-card-body space-y-5 text-center py-10">
            <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">Visit locked and sent to reception</p>
              <p className="text-base text-gray-500 mt-1">
                The patient now shows as ready to pay on the reception board.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a href={`/visits/${savedVisitId}?print=bill`}
                className="btn-secondary">
                <Receipt className="w-4 h-4" />Print bill
              </a>
              <a href={`/visits/${savedVisitId}?print=prescription`}
                className="btn-secondary">
                <FileText className="w-4 h-4" />Print prescription
              </a>
              <button onClick={() => router.push('/dashboard')} className="btn-primary !bg-green-600 hover:!bg-green-700">
                I am free - show next patient<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
