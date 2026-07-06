'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageSquare, ChevronDown, Send, CheckCircle2, Loader2 } from 'lucide-react'
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

interface Template {
  id: string
  name: string
  body: string
}

interface WhatsAppModalProps {
  contactId: string
  contactName: string
  contactPhone: string
}

export default function WhatsAppModal({ contactId, contactName, contactPhone }: WhatsAppModalProps) {
  const router = useRouter()
  const { user } = useUser()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [customBody, setCustomBody] = useState('')
  const [step, setStep] = useState<'compose' | 'confirm'>('compose')
  const [submitting, setSubmitting] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Build the final message: use selected template body or custom, replacing {name}
  const resolvedBody = (() => {
    const base = selectedTemplateId === 'custom'
      ? customBody
      : templates.find(t => t.id === selectedTemplateId)?.body ?? ''
    return base.replace(/\{name\}/gi, contactName)
  })()

  const selectedTemplateName = selectedTemplateId === 'custom'
    ? 'Custom'
    : templates.find(t => t.id === selectedTemplateId)?.name ?? ''

  const cleanPhone = contactPhone.replace(/\D/g, '')
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(resolvedBody)}`

  // Fetch templates when modal opens
  useEffect(() => {
    if (!open) return
    const fetchTemplates = async () => {
      setLoadingTemplates(true)
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, name, body')
        .order('name')
      if (!error && data) setTemplates(data)
      setLoadingTemplates(false)
    }
    fetchTemplates()
  }, [open])

  const handleOpenWhatsApp = () => {
    window.open(waLink, '_blank', 'noopener,noreferrer')
    setStep('confirm')
  }

  const handleConfirmSent = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('whatsapp_messages').insert({
        contact_id: contactId,
        agent_id: user.id,
        template_used: selectedTemplateName || null,
        body: resolvedBody,
        marked_sent_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Message logged successfully')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(`Failed to log message: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
    if (!val) {
      // Reset state on close
      setStep('compose')
      setSelectedTemplateId('')
      setCustomBody('')
    }
  }

  const canSend = resolvedBody.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </Button>
        }
      />

      <DialogContent className="max-w-[520px] bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--border-default)] bg-emerald-500/5">
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
            </div>
            Send WhatsApp to {contactName}
          </DialogTitle>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{contactPhone}</p>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {step === 'compose' ? (
            <>
              {/* Template Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Select Template
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading templates…
                  </div>
                ) : (
                  <Select value={selectedTemplateId} onValueChange={(v) => setSelectedTemplateId(v ?? '')}>
                    <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] h-10">
                      <SelectValue placeholder="Choose a template…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-[var(--text-primary)]">
                          {t.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-[var(--text-primary)] border-t border-[var(--border-subtle)] mt-1">
                        ✏️ Write custom message
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Custom textarea */}
              {selectedTemplateId === 'custom' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Custom Message
                  </label>
                  <textarea
                    value={customBody}
                    onChange={e => setCustomBody(e.target.value)}
                    placeholder="Type your message… Use {name} for the contact's name."
                    rows={4}
                    className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm p-3 placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>
              )}

              {/* Message Preview */}
              {resolvedBody && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Preview
                  </label>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{resolvedBody}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="text-[var(--text-secondary)]"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!canSend}
                  onClick={handleOpenWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  <Send className="h-4 w-4" />
                  Open WhatsApp
                </Button>
              </div>
            </>
          ) : (
            /* Confirm sent step */
            <div className="space-y-5">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Message Sent</p>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{resolvedBody}</p>
              </div>

              <p className="text-sm text-[var(--text-secondary)] text-center">
                Did you successfully send this message to <span className="text-white font-semibold">{contactName}</span>?
              </p>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-[var(--border-default)] text-[var(--text-secondary)]"
                  onClick={() => setStep('compose')}
                >
                  Go Back
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                  disabled={submitting}
                  onClick={handleConfirmSent}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Yes, Log Message
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
