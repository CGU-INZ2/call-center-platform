'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Heart, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PrayerRequestModalProps {
  contactId: string
  contactName: string
}

export default function PrayerRequestModal({ contactId, contactName }: PrayerRequestModalProps) {
  const router = useRouter()
  const { user } = useUser()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'prayer' | 'testimony'>('prayer')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user || !content.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('prayer_requests').insert({
        contact_id: contactId,
        agent_id: user.id,
        type,
        content: content.trim(),
      })
      if (error) throw error
      toast.success(type === 'prayer' ? 'Prayer request logged' : 'Testimony logged')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(`Failed to log: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
    if (!val) {
      setType('prayer')
      setContent('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="bg-pink-500/10 border-pink-500/20 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300 gap-2"
          >
            <Heart className="h-4 w-4" />
            Log Prayer
          </Button>
        }
      />

      <DialogContent className="max-w-[480px] bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--border-default)] bg-pink-500/5">
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="h-8 w-8 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <Heart className="h-4 w-4 text-pink-400" />
            </div>
            Log Prayer / Testimony
          </DialogTitle>
          <p className="text-xs text-[var(--text-secondary)] mt-1">For: {contactName}</p>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('prayer')}
                className={`py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all ${
                  type === 'prayer'
                    ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                🙏 Prayer Request
              </button>
              <button
                onClick={() => setType('testimony')}
                className={`py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all ${
                  type === 'testimony'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                ✨ Testimony
              </button>
            </div>
          </div>

          {/* Content textarea */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              {type === 'prayer' ? 'Prayer Request Details' : 'Testimony Details'}
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={
                type === 'prayer'
                  ? 'Describe the prayer need…'
                  : 'Share the testimony or praise report…'
              }
              rows={5}
              className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm p-3 placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              className="text-[var(--text-secondary)]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={submitting || !content.trim()}
              onClick={handleSubmit}
              className="bg-pink-600 hover:bg-pink-500 text-white gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
              {type === 'prayer' ? 'Log Prayer Request' : 'Log Testimony'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
