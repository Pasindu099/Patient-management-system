'use client'

import { useEffect, useRef, useState } from 'react'
import { CameraOff, Loader2 } from 'lucide-react'

interface Props {
  // Called with the decoded text. May fire repeatedly while the label sits in
  // frame — the component suppresses repeats, but the parent should still be
  // safe against a duplicate.
  onScan: (code: string) => void
  // Pause decoding without tearing the camera down (e.g. while the quantity
  // form is open), so resuming doesn't re-prompt or flash a black frame.
  paused?: boolean
}

// Formats worth decoding: our own QR labels plus the common retail barcodes
// found preprinted on supplier boxes.
const FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] as const

// Ignore the same code for this long, so one label held in frame produces one
// scan rather than thirty.
const REPEAT_SUPPRESSION_MS = 2500

export function CodeScanner({ onScan, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'running' | 'error'>('starting')
  const [errorMessage, setErrorMessage] = useState('')

  // Held in refs so the effect below doesn't re-run (and restart the camera)
  // every time the parent re-renders or a scan lands.
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let frameHandle: number | null = null
    let zxingControls: { stop: () => void } | null = null

    function emit(raw: string) {
      const code = raw.trim()
      if (!code || pausedRef.current) return
      const last = lastScanRef.current
      if (last && last.code === code && Date.now() - last.at < REPEAT_SUPPRESSION_MS) return
      lastScanRef.current = { code, at: Date.now() }
      onScanRef.current(code)
    }

    async function start() {
      // getUserMedia only exists in a secure context. Over plain HTTP on a LAN
      // address the API is simply absent, which is the single most common way
      // this screen "mysteriously" fails on a tablet.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setErrorMessage(
          'The camera needs a secure (HTTPS) connection. Open this page over HTTPS, or use the code box below with a USB scanner.'
        )
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setStatus('running')

        const Detector = (window as any).BarcodeDetector
        if (Detector) {
          // Native path (Android Chrome): fastest, no extra bundle work.
          const supported: string[] = await Detector.getSupportedFormats?.() ?? []
          const formats = FORMATS.filter(f => supported.length === 0 || supported.includes(f))
          const detector = new Detector({ formats })

          const tick = async () => {
            if (stopped) return
            if (!pausedRef.current && video.readyState >= 2) {
              try {
                const found = await detector.detect(video)
                if (found?.[0]?.rawValue) emit(found[0].rawValue)
              } catch {
                // A single dropped frame is not worth surfacing; keep looping.
              }
            }
            frameHandle = requestAnimationFrame(tick)
          }
          frameHandle = requestAnimationFrame(tick)
          return
        }

        // Fallback (iOS Safari, older browsers): pull in the WASM/JS decoder
        // only when it's actually needed, so Android never pays for it.
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped) return
        const reader = new BrowserMultiFormatReader()
        zxingControls = await reader.decodeFromVideoElement(video, result => {
          if (result) emit(result.getText())
        })
      } catch (err: any) {
        if (stopped) return
        setStatus('error')
        setErrorMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for this site, then reload.'
            : err?.name === 'NotFoundError'
              ? 'No camera found on this device. Use the code box below instead.'
              : 'Could not start the camera. Use the code box below instead.'
        )
      }
    }

    start()

    return () => {
      stopped = true
      if (frameHandle !== null) cancelAnimationFrame(frameHandle)
      zxingControls?.stop()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-900 aspect-[4/3]">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {status === 'running' && (
        <>
          {/* Aiming frame — gives staff something to centre the label in. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`w-3/5 aspect-square rounded-xl border-4 transition-colors ${paused ? 'border-white/30' : 'border-white/80'}`} />
          </div>
          <p className="absolute bottom-3 inset-x-0 text-center text-sm font-medium text-white/90 drop-shadow">
            {paused ? 'Paused — finish the item above' : 'Point at the label on the box'}
          </p>
        </>
      )}

      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Starting camera…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/90">
          <CameraOff className="w-8 h-8" />
          <p className="text-sm leading-relaxed">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
