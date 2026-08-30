// One-off: give every existing catalog item a scannable code.
// Safe to re-run — items that already have a code are skipped.
import { PrismaClient } from '@prisma/client'
import { nextItemCode } from '../src/lib/inventory'

const prisma = new PrismaClient()

async function main() {
  const missing = await prisma.inventoryItem.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })

  if (missing.length === 0) {
    console.log('All catalog items already have a code.')
    return
  }

  for (const item of missing) {
    const code = await nextItemCode(prisma)
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { code } })
    console.log(`  ${code}  ${item.name}`)
  }
  console.log(`\nAssigned codes to ${missing.length} item(s).`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
