'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Trash2, MessageSquare, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  name: string
  body: string
  created_at: string
}

const EMPTY_FORM = { name: '', body: '' }

export default function TemplatesClient() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchTemplates = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('id, name, body, created_at')
      .order('name')
    if (!error && data) setTemplates(data)
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (t: Template) => {
    setForm({ name: t.name, body: t.body })
    setEditingId(t.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Name and body are required')
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({ name: form.name.trim(), body: form.body.trim() })
          .eq('id', editingId)
        if (error) throw error
        toast.success('Template updated')
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert({ name: form.name.trim(), body: form.body.trim() })
        if (error) throw error
        toast.success('Template created')
      }
      resetForm()
      fetchTemplates()
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
      if (error) throw error
      toast.success('Template deleted')
      fetchTemplates()
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Templates"
        description="Reusable message templates for agents. Use {name} to insert the contact's name."
        action={
          !showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          ) : undefined
        }
      />

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="bg-[var(--bg-surface)] border-emerald-500/30 border">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              {editingId ? 'Edit Template' : 'New Template'}
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Template Name
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Greeting, Prayer Follow-up…"
                className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm p-2.5 placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Message Body
              </label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Hello {name}, greetings from the ministry!…"
                rows={4}
                className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm p-2.5 placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Use <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">{'{name}'}</code> to insert the contact's name automatically.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" className="text-[var(--text-secondary)]" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)] gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading templates…</span>
        </div>
      ) : templates.length === 0 ? (
        <Card className="bg-[var(--bg-surface)] border-[var(--border-default)]">
          <CardContent className="p-12 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No templates yet. Create your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => (
            <Card
              key={t.id}
              className="bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-default)]/60 transition-colors"
            >
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                    {t.body}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[var(--text-muted)] hover:text-white"
                    onClick={() => handleEdit(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[var(--text-muted)] hover:text-red-400"
                    disabled={deletingId === t.id}
                    onClick={() => handleDelete(t.id)}
                  >
                    {deletingId === t.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
