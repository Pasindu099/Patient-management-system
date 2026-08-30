import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const password = process.env.RESET_ADMIN_PASSWORD
  if (!password || password.length < 16) {
    throw new Error('Set RESET_ADMIN_PASSWORD to a unique value with at least 16 characters before running this script.')
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { email: 'admin@lumoradentalstudio.com' },
    data: { password: hashedPassword },
  })

  console.log('Admin password reset complete.')
  console.log('Email: admin@lumoradentalstudio.com')
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
