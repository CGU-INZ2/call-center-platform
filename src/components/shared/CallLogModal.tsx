'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, PhoneCall } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Outcome mapping: UI label → DB enum value ───────────────────────────────
const OUTCOME_OPTIONS = [
  { label: 'Connected',           value: 'answered' },
  { label: 'Voicemail',           value: 'no_answer' },
  { label: 'No Answer',           value: 'no_answer' },
  { label: 'Busy',                value: 'busy' },
  { label: 'Wrong Number',        value: 'other' },
  { label: 'Disconnected',        value: 'other' },
  { label: 'Prayer Request',      value: 'prayer_request' },
  { label: 'Not Interested',      value: 'not_interested' },
  { label: 'Callback Requested',  value: 'callback_requested' },
] as const

const NEXT_ACTION_OPTIONS = [
  { label: 'None',             value: 'None' },
  { label: 'Follow Up',        value: 'Follow Up' },
  { label: 'Send WhatsApp',    value: 'Send WhatsApp' },
  { label: 'Add to Prayer',    value: 'Add to Prayer' },
  { label: 'Refer to Leader',  value: 'Refer to Leader' },
]

const STATUS_OPTIONS = [
  { label: 'New',                 value: 'New' },
  { label: 'Attempted',           value: 'Attempted' },
  { label: 'Connected',           value: 'Connected' },
  { label: 'Follow-up Required',  value: 'Follow-up Required' },
  { label: 'Not Interested',      value: 'Not Interested' },
]

