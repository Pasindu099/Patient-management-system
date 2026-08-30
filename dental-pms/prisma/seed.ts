import { PrismaClient, UserRole, Gender, AppointmentStatus, AppointmentType, BookingSource, Currency } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding DentalCare SL database...')

  const hashedPassword = await bcrypt.hash('DentalPMS2024!', 12)

  // ─── BRANCHES ────────────────────────────────────────────────────
  const colombo = await prisma.branch.upsert({
    where: { id: 'branch-colombo' },
    update: {},
    create: {
      id: 'branch-colombo',
      name: 'Colombo 03',
      address: '45 Bauddhaloka Mawatha',
      city: 'Colombo',
      phone: '+94 11 234 5678',
      email: 'colombo@dentalcare.lk',
    },
  })

  const kandy = await prisma.branch.upsert({
    where: { id: 'branch-kandy' },
    update: {},
    create: {
      id: 'branch-kandy',
      name: 'Kandy',
      address: '12 Dalada Veediya',
      city: 'Kandy',
      phone: '+94 81 234 5678',
      email: 'kandy@dentalcare.lk',
    },
  })

  console.log('✅ Branches created')

  // ─── STAFF ───────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dentalcare.lk' },
    update: {},
    create: {
      email: 'admin@dentalcare.lk',
      name: 'Admin User',
      password: hashedPassword,
      role: UserRole.ADMIN,
      phone: '+94 77 100 0000',
    },
  })

  const dentist1 = await prisma.user.upsert({
    where: { email: 'dr.perera@dentalcare.lk' },
    update: {},
    create: {
      email: 'dr.perera@dentalcare.lk',
      name: 'Dr. Saman Perera',
      password: hashedPassword,
      role: UserRole.DOCTOR,
      phone: '+94 77 200 0001',
    },
  })

  const dentist2 = await prisma.user.upsert({
    where: { email: 'dr.silva@dentalcare.lk' },
    update: {},
    create: {
      email: 'dr.silva@dentalcare.lk',
      name: 'Dr. Nimali Silva',
      password: hashedPassword,
      role: UserRole.DOCTOR,
      phone: '+94 77 200 0002',
    },
  })

  const hygienist = await prisma.user.upsert({
    where: { email: 'hygiene@dentalcare.lk' },
    update: {},
    create: {
      email: 'hygiene@dentalcare.lk',
      name: 'Kumari Jayawardena',
      password: hashedPassword,
      role: UserRole.DOCTOR,
      phone: '+94 77 300 0001',
    },
  })

  const clinicManager = await prisma.user.upsert({
    where: { email: 'manager@dentalcare.lk' },
    update: {},
    create: {
      email: 'manager@dentalcare.lk',
      name: 'Nimal Perera',
      password: hashedPassword,
      role: UserRole.HEAD_NURSE,
      phone: '+94 77 500 0001',
    },
  })

  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@dentalcare.lk' },
    update: {},
    create: {
      email: 'reception@dentalcare.lk',
      name: 'Kasun Fernando',
      password: hashedPassword,
      role: UserRole.RECEPTIONIST,
      phone: '+94 77 400 0001',
    },
  })

  // Assign staff to branches
  for (const a of [
    { userId: admin.id,        branchId: colombo.id, isPrimary: true },
    { userId: admin.id,        branchId: kandy.id,   isPrimary: false },
    { userId: dentist1.id,     branchId: colombo.id, isPrimary: true },
    { userId: dentist1.id,     branchId: kandy.id,   isPrimary: false },
    { userId: dentist2.id,     branchId: colombo.id, isPrimary: true },
    { userId: hygienist.id,    branchId: colombo.id, isPrimary: true },
    { userId: receptionist.id, branchId: colombo.id, isPrimary: true },
    { userId: receptionist.id, branchId: kandy.id,   isPrimary: false },
    { userId: clinicManager.id, branchId: colombo.id, isPrimary: true },
  ]) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: a.userId, branchId: a.branchId } },
      update: {},
      create: a,
    })
  }

  console.log('✅ Staff + branch assignments created')

  // ─── PATIENTS ────────────────────────────────────────────────────
  const patient1 = await prisma.patient.upsert({
    where: { patientNumber: 'PT-004821' },
    update: {},
    create: {
      patientNumber: 'PT-004821',
      firstName: 'Dilini',
      lastName: 'Wickramasinghe',
      dateOfBirth: new Date('1987-03-14'),
      gender: Gender.FEMALE,
      nicNumber: '875730485V',
      email: 'dilini.w@gmail.com',
      phone: '+94 77 123 4567',
      addressLine1: '23/4 Flower Road',
      city: 'Colombo',
      district: 'Colombo',
      province: 'Western',
      preferredLanguage: 'si',
      communicationPref: 'whatsapp',
      firstVisitDate: new Date('2020-01-15'),
      lastVisitDate: new Date('2025-11-18'),
      medicalHistory: {
        create: {
          allergies: [
            { substance: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis', confirmed: true }
          ],
          medications: [
            { name: 'Metformin', dose: '500mg', frequency: 'twice daily', prescriber: 'Dr. Bandara' },
          ],
          conditions: [
            { condition: 'Type 2 Diabetes', status: 'controlled', diagnosedDate: '2018-03-01' },
          ],
          isSmoker: false,
          anxietyLevel: 2,
          pdpaConsentDate: new Date('2020-01-15'),
        },
      },
    },
  })

  const patient2 = await prisma.patient.upsert({
    where: { patientNumber: 'PT-004822' },
    update: {},
    create: {
      patientNumber: 'PT-004822',
      firstName: 'Ruwan',
      lastName: 'Jayasuriya',
      dateOfBirth: new Date('1979-08-22'),
      gender: Gender.MALE,
      nicNumber: '792351234V',
      email: 'ruwan.j@yahoo.com',
      phone: '+94 71 987 6543',
      city: 'Colombo',
      district: 'Colombo',
      province: 'Western',
      preferredLanguage: 'en',
      communicationPref: 'sms',
      firstVisitDate: new Date('2019-06-20'),
      lastVisitDate: new Date('2026-01-05'),
      medicalHistory: {
        create: {
          allergies: [
            { substance: 'Latex', severity: 'moderate', reaction: 'Contact dermatitis', confirmed: true }
          ],
          medications: [
            { name: 'Atorvastatin', dose: '10mg', frequency: 'once daily', prescriber: 'Dr. Rajapaksa' },
          ],
          conditions: [
            { condition: 'Hypertension', status: 'managed', diagnosedDate: '2021-05-10' },
          ],
          isSmoker: true,
          anxietyLevel: 4,
          pdpaConsentDate: new Date('2019-06-20'),
        },
      },
    },
  })

  const patient3 = await prisma.patient.upsert({
    where: { patientNumber: 'PT-004823' },
    update: {},
    create: {
      patientNumber: 'PT-004823',
      firstName: 'Priya',
      lastName: 'Rathnayake',
      dateOfBirth: new Date('1995-12-05'),
      gender: Gender.FEMALE,
      nicNumber: '957890234V',
      phone: '+94 76 555 7890',
      city: 'Kandy',
      district: 'Kandy',
      province: 'Central',
      preferredLanguage: 'si',
      communicationPref: 'whatsapp',
      firstVisitDate: new Date('2023-02-14'),
      lastVisitDate: new Date('2025-12-01'),
      medicalHistory: {
        create: {
          allergies: [],
          medications: [],
          conditions: [],
          pdpaConsentDate: new Date('2023-02-14'),
        },
      },
    },
  })

  const patient4 = await prisma.patient.upsert({
    where: { patientNumber: 'PT-004824' },
    update: {},
    create: {
      patientNumber: 'PT-004824',
      firstName: 'James',
      lastName: 'Mitchell',
      dateOfBirth: new Date('1982-04-18'),
      gender: Gender.MALE,
      passportNumber: 'GB12345678',
      email: 'j.mitchell@email.com',
      phone: '+44 7911 123456',
      city: 'Colombo',
      country: 'GB',
      preferredLanguage: 'en',
      communicationPref: 'email',
      notes: 'Expat. Prefers USD billing. Visits when in Colombo for work.',
      firstVisitDate: new Date('2024-03-10'),
      lastVisitDate: new Date('2025-10-22'),
      medicalHistory: {
        create: {
          allergies: [],
          medications: [],
          conditions: [],
        },
      },
    },
  })

  console.log('✅ Patients created')

  // ─── INSURANCE LETTERS ───────────────────────────────────────────
  await prisma.insuranceLetter.createMany({
    skipDuplicates: true,
    data: [
      {
        patientId: patient1.id,
        insurerName: 'AIA Insurance',
        policyNumber: 'AIA-20248811',
        memberName: 'Dilini Wickramasinghe',
        letterStatus: 'APPROVED',
        approvedAmount: 35000,
        currency: Currency.LKR,
        approvedAt: new Date('2026-01-10'),
      },
      {
        patientId: patient2.id,
        insurerName: 'Ceylinco Life',
        policyNumber: 'CEY-9934221',
        memberName: 'Ruwan Jayasuriya',
        letterStatus: 'PENDING',
        currency: Currency.LKR,
        submittedAt: new Date('2026-03-01'),
      },
    ],
  })

  console.log('✅ Insurance letters created')

  // ─── APPOINTMENTS ────────────────────────────────────────────────
  const d = (offsetDays: number, h: number, m = 0) => {
    const dt = new Date()
    dt.setDate(dt.getDate() + offsetDays)
    dt.setHours(h, m, 0, 0)
    return dt
  }

  await prisma.appointment.createMany({
    skipDuplicates: true,
    data: [
      {
        appointmentNumber: 'APT-002401',
        patientId: patient1.id, providerId: hygienist.id, branchId: colombo.id,
        type: AppointmentType.CLEANING, status: AppointmentStatus.CONFIRMED,
        bookingSource: BookingSource.WHATSAPP,
        startTime: d(1, 9), endTime: d(1, 10), durationMins: 60,
        chair: 'Chair 1', reason: 'Routine scaling and cleaning',
        noShowRisk: 0.10, confirmedAt: new Date(), confirmedBy: 'whatsapp',
      },
      {
        appointmentNumber: 'APT-002402',
        patientId: patient2.id, providerId: dentist1.id, branchId: colombo.id,
        type: AppointmentType.ROOT_CANAL, status: AppointmentStatus.SCHEDULED,
        bookingSource: BookingSource.PHONE,
        startTime: d(1, 10, 30), endTime: d(1, 12), durationMins: 90,
        chair: 'Chair 2', reason: 'Root canal treatment - tooth 26',
        noShowRisk: 0.35,
      },
      {
        appointmentNumber: 'APT-002403',
        patientId: patient3.id, providerId: dentist1.id, branchId: kandy.id,
        type: AppointmentType.CHECKUP, status: AppointmentStatus.SCHEDULED,
        bookingSource: BookingSource.WHATSAPP,
        startTime: d(2, 14), endTime: d(2, 14, 45), durationMins: 45,
        chair: 'Chair 1', noShowRisk: 0.08,
      },
      {
        appointmentNumber: 'APT-002404',
        patientId: patient4.id, providerId: dentist2.id, branchId: colombo.id,
        type: AppointmentType.CONSULTATION, status: AppointmentStatus.CONFIRMED,
        bookingSource: BookingSource.ONLINE,
        startTime: d(1, 14), endTime: d(1, 14, 30), durationMins: 30,
        chair: 'Chair 3', reason: 'Implant consultation', noShowRisk: 0.05,
      },
      {
        appointmentNumber: 'APT-002405',
        patientId: patient1.id, providerId: dentist1.id, branchId: colombo.id,
        type: AppointmentType.WALKIN, status: AppointmentStatus.COMPLETED,
        bookingSource: BookingSource.WALKIN,
        startTime: d(-1, 11), endTime: d(-1, 11, 45), durationMins: 45,
        chair: 'Chair 2', reason: 'Toothache — walk-in',
        arrivedAt: d(-1, 11), completedAt: d(-1, 11, 50),
      },
    ],
  })

  console.log('✅ Appointments created')

  // ─── RISK ASSESSMENTS ────────────────────────────────────────────
  await prisma.riskAssessment.createMany({
    skipDuplicates: true,
    data: [
      {
        patientId: patient1.id, overallScore: 74, riskLevel: 'HIGH',
        cariesScore: 78, perioScore: 45,
        riskFactors: [
          { factor: 'High sugar intake', impact: 'negative', detail: 'Frequent sweet drinks' },
          { factor: 'Type 2 Diabetes', impact: 'negative', detail: 'Elevated caries risk' },
          { factor: 'Good oral hygiene', impact: 'positive', detail: 'Brushes twice daily' },
        ],
        recommendations: [
          { type: 'treatment', text: 'Fluoride varnish at every hygiene visit' },
        ],
        nextReviewDate: new Date('2026-10-01'),
      },
      {
        patientId: patient2.id, overallScore: 62, riskLevel: 'MODERATE',
        cariesScore: 55, perioScore: 68,
        riskFactors: [
          { factor: 'Active smoker', impact: 'negative', detail: 'Elevated perio risk' },
          { factor: 'High anxiety', impact: 'negative', detail: 'May delay treatment' },
        ],
        recommendations: [
          { type: 'treatment', text: 'Full mouth scaling — prioritise perio' },
        ],
        nextReviewDate: new Date('2026-07-01'),
      },
    ],
  })

  await prisma.vitalSign.createMany({
    data: [
      { patientId: patient1.id, systolic: 132, diastolic: 84, pulse: 74, recordedAt: new Date('2025-11-18') },
      { patientId: patient2.id, systolic: 148, diastolic: 94, pulse: 82, recordedAt: new Date('2026-01-05') },
    ],
  })

  console.log('\n🎉 Seeding complete!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Login credentials  (password: DentalPMS2024!)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Admin        →  admin@dentalcare.lk')
  console.log('Dr. Perera   →  dr.perera@dentalcare.lk')
  console.log('Dr. Silva    →  dr.silva@dentalcare.lk')
  console.log('Hygienist    →  hygiene@dentalcare.lk')
  console.log('Receptionist →  reception@dentalcare.lk')
  console.log('Clinic Mgr   →  manager@dentalcare.lk')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('Branches: Colombo 03 · Kandy\n')
}

