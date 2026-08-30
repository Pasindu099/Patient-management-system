import type { UserRole } from '@prisma/client'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id:    string
      email: string
      name:  string
      role:  UserRole
      isActive: boolean
      image?: string | null
    }
  }
  interface User {
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:   string
    role: UserRole
    isActive: boolean
  }
}
