import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `

  if (tables.length > 0) {
    const quotedTables = tables
      .map(({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`)
      .join(', ')

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`)
  }

  const password = process.env.RESET_ADMIN_PASSWORD
  if (!password || password.length < 16) {
    throw new Error('Set RESET_ADMIN_PASSWORD to a unique value with at least 16 characters before running this script.')
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const branch = await prisma.branch.create({
    data: {
      name: 'Lumora Dental Studio',
      city: 'Sri Lanka',
      email: 'hello@lumoradentalstudio.com',
      isActive: true,
    },
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@lumoradentalstudio.com',
      name: 'Lumora Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  })

  await prisma.userBranch.create({
    data: {
      userId: admin.id,
      branchId: branch.id,
      isPrimary: true,
    },
  })

  console.log('Production data reset complete.')
  console.log('Admin email: admin@lumoradentalstudio.com')
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
