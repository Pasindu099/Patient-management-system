import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

interface LoginAttempt {
  count: number
  resetAt: number
}

const loginAttempts = new Map<string, LoginAttempt>()
const LOGIN_LIMIT = 8
const LOGIN_WINDOW_MS = 15 * 60 * 1000

function normalizeLoginKey(email: string) {
  return email.trim().toLowerCase()
}

function recordFailedLogin(email: string) {
  const key = normalizeLoginKey(email)
  const now = Date.now()
  const existing = loginAttempts.get(key)

  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return
  }

  existing.count += 1
}

function assertLoginAllowed(email: string) {
  const attempt = loginAttempts.get(normalizeLoginKey(email))
  if (attempt && attempt.resetAt > Date.now() && attempt.count >= LOGIN_LIMIT) {
    throw new Error('Too many login attempts. Please wait 15 minutes and try again.')
  }
}

function clearLoginAttempts(email: string) {
  loginAttempts.delete(normalizeLoginKey(email))
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 60 * 60 }, // 1 hour; client guard enforces inactivity
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter your email and password')
        }

        const email = credentials.email as string
        assertLoginAllowed(email)

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          recordFailedLogin(email)
          throw new Error('No account found with that email address')
        }

        if (!user.isActive) {
          throw new Error('Your account has been deactivated. Please contact the administrator.')
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValidPassword) {
          recordFailedLogin(email)
          throw new Error('Incorrect password. Please try again.')
        }

        clearLoginAttempts(email)

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          role:  user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id as string
        token.role     = (user as any).role
        token.isActive = true
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id       = token.id as string
        session.user.role     = token.role as UserRole
        session.user.isActive = token.isActive !== false
      }
      return session
    },
  },
})
