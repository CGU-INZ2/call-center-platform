import { createAdminClient } from '@/lib/supabase/admin'

interface RateLimitConfig {
  action: string
  identifier: string
  maxRequests: number
  windowMs: number
}

export async function isRateLimited(config: RateLimitConfig): Promise<{
  limited: boolean
  remaining: number
  reset: Date
}> {
  const supabase = createAdminClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  // 1. Clean up old rate limit logs (> 1 hour old) to keep the table clean
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  try {
    await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', oneHourAgo.toISOString())
  } catch (err) {
    console.error('Failed to clean up rate limits:', err)
  }

  // 2. Count requests in the active sliding window
  const { count, error } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', config.identifier)
    .eq('action', config.action)
    .gte('created_at', windowStart.toISOString())

  if (error) {
    console.error('Rate limiting DB error:', error)
    // In case rate_limits table does not exist or fails, fail-open to not block users, but log the issue
    return { limited: false, remaining: config.maxRequests, reset: now }
  }

  const currentRequests = count || 0

  if (currentRequests >= config.maxRequests) {
    return {
      limited: true,
      remaining: 0,
      reset: new Date(now.getTime() + config.windowMs)
    }
  }

  // 3. Log request
  const { error: insertError } = await supabase.from('rate_limits').insert({
    identifier: config.identifier,
    action: config.action
  })

  if (insertError) {
    console.error('Rate limiting insert error:', insertError)
  }

  return {
    limited: false,
    remaining: config.maxRequests - currentRequests - 1,
    reset: new Date(now.getTime() + config.windowMs)
  }
}