// ─── Props ────────────────────────────────────────────────────────────────────
interface CallLogModalProps {
  contactId: string
  contactName: string
  currentStatus: string | null
  /** Set by ContactsClient to control the modal from outside */
  externalOpen?: boolean
  onClose?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CallLogModal({
  contactId,
  contactName,
  currentStatus,
  externalOpen,
  onClose,
}: CallLogModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useUser()

  // Determine if the dialog is controlled externally (table row) or internally (detail page)
  const isExternallyControlled = externalOpen !== undefined

  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Form fields
  const [outcome, setOutcome] = useState('')
  const [duration, setDuration] = useState('')       // minutes (user input)
  const [notes, setNotes] = useState('')
  const [nextAction, setNextAction] = useState('None')
  const [followUpDate, setFollowUpDate] = useState('')
  const [newStatus, setNewStatus] = useState(currentStatus ?? 'New')

  // Derived
  const isOpen = isExternallyControlled ? externalOpen : open
  const showFollowUpDate = nextAction === 'Follow Up'

  // ─── Reset form state ───────────────────────────────────────────────────────
  const resetForm = () => {
    setOutcome('')
    setDuration('')
    setNotes('')
    setNextAction('None')
    setFollowUpDate('')
    setNewStatus(currentStatus ?? 'New')
    setIsSuccess(false)
    setIsSubmitting(false)
  }

  // ─── Handle dialog open / close ─────────────────────────────────────────────
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      resetForm()
      if (isExternallyControlled) {
        onClose?.()
      } else {
        setOpen(false)
      }
    } else {
      if (!isExternallyControlled) setOpen(true)
    }
  }

  // ─── "Done" button after success ────────────────────────────────────────────
  const handleDone = () => {
    handleOpenChange(false)
    router.refresh()
  }

  // ─── "Next Contact" button after success ────────────────────────────────────
  const handleNextContact = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('call_status', 'New')
      .eq('assigned_agent_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (data?.id) {
      handleOpenChange(false)
      router.push(`/contacts/${data.id}`)
    } else {
      toast.info('No more new contacts assigned to you.')
      handleDone()
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!outcome) {
      toast.error('Please select a call outcome.')
      return
    }
    if (showFollowUpDate && !followUpDate) {
      toast.error('Please select a follow-up date.')
      return
    }
    if (!profile) {
      toast.error('User session not found. Please refresh and try again.')
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Insert call record
      const { error: callError } = await supabase.from('calls').insert({
        contact_id: contactId,
        agent_id: profile.id,
        duration_secs: duration ? parseInt(duration) * 60 : null,
        outcome,
        notes: notes || null,
        next_action: nextAction !== 'None' ? nextAction : null,
      })

      if (callError) throw new Error(`Failed to log call: ${callError.message}`)

      // Step 2: Update contact's last_contacted_at and call_status
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          last_contacted_at: new Date().toISOString(),
          call_status: newStatus,
        })
        .eq('id', contactId)

      if (contactError) throw new Error(`Failed to update contact: ${contactError.message}`)

      // Step 3: (Conditional) Insert follow-up record
      if (showFollowUpDate && followUpDate) {
        const { error: followupError } = await supabase.from('followups').insert({
          contact_id: contactId,
          agent_id: profile.id,
          due_at: new Date(followUpDate).toISOString(),
          notes: notes || null,
          status: 'pending',
        })

        if (followupError) throw new Error(`Failed to create follow-up: ${followupError.message}`)
      }

      // All 3 steps succeeded
      setIsSuccess(true)
      toast.success('Call logged successfully')
    } catch (err: any) {
      toast.error(err.message ?? 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Only render a trigger button when the modal manages its own state (detail page) */}
      {!isExternallyControlled && (
        <DialogTrigger
          render={
            <Button
              className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] text-[var(--text-inverse)] font-semibold gap-2 hover:opacity-90 transition-opacity"
            >
              <PhoneCall className="h-4 w-4" />
              Log Call
            </Button>
          }
        />
      )}

      <DialogContent className="max-w-[500px] bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--border-default)]">
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-[var(--gold-400)]" />
            Log Call — {contactName}
          </DialogTitle>
        </DialogHeader>

        {/* ── Success State ────────────────────────────────────────────── */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
              <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-white">Call logged successfully</p>
              <p className="text-sm text-[var(--text-secondary)]">
                What would you like to do next?
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                onClick={handleDone}
              >
                Done
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] text-[var(--text-inverse)] font-semibold hover:opacity-90"
                onClick={handleNextContact}
              >
                Next Contact →
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form ─────────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-0">
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Outcome (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Outcome <span className="text-[var(--danger)]">*</span>
                </label>
                <Select value={outcome} onValueChange={(val) => setOutcome(val ?? '')} required>
                  <SelectTrigger className="w-full bg-[var(--bg-root)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20">
                    <SelectValue placeholder="Select outcome…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-default)]">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <SelectItem key={`${opt.label}-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-md bg-[var(--bg-root)] border border-[var(--border-default)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--gold-500)] focus:ring-2 focus:ring-[var(--gold-500)]/20 transition-colors placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                  rows={3}
                  className="w-full rounded-md bg-[var(--bg-root)] border border-[var(--border-default)] text-[var(--text-primary)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--gold-500)] focus:ring-2 focus:ring-[var(--gold-500)]/20 transition-colors placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Next Action */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Next Action
                </label>
                <Select value={nextAction} onValueChange={(val) => setNextAction(val ?? 'None')}>
                  <SelectTrigger className="w-full bg-[var(--bg-root)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-default)]">
                    {NEXT_ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow-up Date (conditional) */}
              {showFollowUpDate && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-xs font-semibold text-[var(--gold-400)] uppercase tracking-wide">
                    Follow-up Date <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full rounded-md bg-[var(--bg-root)] border border-[var(--gold-500)]/40 text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--gold-500)] focus:ring-2 focus:ring-[var(--gold-500)]/20 transition-colors"
                  />
                </div>
              )}

              {/* Update Status To */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Update Status To
                </label>
                <Select value={newStatus} onValueChange={(val) => setNewStatus(val ?? '')}>
                  <SelectTrigger className="w-full bg-[var(--bg-root)] border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--gold-500)] focus:ring-[var(--gold-500)]/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-default)]">
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border-default)] flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !outcome}
                className="flex-1 bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] text-[var(--text-inverse)] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? 'Logging…' : 'Log Call'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
