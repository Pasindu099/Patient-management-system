'use client'

import { useEffect } from 'react'

interface Props {
  target?: 'bill' | 'prescription'
  closeAfterPrint?: boolean
}

export function AutoPrint({ target, closeAfterPrint = false }: Props) {
  useEffect(() => {
    if (target) document.body.dataset.printTarget = target

    function handleAfterPrint() {
      clearTarget(true)
    }
    function clearTarget(shouldClose = false) {
      if (target) delete document.body.dataset.printTarget
      window.removeEventListener('afterprint', handleAfterPrint)
      if (shouldClose && closeAfterPrint) {
        window.setTimeout(() => window.close(), 150)
      }
    }

    const timer = setTimeout(() => {
      window.addEventListener('afterprint', handleAfterPrint)
      window.print()
      window.setTimeout(() => clearTarget(true), 1200)
    }, 800)

    return () => {
      clearTimeout(timer)
      clearTarget(false)
    }
  }, [target, closeAfterPrint])

  return null
}
