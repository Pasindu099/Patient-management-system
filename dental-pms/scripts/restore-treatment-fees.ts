import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts')
  const source = fs.readFileSync(seedPath, 'utf8')
  const match = source.match(/const fees = (\[[\s\S]*?\])\s*\n\s*await prisma\.treatmentFee\.deleteMany/)

  if (!match) {
    throw new Error('Could not find treatment fee definitions in prisma/seed.ts')
  }

  const fees = Function(`"use strict"; return (${match[1]});`)() as Array<{
    category: string
    subcategory: string | null
    name: string
    price: number
    sortOrder: number
  }>

  await prisma.treatmentFee.deleteMany({})
  await prisma.treatmentFee.createMany({
    data: fees.map(fee => ({
      ...fee,
      priceCents: Math.round(fee.price * 100),
    })),
  })

  console.log(`Restored ${fees.length} treatment fees.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
