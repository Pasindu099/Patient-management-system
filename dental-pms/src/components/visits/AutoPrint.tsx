'use client'

import { useEffect } from 'react'

interface Props {
  target?: 'bill' | 'prescription'
}

export function AutoPrint({ target }: Props) {
  useEffect(() => {
    if (target) document.body.dataset.printTarget = target

    const clearTarget = () => {
      if (target) delete document.body.dataset.printTarget
      window.removeEventListener('afterprint', clearTarget)
    }

    const timer = setTimeout(() => {
      window.addEventListener('afterprint', clearTarget)
      window.print()
      window.setTimeout(clearTarget, 1200)
    }, 800)

    return () => {
      clearTimeout(timer)
      clearTarget()
    }
  }, [target])

  return null
}