// ── TREATMENT FEES FROM CLINIC EXCEL ──────────────────────────────────────
async function seedTreatmentFees() {
  console.log('Seeding treatment fees...')

  const fees = [
    // RESTORATIVE
    { category: 'Restorative', subcategory: 'Permanent Teeth', name: 'Filling — Temporary',       price: 2500,   sortOrder: 1  },
    { category: 'Restorative', subcategory: 'Permanent Teeth', name: 'Filling — LCC',             price: 5000,   sortOrder: 2  },
    { category: 'Restorative', subcategory: 'Permanent Teeth', name: 'Filling — GIC',             price: 5000,   sortOrder: 3  },
    { category: 'Restorative', subcategory: 'Permanent Teeth', name: 'Indirect Pulp Capping',     price: 5500,   sortOrder: 4  },
    { category: 'Restorative', subcategory: 'Permanent Teeth', name: 'Partial Pulpotomy',         price: 6000,   sortOrder: 5  },
    { category: 'Restorative', subcategory: 'Deciduous Teeth', name: 'Filling — Temporary',       price: 2500,   sortOrder: 6  },
    { category: 'Restorative', subcategory: 'Deciduous Teeth', name: 'Filling — GIC',             price: 3000,   sortOrder: 7  },
    { category: 'Restorative', subcategory: 'Deciduous Teeth', name: 'Filling — LCC',             price: 3000,   sortOrder: 8  },
    { category: 'Restorative', subcategory: 'Deciduous Teeth', name: 'Pulpotomy',                 price: 3500,   sortOrder: 9  },
    { category: 'Restorative', subcategory: 'Deciduous Teeth', name: 'Pulpectomy',                price: 4000,   sortOrder: 10 },
    // PROSTHETIC
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 1 tooth',  price: 4000,  sortOrder: 11 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 2 teeth',  price: 7000,  sortOrder: 12 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 3 teeth',  price: 10000, sortOrder: 13 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 4 teeth',  price: 13000, sortOrder: 14 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 5 teeth',  price: 16000, sortOrder: 15 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 6 teeth',  price: 19000, sortOrder: 16 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Upper 7+ teeth', price: 20000, sortOrder: 17 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 1 tooth',  price: 4000,  sortOrder: 18 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 2 teeth',  price: 7000,  sortOrder: 19 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 3 teeth',  price: 10000, sortOrder: 20 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 4 teeth',  price: 13000, sortOrder: 21 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 5 teeth',  price: 16000, sortOrder: 22 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 6 teeth',  price: 19000, sortOrder: 23 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Acrylic Denture — Lower 7+ teeth', price: 20000, sortOrder: 24 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Metal Denture — Upper',       price: 0,      sortOrder: 25 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Metal Denture — Lower',       price: 0,      sortOrder: 26 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Crown — Metal',               price: 0,      sortOrder: 27 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Crown — PFM',                 price: 0,      sortOrder: 28 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Crown — Porcelain',           price: 0,      sortOrder: 29 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Crown — Emax',                price: 0,      sortOrder: 30 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Resin Bonded 2 Unit',price: 0,      sortOrder: 31 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Resin Bonded 3 Unit',price: 0,      sortOrder: 32 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Resin Bonded 4 Unit',price: 0,      sortOrder: 33 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Conventional 2 Unit',price: 0,      sortOrder: 34 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Conventional 3 Unit',price: 0,      sortOrder: 35 },
    { category: 'Prosthetic',  subcategory: 'Permanent Teeth', name: 'Bridge — Conventional 4 Unit',price: 0,      sortOrder: 36 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Pre-formed Metal Crown',      price: 8000,   sortOrder: 37 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Space Maintainer — Crown and Loop', price: 0, sortOrder: 38 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Space Maintainer — Band and Loop',  price: 0, sortOrder: 39 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Space Maintainer — Denture',  price: 0,      sortOrder: 40 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Space Maintainer — Lingual Arch', price: 0,  sortOrder: 41 },
    { category: 'Prosthetic',  subcategory: 'Deciduous Teeth', name: 'Space Maintainer — Palatal Arch', price: 0,  sortOrder: 42 },
    // PERIODONTAL
    { category: 'Periodontal', subcategory: null, name: 'FMS — Prophylactic Paste Polishing', price: 5000, sortOrder: 43 },
    { category: 'Periodontal', subcategory: null, name: 'FMS — Pumice Polishing',             price: 7000, sortOrder: 44 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 1 tooth',                      price: 1500, sortOrder: 45 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 2 teeth',                      price: 2000, sortOrder: 46 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 3 teeth',                      price: 2500, sortOrder: 47 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 4 teeth',                      price: 3000, sortOrder: 48 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 5 teeth',                      price: 3500, sortOrder: 49 },
    { category: 'Periodontal', subcategory: null, name: 'RSD — 6+ teeth',                     price: 4000, sortOrder: 50 },
    // ENDODONTIC
    { category: 'Endodontic',  subcategory: null, name: 'Root Canal — Anterior',               price: 18000, sortOrder: 51 },
    { category: 'Endodontic',  subcategory: null, name: 'Root Canal — Premolar',               price: 21000, sortOrder: 52 },
    { category: 'Endodontic',  subcategory: null, name: 'Root Canal — Molar',                  price: 25000, sortOrder: 53 },
    // COSMETIC
    { category: 'Cosmetic',    subcategory: null, name: 'Anterior Buildup',                    price: 7000,  sortOrder: 54 },
    { category: 'Cosmetic',    subcategory: null, name: 'Diastema Closure',                    price: 12000, sortOrder: 55 },
    { category: 'Cosmetic',    subcategory: null, name: 'Bleaching — Vital',                   price: 0,     sortOrder: 56 },
    { category: 'Cosmetic',    subcategory: null, name: 'Bleaching — Non-vital',               price: 0,     sortOrder: 57 },
    // ORTHODONTIC
    { category: 'Orthodontic', subcategory: 'Primary Dentition',   name: 'Tongue Crib',        price: 0, sortOrder: 58 },
    { category: 'Orthodontic', subcategory: 'Primary Dentition',   name: 'Thumb Guard',        price: 0, sortOrder: 59 },
    { category: 'Orthodontic', subcategory: 'Primary Dentition',   name: 'Reverse Pull Head Gear', price: 0, sortOrder: 60 },
    { category: 'Orthodontic', subcategory: 'Primary Dentition',   name: 'Facemask',           price: 0, sortOrder: 61 },
    { category: 'Orthodontic', subcategory: 'Primary Dentition',   name: 'Chin Cap',           price: 0, sortOrder: 62 },
    { category: 'Orthodontic', subcategory: 'Mixed Dentition',     name: 'RA Without Expansion', price: 0, sortOrder: 63 },
    { category: 'Orthodontic', subcategory: 'Mixed Dentition',     name: 'RA With Expansion',  price: 0, sortOrder: 64 },
    { category: 'Orthodontic', subcategory: 'Mixed Dentition',     name: 'Twin Block',         price: 0, sortOrder: 65 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Fixed Orthodontics — Full Mouth', price: 0, sortOrder: 66 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Fixed Orthodontics — Diastema Closure', price: 0, sortOrder: 67 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Fixed Orthodontics — Crossbite Correction', price: 0, sortOrder: 68 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Aligners — Consultation', price: 0, sortOrder: 69 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Aligners — Cases and Maintenance', price: 0, sortOrder: 70 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Retainer — Fixed Lingual', price: 0, sortOrder: 71 },
    { category: 'Orthodontic', subcategory: 'Permanent Dentition', name: 'Retainer — Hawley',  price: 0, sortOrder: 72 },
    // MINOR ORAL SURGERY
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Extraction',              price: 2000,  sortOrder: 73 },
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Dry Socket Management',   price: 1000,  sortOrder: 74 },
    { category: 'Minor Oral Surgery', subcategory: null, name: '3rd Molar Removal',       price: 15000, sortOrder: 75 },
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Operculectomy',           price: 5000,  sortOrder: 76 },
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Frenectomy',              price: 7000,  sortOrder: 77 },
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Mucocele Removal',        price: 7000,  sortOrder: 78 },
    { category: 'Minor Oral Surgery', subcategory: null, name: 'Gingivectomy',            price: 0,     sortOrder: 79 },
    // IMPLANTOLOGY
    { category: 'Implantology', subcategory: null, name: 'Implant and Crown',             price: 130000, sortOrder: 80 },
    { category: 'Implantology', subcategory: null, name: 'Implant and Bridge — 2 Units',  price: 0,      sortOrder: 81 },
    { category: 'Implantology', subcategory: null, name: 'Implant and Bridge — 3 Units',  price: 0,      sortOrder: 82 },
    { category: 'Implantology', subcategory: null, name: 'Sinus Lift — Crestal Approach', price: 0,      sortOrder: 83 },
    { category: 'Implantology', subcategory: null, name: 'Sinus Lift — Lateral Window',   price: 0,      sortOrder: 84 },
    { category: 'Implantology', subcategory: null, name: 'Osseodensification',             price: 0,      sortOrder: 85 },
    { category: 'Implantology', subcategory: null, name: 'Bone Grafting',                 price: 0,      sortOrder: 86 },
  ]

  await prisma.treatmentFee.deleteMany({})
  await prisma.treatmentFee.createMany({
    data: fees.map(f => ({ ...f, priceCents: Math.round(f.price * 100) })),
  })
  console.log(`Seeded ${fees.length} treatment fees`)
}

main()
  .then(seedTreatmentFees)
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
