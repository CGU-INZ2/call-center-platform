export function sanitizeInput(value: string): string {
  if (typeof value !== 'string') return value
  return value
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&': return '&amp;'
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '"': return '&quot;'
        case "'": return '&#x27;'
        default: return m
      }
    })
    .trim()
}
