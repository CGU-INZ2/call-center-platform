'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteContactButtonProps {
  contactId: string
  contactName: string
}

export default function DeleteContactButton({
  contactId,
  contactName,
}: DeleteContactButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete contact')
      }

      toast.success(`Contact "${contactName}" deleted successfully.`)
      setOpen(false)
      router.push('/contacts')
      router.refresh()
    } catch (err: any) {
      console.error('Delete contact error:', err)
      toast.error(err.message || 'Failed to delete contact.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 gap-2 ml-auto"
        title="Superadmin: Delete Contact"
      >
        <Trash2 className="h-4 w-4" />
        Delete Contact
      </Button>

      <Dialog open={open} onOpenChange={(val) => !deleting && setOpen(val)}>
        <DialogContent className="bg-[var(--bg-surface)] border-[var(--border-default)] text-white sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[var(--danger-muted)]/30 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold text-white">
                Delete Contact Record
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{contactName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1.5">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
              Super Administrator Action
            </p>
            <p>
              This will permanently remove this contact profile along with all associated call records, follow-up tasks, prayer logs, and message history.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="bg-transparent border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)] text-xs h-8.5"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white font-semibold text-xs h-8.5 shadow-md flex items-center gap-1.5 ml-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
