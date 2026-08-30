'use client'

import { useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'

const IDLE_LIMIT_MS = 60 * 60 * 1000
const ACTIVE_CHECK_MS = 15 * 1000

export function SessionGuard() {
  const lastActivity = useRef(Date.now())
  const signingOut = useRef(false)

  useEffect(() => {
    function markActive() {
      lastActivity.current = Date.now()
    }

    async function logout() {
      if (signingOut.current) return
      signingOut.current = true
      await signOut({ callbackUrl: '/login' })
    }

    const activityEvents = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll']
    activityEvents.forEach(event => window.addEventListener(event, markActive, { passive: true }))

    const timer = window.setInterval(async () => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) {
        await logout()
        return
      }

      try {
        const res = await fetch('/api/account-status', { cache: 'no-store' })
        const status = await res.json()
        if (!res.ok || !status.active) await logout()
      } catch {}
    }, ACTIVE_CHECK_MS)

    return () => {
      window.clearInterval(timer)
      activityEvents.forEach(event => window.removeEventListener(event, markActive))
    }
  }, [])

  return null
}
