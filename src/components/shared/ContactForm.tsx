'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  Users,
  Briefcase,
  AlertTriangle,
  Languages,
  Check
} from 'lucide-react'

interface Category {
  id: number
  label: string
  color_hex: string
}

interface Agent {
  id: string
  full_name: string
}

interface Contact {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  category_id: number | null
  assigned_agent_id: string | null
  notes: string | null
  language: string | null
  country: string | null
  state: string | null
  district_city: string | null
  raw_address: string | null
  watched_program: boolean
  program_name: string | null
  want_prayer: boolean
  prayer_day_time: string | null
  want_ror_daily: boolean
  cell_group_name: string | null
  cell_group_leader: string | null
  call_status: string | null
  source: string | null
  agent?: { full_name: string } | null
}

interface ContactFormProps {
  mode: 'create' | 'edit'
  contact?: Contact
  categories: Category[]
  agents: Agent[]
  userRole: string
}

export default function ContactForm({
  mode,
  contact,
  categories,
  agents,
  userRole
}: ContactFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [fullName, setFullName] = useState(contact?.full_name || '')
  const [phoneState, setPhoneState] = useState(contact?.phone || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [language, setLanguage] = useState(contact?.language || '')
  
  const [country, setCountry] = useState(contact?.country || 'India')
  const [state, setState] = useState(contact?.state || '')
  const [districtCity, setDistrictCity] = useState(contact?.district_city || '')
  const [rawAddress, setRawAddress] = useState(contact?.raw_address || '')

  const [watchedProgram, setWatchedProgram] = useState(contact?.watched_program || false)
  const [programName, setProgramName] = useState(contact?.program_name || '')
  const [wantPrayer, setWantPrayer] = useState(contact?.want_prayer || false)
  const [prayerDayTime, setPrayerDayTime] = useState(contact?.prayer_day_time || '')
  const [wantRorDaily, setWantRorDaily] = useState(contact?.want_ror_daily || false)

  const [cellGroupName, setCellGroupName] = useState(contact?.cell_group_name || '')
  const [cellGroupLeader, setCellGroupLeader] = useState(contact?.cell_group_leader || '')

  const [categoryId, setCategoryId] = useState(contact?.category_id?.toString() || '')
  const [assignedAgentId, setAssignedAgentId] = useState(contact?.assigned_agent_id || '')
  const [callStatus, setCallStatus] = useState(contact?.call_status || 'New')
  const [source, setSource] = useState(contact?.source || '')
  const [notes, setNotes] = useState(contact?.notes || '')

  // Inline Validation States
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [duplicateWarning, setDuplicateWarning] = useState<any[] | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  // Phone Normalizer & Duplicate Finder
  const handlePhoneBlur = async () => {
    let rawPhone = phoneState.trim()
    if (!rawPhone) {
      setDuplicateWarning(null)
      return
    }

    // Normalization: prepends +91 if 10 digits
    const digits = rawPhone.replace(/\D/g, '')
    if (digits.length === 10) {
      rawPhone = `+91${digits}`
      setPhoneState(rawPhone)
    }

    // Call duplicate check API
    setCheckingDuplicate(true)
    try {
      const res = await fetch(`/api/contacts/check-duplicate?phone=${encodeURIComponent(rawPhone)}`)
      const data = await res.json()
      if (data.duplicates && data.duplicates.length > 0) {
        // Exclude current contact if in edit mode
        const filtered = data.duplicates.filter((d: any) => d.id !== contact?.id)
        if (filtered.length > 0) {
          setDuplicateWarning(filtered)
        } else {
          setDuplicateWarning(null)
        }
      } else {
        setDuplicateWarning(null)
      }
    } catch (err) {
      console.error('Duplicate check failed', err)
    } finally {
      setCheckingDuplicate(false)
    }
  }

  // Validate Email
  const validateEmail = (emailVal: string) => {
    if (!emailVal) return true
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(emailVal)
  }

  // Validate form
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }
    if (email && !validateEmail(email)) {
      newErrors.email = 'Invalid email format'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      toast.error('Please fix validation errors')
      return
    }

    setSubmitting(true)
    const payload = {
      full_name: fullName.trim(),
      phone: phoneState.trim() || null,
      email: email.trim() || null,
      language: language.trim() || null,
      country: country.trim() || 'India',
      state: state.trim() || null,
      district_city: districtCity.trim() || null,
      raw_address: rawAddress.trim() || null,
      watched_program: watchedProgram,
      program_name: watchedProgram ? programName.trim() : null,
      want_prayer: wantPrayer,
      prayer_day_time: wantPrayer ? prayerDayTime.trim() : null,
      want_ror_daily: wantRorDaily,
      cell_group_name: cellGroupName.trim() || null,
      cell_group_leader: cellGroupLeader.trim() || null,
      category_id: categoryId ? parseInt(categoryId, 10) : null,
      assigned_agent_id: assignedAgentId || null,
      call_status: callStatus,
      source: source.trim() || null,
      notes: notes.trim() || null
    }

    try {
      const url = mode === 'create' ? '/api/contacts' : `/api/contacts/${contact?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Request failed')
      }

      toast.success(
        mode === 'create'
          ? 'Contact created successfully'
          : 'Contact updated successfully'
      )
      
      router.push(`/contacts/${data.contact.id}`)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner Alert for Duplicate Phone */}
      {duplicateWarning && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-sm text-amber-200 animate-in slide-in-from-top-4 duration-200">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <span className="font-bold">Duplicate Phone Detected!</span>
            <p className="text-amber-300/80">
              Another contact exists with the phone number <span className="font-mono text-amber-100">{phoneState}</span>:
            </p>
            <div className="mt-2 space-y-1">
              {duplicateWarning.map((dup: any) => (
                <div key={dup.id} className="flex items-center justify-between text-xs bg-black/30 px-3 py-1.5 rounded border border-amber-500/10">
                  <span>
                    <strong className="text-white">{dup.full_name}</strong> — Assigned to:{' '}
                    {dup.agent?.full_name ? (
                      <span className="text-amber-100">{dup.agent.full_name}</span>
                    ) : (
                      <em className="text-amber-300/60">Unassigned</em>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/contacts/${dup.id}`)}
                    className="text-amber-400 hover:text-amber-300 underline font-semibold transition-colors"
                  >
                    View File
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Personal Info */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <User className="h-5 w-5 text-[var(--gold-400)]" />
            <h3 className="font-bold text-white text-base">Personal Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-[var(--text-secondary)]">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }))
                }}
                className={`h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)] ${
                  errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-[var(--text-secondary)]">
                Phone Number {checkingDuplicate && <Loader2 className="w-3 h-3 animate-spin inline-block ml-1 text-[var(--gold-400)]" />}
              </Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phoneState}
                onChange={(e) => setPhoneState(e.target.value)}
                onBlur={handlePhoneBlur}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[var(--text-secondary)]">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }))
                }}
                className={`h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)] ${
                  errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="language" className="text-xs font-semibold text-[var(--text-secondary)]">Preferred Language</Label>
              <Input
                id="language"
                placeholder="Hindi, English, Tamil, etc."
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Location Details */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <MapPin className="h-5 w-5 text-[var(--gold-400)]" />
            <h3 className="font-bold text-white text-base">Location Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="country" className="text-xs font-semibold text-[var(--text-secondary)]">Country</Label>
              <Input
                id="country"
                placeholder="India"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs font-semibold text-[var(--text-secondary)]">State / Province</Label>
              <Input
                id="state"
                placeholder="Maharashtra"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="districtCity" className="text-xs font-semibold text-[var(--text-secondary)]">District / City</Label>
              <Input
                id="districtCity"
                placeholder="Mumbai"
                value={districtCity}
                onChange={(e) => setDistrictCity(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rawAddress" className="text-xs font-semibold text-[var(--text-secondary)]">Full Address</Label>
            <textarea
              id="rawAddress"
              rows={2}
              placeholder="House/Flat No., Street, Landmark, Area details..."
              value={rawAddress}
              onChange={(e) => setRawAddress(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-1 focus:ring-[var(--gold-500)]/20 outline-none transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Ministry & Engagement preferences */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <Languages className="h-5 w-5 text-[var(--gold-400)]" />
            <h3 className="font-bold text-white text-base">Ministry & Engagement Preferences</h3>
          </div>

          <div className="space-y-4">
            {/* Watched Program */}
            <div className="space-y-3 p-3.5 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="watchedProgram"
                  checked={watchedProgram}
                  onChange={(e) => setWatchedProgram(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-gray-600 text-[var(--gold-500)] focus:ring-[var(--gold-500)] cursor-pointer"
                />
                <Label htmlFor="watchedProgram" className="text-sm font-semibold text-white cursor-pointer select-none">
                  Has watched our Program / Broadcast
                </Label>
              </div>

              {watchedProgram && (
                <div className="pl-7 animate-in slide-in-from-top-2 duration-150 space-y-1.5">
                  <Label htmlFor="programName" className="text-xs font-medium text-[var(--text-secondary)]">Program Name</Label>
                  <Input
                    id="programName"
                    placeholder="e.g. Atmosphere for Miracles"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    className="h-9 bg-black/20 border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
                  />
                </div>
              )}
            </div>

            {/* Want Prayer */}
            <div className="space-y-3 p-3.5 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="wantPrayer"
                  checked={wantPrayer}
                  onChange={(e) => setWantPrayer(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-gray-600 text-[var(--gold-500)] focus:ring-[var(--gold-500)] cursor-pointer"
                />
                <Label htmlFor="wantPrayer" className="text-sm font-semibold text-white cursor-pointer select-none">
                  Requested a specific Prayer Time
                </Label>
              </div>

              {wantPrayer && (
                <div className="pl-7 animate-in slide-in-from-top-2 duration-150 space-y-1.5">
                  <Label htmlFor="prayerDayTime" className="text-xs font-medium text-[var(--text-secondary)]">Requested Day / Time</Label>
                  <Input
                    id="prayerDayTime"
                    placeholder="e.g. Saturday 10:00 AM"
                    value={prayerDayTime}
                    onChange={(e) => setPrayerDayTime(e.target.value)}
                    className="h-9 bg-black/20 border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
                  />
                </div>
              )}
            </div>

            {/* Want ROR Daily */}
            <div className="flex items-center gap-3 p-3.5 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
              <input
                type="checkbox"
                id="wantRorDaily"
                checked={wantRorDaily}
                onChange={(e) => setWantRorDaily(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-gray-600 text-[var(--gold-500)] focus:ring-[var(--gold-500)] cursor-pointer"
              />
              <Label htmlFor="wantRorDaily" className="text-sm font-semibold text-white cursor-pointer select-none">
                Wants Rhapsody of Realities Daily Devotional
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4: Cell Group Details */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <Users className="h-5 w-5 text-[var(--gold-400)]" />
            <h3 className="font-bold text-white text-base">Cell Group Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cellGroupName" className="text-xs font-semibold text-[var(--text-secondary)]">Cell Group Name</Label>
              <Input
                id="cellGroupName"
                placeholder="e.g. Grace Fellowship"
                value={cellGroupName}
                onChange={(e) => setCellGroupName(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cellGroupLeader" className="text-xs font-semibold text-[var(--text-secondary)]">Cell Group Leader</Label>
              <Input
                id="cellGroupLeader"
                placeholder="e.g. Brother Thomas"
                value={cellGroupLeader}
                onChange={(e) => setCellGroupLeader(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 5: Call Center Settings */}
      <Card className="bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-sm)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-400)] to-transparent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <Briefcase className="h-5 w-5 text-[var(--gold-400)]" />
            <h3 className="font-bold text-white text-base">Call Center Fields</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-semibold text-[var(--text-secondary)]">Category / Lead Status</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Agent (Admin Only) */}
            <div className="space-y-1.5">
              <Label htmlFor="agent" className="text-xs font-semibold text-[var(--text-secondary)]">Assigned Agent</Label>
              {userRole === 'admin' ? (
                <select
                  id="agent"
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]/50 px-3 flex items-center text-sm text-[var(--text-secondary)]">
                  {contact?.agent?.full_name || agents.find(a => a.id === contact?.assigned_agent_id)?.full_name || 'Self (Assigned)'}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="callStatus" className="text-xs font-semibold text-[var(--text-secondary)]">Call Status</Label>
              <select
                id="callStatus"
                value={callStatus}
                onChange={(e) => setCallStatus(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-sm text-white outline-none focus:border-[var(--gold-500)] cursor-pointer"
              >
                <option value="New">New</option>
                <option value="Attempted">Attempted</option>
                <option value="Connected">Connected</option>
                <option value="Busy">Busy</option>
                <option value="No Answer">No Answer</option>
                <option value="Wrong Number">Wrong Number</option>
                <option value="Disconnected">Disconnected</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="source" className="text-xs font-semibold text-[var(--text-secondary)]">Source / Campaign</Label>
              <Input
                id="source"
                placeholder="e.g. Easter Event 2026, YouTube"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-white focus-visible:ring-[var(--gold-400)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-[var(--text-secondary)]">Notes & Additional Details</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Enter details about your conversation, prayer request summaries, or followup instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-white placeholder-[var(--text-muted)] focus:border-[var(--gold-500)] focus:ring-1 focus:ring-[var(--gold-500)]/20 outline-none transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Submission Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (mode === 'edit' && contact) {
              router.push(`/contacts/${contact.id}`)
            } else {
              router.push('/contacts')
            }
          }}
          className="bg-transparent border-[var(--border-default)] text-white hover:bg-[var(--bg-hover)]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-bold shadow-md min-w-[120px]"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {mode === 'create' ? 'Create Contact' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
