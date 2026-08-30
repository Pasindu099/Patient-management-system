interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip') || 'unknown'
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) {
    buckets.forEach((bucket, bucketKey) => {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    })
  }

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, retryAfter: 0 }
  }

  existing.count += 1
  if (existing.count <= limit) {
    return { limited: false, retryAfter: 0 }
  }

  return {
    limited: true,
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
  }
}
