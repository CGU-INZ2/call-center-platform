'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  User, 
  Loader2, 
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Info
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/context/UserContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

// Target Database Fields
interface DbField {
  key: string
  label: string
  required: boolean
  description: string
}

const DB_FIELDS: DbField[] = [
  { key: 'full_name', label: 'Full Name', required: true, description: 'Required. Full name of the contact' },
  { key: 'phone', label: 'Phone Number', required: false, description: 'Normalized to +91 formatting' },
  { key: 'email', label: 'Email Address', required: false, description: 'Valid email format' },
  { key: 'raw_address', label: 'Raw Address', required: false, description: 'Full address used for state/city extraction' },
  { key: 'state', label: 'State', required: false, description: 'Indian state (extracted from address if empty)' },
  { key: 'district_city', label: 'City/District', required: false, description: 'City name (extracted from address if empty)' },
  { key: 'language', label: 'Language', required: false, description: 'Preferred communication language' },
  { key: 'program_name', label: 'Watched Program', required: false, description: 'Sets watched_program = true automatically' },
  { key: 'prayer_day_time', label: 'Prayer Request/Time', required: false, description: 'Sets want_prayer = true automatically' },
  { key: 'want_ror_daily', label: 'Wants ROR Daily', required: false, description: 'Boolean flag (Yes/No)' },
  { key: 'cell_group_name', label: 'Cell Group Name', required: false, description: 'Name of the cell group' },
  { key: 'cell_group_leader', label: 'Cell Group Leader', required: false, description: 'Name of the cell leader' },
  { key: 'notes', label: 'Notes/Comments', required: false, description: 'Additional comments or context' },
]

// Indian States Lookup dictionary
const INDIAN_STATES = [
  { name: 'Andhra Pradesh', codes: ['AP', 'ANDHRA'] },
  { name: 'Arunachal Pradesh', codes: ['AR', 'ARUNACHAL'] },
  { name: 'Assam', codes: ['AS', 'ASSAM'] },
  { name: 'Bihar', codes: ['BR', 'BIHAR'] },
  { name: 'Chhattisgarh', codes: ['CG', 'CHHATTISGARH'] },
  { name: 'Goa', codes: ['GA', 'GOA'] },
  { name: 'Gujarat', codes: ['GJ', 'GUJARAT'] },
  { name: 'Haryana', codes: ['HR', 'HARYANA'] },
  { name: 'Himachal Pradesh', codes: ['HP', 'HIMACHAL'] },
  { name: 'Jharkhand', codes: ['JH', 'JHARKHAND'] },
  { name: 'Karnataka', codes: ['KA', 'KARNATAKA'] },
  { name: 'Kerala', codes: ['KL', 'KERALA'] },
  { name: 'Madhya Pradesh', codes: ['MP', 'MADHYA'] },
  { name: 'Maharashtra', codes: ['MH', 'MAHARASHTRA'] },
  { name: 'Manipur', codes: ['MN', 'MANIPUR'] },
  { name: 'Meghalaya', codes: ['ML', 'MEGHALAYA'] },
  { name: 'Mizoram', codes: ['MZ', 'MIZORAM'] },
  { name: 'Nagaland', codes: ['NL', 'NAGALAND'] },
  { name: 'Odisha', codes: ['OD', 'OR', 'ODISHA', 'ORISSA'] },
  { name: 'Punjab', codes: ['PB', 'PUNJAB'] },
  { name: 'Rajasthan', codes: ['RJ', 'RAJASTHAN'] },
  { name: 'Sikkim', codes: ['SK', 'SIKKIM'] },
  { name: 'Tamil Nadu', codes: ['TN', 'TAMIL', 'TAMILNADU'] },
  { name: 'Telangana', codes: ['TG', 'TS', 'TELANGANA'] },
  { name: 'Tripura', codes: ['TR', 'TRIPURA'] },
  { name: 'Uttar Pradesh', codes: ['UP', 'UTTAR'] },
  { name: 'Uttarakhand', codes: ['UK', 'UA', 'UTTARAKHAND'] },
  { name: 'West Bengal', codes: ['WB', 'BENGAL', 'WESTBENGAL'] },
  { name: 'Delhi', codes: ['DL', 'DELHI', 'NEW DELHI'] },
  { name: 'Jammu and Kashmir', codes: ['JK', 'JAMMU', 'KASHMIR'] },
  { name: 'Ladakh', codes: ['LA', 'LADAKH'] },
  { name: 'Puducherry', codes: ['PY', 'PONDICHERRY'] },
  { name: 'Chandigarh', codes: ['CH', 'CHANDIGARH'] },
  { name: 'Andaman and Nicobar', codes: ['AN', 'ANDAMAN'] },
  { name: 'Dadra and Nagar Haveli', codes: ['DN', 'DADRA'] },
  { name: 'Daman and Diu', codes: ['DD', 'DAMAN'] },
  { name: 'Lakshadweep', codes: ['LD', 'LAKSHADWEEP'] }
]

interface RowValidation {
  rowNum: number
  errors: string[]
  warnings: string[]
  rowData: Record<string, string>
}

interface PhoneNormalizationResult {
  rowNum: number
  original: string
  normalized: string
  isValid: boolean
  isModified: boolean
}

interface AddressParseResult {
  rowNum: number
  raw: string
  extractedState: string
  extractedCity: string
  isMapped: boolean
}

export default function ImportClient() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()

  // Wizard State
  const [step, setStep] = useState<number>(1)
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  
  // Validation / Normalization States
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState<boolean>(false)
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set())
  const [validationResults, setValidationResults] = useState<RowValidation[]>([])
  const [phoneResults, setPhoneResults] = useState<PhoneNormalizationResult[]>([])
  const [addressResults, setAddressResults] = useState<AddressParseResult[]>([])
  
  // Import States
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [categories, setCategories] = useState<{ id: number; label: string }[]>([])
  const [importing, setImporting] = useState<boolean>(false)
  const [importProgress, setImportProgress] = useState<number>(0)
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null)
  const [failedRowsList, setFailedRowsList] = useState<{ rowData: Record<string, string>; errorReason: string }[]>([])

  // Drag and Drop Ref
  const [dragOver, setDragOver] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch agents and categories for assignment
  useEffect(() => {
    async function fetchData() {
      // Fetch agents
      const { data: agentsData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true })
      if (agentsData) {
        setAgents(agentsData)
      }

      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('id, label')
        .order('label', { ascending: true })
      if (catData) {
        setCategories(catData)
      }

      // Default assigned agent to current user
      if (user?.id) {
        setSelectedAgentId(user.id)
      }
    }
    fetchData()
  }, [user, supabase])

  // Normalizes phone number based on Sprint 2.3 logic
  const normalizePhoneNumber = (phone: string | undefined | null): { normalized: string; isValid: boolean } => {
    if (!phone) return { normalized: '', isValid: false }
    
    // Strip spaces, dashes, dots, brackets, plus
    const clean = phone.replace(/[\s\-\.\(\)\+]/g, '')
    
    // Check if it's all digits or empty
    if (!/^\d+$/.test(clean)) {
      return { normalized: phone, isValid: false } // Import as-is, flag warning
    }

    if (clean.startsWith('0')) {
      // Remove leading 0, prepend +91
      const withoutZero = clean.slice(1)
      if (withoutZero.length === 10) {
        return { normalized: '+91' + withoutZero, isValid: true }
      }
    }

    if (clean.length === 10) {
      // Prepend +91
      return { normalized: '+91' + clean, isValid: true }
    }

    if (clean.startsWith('91') && clean.length === 12) {
      // Prepend +
      return { normalized: '+' + clean, isValid: true }
    }

    if (phone.replace(/[\s\-\.\(\)]/g, '').startsWith('+91') && clean.length === 12) {
      return { normalized: '+91' + clean.slice(2), isValid: true }
    }

    // Fallback: If it's a +91 number already
    if (phone.trim().startsWith('+91') && phone.replace(/[\s\-\.\(\)\+]/g, '').length === 12) {
      return { normalized: phone.trim().replace(/[\s\-\.\(\)]/g, ''), isValid: true }
    }

    // Flag as invalid format / warning, keep as-is
    return { normalized: phone, isValid: false }
  }

  // Parses address for Indian state & city
  const parseAddressDetails = (rawAddress: string | undefined | null, currentParsedState: string | undefined | null): { state: string; city: string; isMapped: boolean } => {
    let state = currentParsedState?.trim() || ''
    let city = ''
    
    if (!rawAddress) return { state, city, isMapped: state !== '' }

    // If state is empty, search raw address for Indian State names
    if (!state) {
      const addrUpper = rawAddress.toUpperCase()
      for (const st of INDIAN_STATES) {
        // Check full state name match
        if (addrUpper.includes(st.name.toUpperCase())) {
          state = st.name
          break
        }
        // Check abbreviation match
        for (const code of st.codes) {
          const regex = new RegExp(`\\b${code}\\b`, 'i')
          if (regex.test(rawAddress)) {
            state = st.name
            break
          }
        }
        if (state) break
      }
    }

    // Extract city: segment before comma/state name
    let cleanAddress = rawAddress
    if (state) {
      // Remove state name/codes to prevent treating them as city
      const stateRegex = new RegExp(state, 'gi')
      cleanAddress = cleanAddress.replace(stateRegex, '')
      
      const stObj = INDIAN_STATES.find(s => s.name === state)
      if (stObj) {
        stObj.codes.forEach(code => {
          const codeRegex = new RegExp(`\\b${code}\\b`, 'gi')
          cleanAddress = cleanAddress.replace(codeRegex, '')
        })
      }
    }

    const segments = cleanAddress.split(/[,;\-]/).map(s => s.trim()).filter(Boolean)
    if (segments.length > 0) {
      city = segments[0]
    }

    return {
      state,
      city,
      isMapped: state !== '' && city !== ''
    }
  }

  // Fuzzy matches columns when headers are detected
  useEffect(() => {
    if (headers.length === 0) return

    const initialMapping: Record<string, string> = {}
    
    DB_FIELDS.forEach(field => {
      const matchRules: Record<string, string[]> = {
        full_name: ['name', 'fullname', 'contactname', 'clientname'],
        phone: ['phone', 'mobile', 'contact', 'phonenumber', 'mobilephone'],
        email: ['email', 'emailaddress', 'e-mail'],
        raw_address: ['location', 'address', 'city', 'street'],
        state: ['state', 'region'],
        district_city: ['city', 'district', 'town'],
        language: ['language', 'lang'],
        program_name: ['program', 'ministryprogram', 'watchedprogram'],
        prayer_day_time: ['prayer', 'wantsprayer', 'prayerday', 'prayerdaytime'],
        want_ror_daily: ['ror', 'rordaily', 'wantrordaily'],
        cell_group_name: ['cellgroup', 'cell', 'group', 'cellgroupname'],
        cell_group_leader: ['leader', 'cellleader', 'cellgroupleader'],
        notes: ['notes', 'comments', 'remarks']
      }

      const rules = matchRules[field.key] || [field.key]
      const found = headers.find(h => {
        const hNorm = h.toLowerCase().trim().replace(/[\s\-_]/g, '')
        return rules.some(rule => hNorm === rule || hNorm.includes(rule) || rule.includes(hNorm))
      })

      initialMapping[field.key] = found || 'skip'
    })

    setMapping(initialMapping)
  }, [headers])

  // Handles CSV File Upload & Parsing
  const handleFileUpload = (fileToParse: File) => {
    if (!fileToParse.name.endsWith('.csv')) {
      toast.error('Only .csv files are supported.')
      return
    }

    if (fileToParse.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB limit.')
      return
    }

    setFile(fileToParse)

    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.data.length === 0) {
          toast.error('The selected CSV file is empty.')
          return
        }
        
        const detectedHeaders = results.meta.fields || []
        setHeaders(detectedHeaders)
        setCsvData(results.data as Record<string, string>[])
        toast.success(`Successfully parsed ${results.data.length} rows.`)
        setStep(2)
      },
      error: (err) => {
        toast.error(`Error parsing CSV: ${err.message}`)
      }
    })
  }

  // Handle manual file browse
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
    }
  }

  // Drag and drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = () => {
    setDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  // Triggers checking duplicate phone numbers against Supabase DB
  const fetchDbDuplicates = async (phones: string[]): Promise<Set<string>> => {
    if (phones.length === 0) return new Set()
    
    setIsCheckingDuplicates(true)
    const duplicates = new Set<string>()
    const chunkSize = 500

    try {
      for (let i = 0; i < phones.length; i += chunkSize) {
        const chunk = phones.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('contacts')
          .select('phone')
          .in('phone', chunk)
        
        if (error) throw error
        data?.forEach(row => {
          if (row.phone) duplicates.add(row.phone)
        })
      }
    } catch (err: any) {
      console.error('Error fetching duplicates:', err)
      toast.error('Could not check database for duplicate phone numbers.')
    } finally {
      setIsCheckingDuplicates(false)
    }

    return duplicates
  }

  // Execute validation for all rows
  const validateData = async () => {
    if (mapping['full_name'] === 'skip') {
      toast.error('Full Name mapping is required.')
      return
    }

    // Extract all phones to check DB duplicates
    const mappedPhoneHeader = mapping['phone']
    const csvPhones = csvData
      .map(row => row[mappedPhoneHeader])
      .filter(Boolean)
      .map(phone => normalizePhoneNumber(phone).normalized)
      .filter(phone => phone.startsWith('+'))

    const dbDuplicates = await fetchDbDuplicates(csvPhones)
    setExistingPhones(dbDuplicates)

    // Validate rows
    const results: RowValidation[] = []
    const seenPhonesInCsv = new Set<string>()

    csvData.forEach((row, idx) => {
      const rowNum = idx + 1
      const errors: string[] = []
      const warnings: string[] = []

      // 1. Check missing name (blocking error)
      const nameVal = row[mapping['full_name']]
      if (!nameVal || !nameVal.trim()) {
        errors.push('Missing contact name')
      }

      // 2. Validate phone number
      const rawPhone = row[mapping['phone']]
      if (!rawPhone || !rawPhone.trim()) {
        warnings.push('Missing phone number')
      } else {
        const { normalized, isValid } = normalizePhoneNumber(rawPhone)
        
        if (!isValid) {
          warnings.push(`Invalid phone format: "${rawPhone}"`)
        } else {
          // Check duplicate within CSV
          if (seenPhonesInCsv.has(normalized)) {
            errors.push(`Duplicate phone number inside CSV: "${normalized}"`)
          } else {
            seenPhonesInCsv.add(normalized)
          }

          // Check duplicate against DB
          if (dbDuplicates.has(normalized)) {
            errors.push(`Phone number already exists in DB: "${normalized}"`)
          }
        }
      }

      // 3. Validate email
      const rawEmail = row[mapping['email']]
      if (rawEmail && rawEmail.trim()) {
        const emailRegex = /.+@.+\..+/
        if (!emailRegex.test(rawEmail.trim())) {
          warnings.push(`Invalid email format: "${rawEmail}"`)
        }
      }

      // 4. Validate state
      const rawState = row[mapping['state']]
      if (!rawState || !rawState.trim()) {
        // If address is also empty, add missing state warning
        const rawAddress = row[mapping['raw_address']]
        if (!rawAddress || !rawAddress.trim()) {
          warnings.push('No state provided')
        }
      }

      results.push({
        rowNum,
        errors,
        warnings,
        rowData: row
      })
    })

    setValidationResults(results)
    
    // Pre-calculate phone normalization for Step 4 display
    const phoneNormalizations = csvData.map((row, idx) => {
      const raw = row[mapping['phone']]
      const { normalized, isValid } = normalizePhoneNumber(raw)
      return {
        rowNum: idx + 1,
        original: raw || '',
        normalized,
        isValid,
        isModified: raw !== normalized
      }
    })
    setPhoneResults(phoneNormalizations)

    // Pre-calculate location parsing for Step 5 display
    const addressParsings = csvData.map((row, idx) => {
      const rawAddr = row[mapping['raw_address']]
      const curState = row[mapping['state']]
      const curCity = row[mapping['district_city']]
      
      const { state, city, isMapped } = parseAddressDetails(rawAddr, curState)
      
      return {
        rowNum: idx + 1,
        raw: rawAddr || '',
        extractedState: state || curState || '',
        extractedCity: city || curCity || '',
        isMapped: rawAddr ? isMapped : false
      }
    })
    setAddressResults(addressParsings)

    setStep(3)
  }

  // Prepares the contacts for insertion based on mapping + normalizations + address parsing
  const getPreparedContacts = () => {
    return csvData.map((row, idx) => {
      const valResult = validationResults[idx]
      const phoneRes = phoneResults[idx]
      const addressRes = addressResults[idx]

      // Determine ROR Boolean
      let wantRor = false
      const rorVal = row[mapping['want_ror_daily']]
      if (rorVal) {
        const rorStr = rorVal.toLowerCase().trim()
        wantRor = ['yes', 'true', '1', 'y', 't', 'want'].includes(rorStr)
      }

      // Determine watched program boolean
      const progName = row[mapping['program_name']]
      const hasWatchedProgram = !!(progName && progName.trim())

      // Determine want prayer boolean
      const prayerVal = row[mapping['prayer_day_time']]
      const wantsPrayer = !!(prayerVal && prayerVal.trim())

      return {
        full_name: row[mapping['full_name']]?.trim() || '',
        phone: phoneRes?.normalized || null,
        email: row[mapping['email']]?.trim() || null,
        raw_address: row[mapping['raw_address']]?.trim() || null,
        state: addressRes?.extractedState || row[mapping['state']]?.trim() || null,
        district_city: addressRes?.extractedCity || row[mapping['district_city']]?.trim() || null,
        language: row[mapping['language']]?.trim() || null,
        program_name: progName?.trim() || null,
        watched_program: hasWatchedProgram,
        prayer_day_time: prayerVal?.trim() || null,
        want_prayer: wantsPrayer,
        want_ror_daily: wantRor,
        cell_group_name: row[mapping['cell_group_name']]?.trim() || null,
        cell_group_leader: row[mapping['cell_group_leader']]?.trim() || null,
        notes: row[mapping['notes']]?.trim() || null,
        source: 'csv_import',
        call_status: 'New',
        geo_status: (addressRes?.isMapped || (row[mapping['state']] && row[mapping['district_city']])) ? 'mapped' : 'unmapped',
        assigned_agent_id: selectedAgentId || null
      }
    })
  }

  // Confirm and run import batches
  const executeImport = async () => {
    setImporting(true)
    setImportProgress(0)
    setFailedRowsList([])

    const preparedContacts = getPreparedContacts()
    
    // Find the default "New Contact" category from database
    let defaultCategoryId: number | null = null
    const newContactCat = categories.find(c => c.label.toLowerCase() === 'new contact' || c.label.toLowerCase() === 'new')
    if (newContactCat) {
      defaultCategoryId = newContactCat.id
    } else if (categories.length > 0) {
      defaultCategoryId = categories[0].id
    }

    const batchSize = 100
    let successCount = 0
    let failedCount = 0
    const errorsAccumulator: { rowData: Record<string, string>; errorReason: string }[] = []

    for (let i = 0; i < preparedContacts.length; i += batchSize) {
      const batchStartIndex = i
      const rawBatch = csvData.slice(batchStartIndex, batchStartIndex + batchSize)
      const batchValidations = validationResults.slice(batchStartIndex, batchStartIndex + batchSize)
      
      const batchToInsert = preparedContacts
        .slice(batchStartIndex, batchStartIndex + batchSize)
        .map((contact, index) => {
          // If the row has blocking validation errors, we skip it here
          const rowHasError = batchValidations[index]?.errors.length > 0
          if (rowHasError) {
            return null
          }
          return {
            ...contact,
            category_id: defaultCategoryId
          }
        })

      // Separate skip/error rows from rows to insert
      const validRowsToInsert: any[] = []
      const skippedIndices: number[] = []

      batchToInsert.forEach((contact, index) => {
        if (contact === null) {
          const originalRow = rawBatch[index]
          const errors = batchValidations[index]?.errors.join('; ') || 'Validation errors'
          errorsAccumulator.push({ rowData: originalRow, errorReason: errors })
          skippedIndices.push(index)
          failedCount++
        } else {
          validRowsToInsert.push(contact)
        }
      })

      if (validRowsToInsert.length > 0) {
        try {
          const { error } = await supabase
            .from('contacts')
            .insert(validRowsToInsert)

          if (error) {
            // Entire batch failed
            console.error('Batch insert error:', error)
            validRowsToInsert.forEach((contact, idx) => {
              const originalIndex = csvData.findIndex(row => row[mapping['full_name']] === contact.full_name && row[mapping['phone']] === contact.phone)
              const originalRow = originalIndex >= 0 ? csvData[originalIndex] : { name: contact.full_name }
              errorsAccumulator.push({ rowData: originalRow, errorReason: error.message })
              failedCount++
            })
          } else {
            successCount += validRowsToInsert.length
          }
        } catch (err: any) {
          console.error('Unexpected batch insert error:', err)
          validRowsToInsert.forEach((contact) => {
            errorsAccumulator.push({ rowData: {}, errorReason: err.message || 'Unknown network error' })
            failedCount++
          })
        }
      }

      const percent = Math.min(Math.round(((i + batchSize) / preparedContacts.length) * 100), 100)
      setImportProgress(percent)
    }

    setImportStats({ success: successCount, failed: failedCount })
    setFailedRowsList(errorsAccumulator)

    // Write audit log entry
    try {
      await supabase.from('audit_log').insert({
        actor_id: user?.id || null,
        action: 'csv_import',
        entity_type: 'contacts',
        after_data: { count: successCount, failed: failedCount }
      })
    } catch (auditErr) {
      console.error('Error creating audit log entry:', auditErr)
    }

    setImporting(false)
    setStep(6)
    toast.success(`Import complete! Mapped ${successCount} contacts, ${failedCount} errors.`)
  }

  // Export failed rows as a downloadable CSV
  const downloadFailedRowsCsv = () => {
    if (failedRowsList.length === 0) return

    // Reconstruct CSV data adding "Error Reason" column
    const outputRows = failedRowsList.map(failItem => {
      return {
        ...failItem.rowData,
        'Import Error Reason': failItem.errorReason
      }
    })

    const csvContent = Papa.unparse(outputRows)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'failed_import_contacts.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate global summary metrics
  const errorCount = validationResults.reduce((acc, curr) => acc + curr.errors.length, 0)
  const warningCount = validationResults.reduce((acc, curr) => acc + curr.warnings.length, 0)
  const validRowCount = csvData.length - validationResults.filter(r => r.errors.length > 0).length

  // Auto-location parsing metrics
  const autoMappedCount = addressResults.filter(r => r.isMapped).length
  const totalAddressRows = addressResults.filter(r => r.raw !== '').length

  // Render navigation buttons
  const renderStepButtons = () => {
    return (
      <div className="flex justify-between items-center mt-8 pt-4 border-t border-[#2a2d38]">
        <Button
          variant="outline"
          onClick={() => {
            if (step > 1) {
              setStep(step - 1)
            } else {
              router.push('/contacts')
            }
          }}
          disabled={importing}
          className="border-[#2a2d38] text-[var(--text-secondary)] hover:bg-[#282c38] hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {step === 2 && (
          <Button
            onClick={validateData}
            disabled={mapping['full_name'] === 'skip'}
            className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md"
          >
            Validate Mapped Data
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {step === 3 && (
          <Button
            onClick={() => setStep(4)}
            disabled={isCheckingDuplicates}
            className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md"
          >
            {isCheckingDuplicates ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking Duplicates...
              </>
            ) : (
              <>
                Normalize Phone Numbers
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}

        {step === 4 && (
          <Button
            onClick={() => setStep(5)}
            className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md"
          >
            Run Location Parser
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {step === 5 && (
          <Button
            onClick={executeImport}
            disabled={importing}
            className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold shadow-md"
          >
            Confirm & Import
            <Check className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="CSV Import Engine"
        description="Multi-step tool to upload, map, validate, and import call center contacts from CSV spreadsheets."
      />

      {/* Steps Indicator Bar */}
      <div className="w-full bg-[#1a1d25] rounded-xl border border-[#2a2d38] p-4">
        <div className="flex justify-between items-center relative">
          {/* Progress Line */}
          <div className="absolute left-[3%] right-[3%] top-1/2 h-[2px] bg-[#2a2d38] -translate-y-1/2 z-0" />
          <div 
            className="absolute left-[3%] top-1/2 h-[2px] bg-[var(--gold-500)] -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 5) * 94}%` }}
          />

          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Mapping' },
            { num: 3, label: 'Validation' },
            { num: 4, label: 'Phones' },
            { num: 5, label: 'Locations' },
            { num: 6, label: 'Confirm' }
          ].map(s => {
            const isActive = step === s.num
            const isCompleted = step > s.num
            return (
              <div key={s.num} className="flex flex-col items-center z-10 relative">
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                    isActive 
                      ? 'bg-[var(--gold-500)] border-[var(--gold-400)] text-[var(--text-inverse)] ring-4 ring-[var(--gold-500)]/20' 
                      : isCompleted 
                        ? 'bg-[var(--gold-600)] border-[var(--gold-500)] text-[var(--text-inverse)]' 
                        : 'bg-[#1a1d25] border-[#2a2d38] text-[var(--text-muted)]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  isActive ? 'text-[var(--gold-300)]' : isCompleted ? 'text-white' : 'text-[var(--text-muted)]'
                }`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Contents */}
      <Card className="bg-[#1a1d25] border-[#2a2d38] shadow-lg">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Upload */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-white">Upload Your Contact List</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Please select a standard CSV file containing lead contact details. Max size 5MB.</p>
                </div>

                <div 
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${
                    dragOver 
                      ? 'border-[var(--gold-400)] bg-[var(--gold-500)]/5 shadow-glow' 
                      : 'border-[#2a2d38] hover:border-[var(--gold-500)] hover:bg-[#282c38]/30'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={onFileSelect}
                  />
                  <div className="w-16 h-16 rounded-full bg-[var(--gold-500)]/10 flex items-center justify-center mb-4 border border-[var(--gold-500)]/20">
                    <Upload className="w-8 h-8 text-[var(--gold-400)]" />
                  </div>
                  <p className="text-base font-semibold text-white">Drag & drop your CSV file here</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">or click to browse local files</p>
                </div>

                <div className="flex items-start gap-3 bg-[#22252f] rounded-lg p-4 border border-[#2a2d38]">
                  <Info className="w-5 h-5 text-[var(--gold-400)] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">Expected CSV Headers</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      For best results, rename your spreadsheet columns to match standard fields: 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">Name</code>, 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">Phone</code>, 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">Email</code>, 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">Address</code>, 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">State</code>, and 
                      <code className="text-[var(--gold-300)] font-semibold mx-1">Notes</code>. 
                      The engine uses case-insensitive fuzzy matching to pre-map them automatically.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#2a2d38]">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/contacts')}
                    className="border-[#2a2d38] text-[var(--text-secondary)] hover:bg-[#282c38] hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Column Mapping */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">Map Spreadsheet Columns</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Map your CSV columns to the appropriate call center database fields. Check the mappings before proceeding.</p>
                </div>

                <div className="overflow-x-auto border border-[#2a2d38] rounded-lg bg-[#22252f]">
                  <Table>
                    <TableHeader className="bg-[#1a1d25]">
                      <TableRow className="border-[#2a2d38]">
                        <TableHead className="text-white font-semibold">Database Field</TableHead>
                        <TableHead className="text-white font-semibold">Mapped CSV Header</TableHead>
                        <TableHead className="text-white font-semibold">Status</TableHead>
                        <TableHead className="text-white font-semibold">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DB_FIELDS.map(field => {
                        const currentMapped = mapping[field.key] || 'skip'
                        const isMapped = currentMapped !== 'skip'
                        return (
                          <TableRow key={field.key} className="border-[#2a2d38] hover:bg-[#282c38]/20">
                            <TableCell className="font-medium text-white py-3">
                              {field.label}
                              {field.required && <span className="text-[var(--danger)] ml-1">*</span>}
                            </TableCell>
                            <TableCell className="py-2">
                              <select
                                value={currentMapped}
                                onChange={(e) => {
                                  setMapping({
                                    ...mapping,
                                    [field.key]: e.target.value
                                  })
                                }}
                                className="w-full bg-[#1a1d25] border border-[#2a2d38] text-white rounded-md px-3 py-1.5 text-sm outline-none focus:border-[var(--gold-500)] focus:ring-1 focus:ring-[var(--gold-500)]"
                              >
                                <option value="skip">-- Skip / Ignore Field --</option>
                                {headers.map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="py-3">
                              {isMapped ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Mapped</Badge>
                              ) : field.required ? (
                                <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">Required</Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Skipped</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-[var(--text-secondary)] py-3 max-w-xs truncate">
                              {field.description}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {mapping['full_name'] === 'skip' && (
                  <div className="flex items-center gap-2 text-[var(--danger)] text-sm font-semibold bg-[var(--danger-muted)]/10 border border-[var(--danger-muted)]/20 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>The database column "Full Name" is required. Please map a CSV header to this field to continue.</span>
                  </div>
                )}

                {renderStepButtons()}
              </motion.div>
            )}

            {/* STEP 3: Preview & Validation */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">Preview & Validate Data</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Validate your spreadsheet data. All database constraints, formats, and duplicates are validated before import.</p>
                </div>

                {/* Validation Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] font-medium">Valid Rows</p>
                      <p className="text-2xl font-bold text-white">{validRowCount} / {csvData.length}</p>
                    </div>
                  </div>

                  <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] font-medium">Errors (Blocking)</p>
                      <p className="text-2xl font-bold text-white">{errorCount}</p>
                    </div>
                  </div>

                  <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] font-medium">Warnings (Non-blocking)</p>
                      <p className="text-2xl font-bold text-white">{warningCount}</p>
                    </div>
                  </div>
                </div>

                {/* First 10 Rows Preview Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white">Previewing First 10 Rows</h4>
                  <div className="overflow-x-auto border border-[#2a2d38] rounded-lg bg-[#22252f]">
                    <Table>
                      <TableHeader className="bg-[#1a1d25]">
                        <TableRow className="border-[#2a2d38]">
                          <TableHead className="text-white font-semibold w-16">Row</TableHead>
                          {DB_FIELDS.filter(f => mapping[f.key] !== 'skip').map(f => (
                            <TableHead key={f.key} className="text-white font-semibold">
                              {f.label} ({mapping[f.key]})
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 10).map((row, idx) => (
                          <TableRow key={idx} className="border-[#2a2d38] hover:bg-[#282c38]/20">
                            <TableCell className="font-semibold text-[var(--text-secondary)]">{idx + 1}</TableCell>
                            {DB_FIELDS.filter(f => mapping[f.key] !== 'skip').map(f => (
                              <TableCell key={f.key} className="text-white max-w-xs truncate">
                                {row[mapping[f.key]] || <span className="text-[var(--text-muted)] italic">empty</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Validation Warnings & Errors Detail List */}
                {(errorCount > 0 || warningCount > 0) && (
                  <div className="border border-[#2a2d38] rounded-lg bg-[#22252f] overflow-hidden">
                    <div className="p-4 bg-[#1a1d25] border-b border-[#2a2d38] flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">Validation Logs & Issues</h4>
                      <Badge variant="outline" className="border-[#2a2d38] text-[var(--text-secondary)]">
                        {validationResults.filter(r => r.errors.length > 0 || r.warnings.length > 0).length} Rows affected
                      </Badge>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-[#2a2d38]">
                      {validationResults
                        .filter(r => r.errors.length > 0 || r.warnings.length > 0)
                        .map(res => (
                          <div key={res.rowNum} className="p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-[#282c38]/20">
                            <span className="font-semibold text-white shrink-0">Row {res.rowNum} ({res.rowData[mapping['full_name']] || 'Unnamed'}):</span>
                            
                            <div className="flex flex-wrap gap-2 flex-1 md:justify-end">
                              {res.errors.map((err, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {err}
                                </span>
                              ))}
                              {res.warnings.map((warn, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {warn}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {errorCount > 0 && (
                  <div className="flex items-start gap-2 text-rose-400 text-xs leading-normal bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg">
                    <Info className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <span>Note: Rows with blocking errors (shown in red) will be skipped during the final import confirmation. You can download the failed rows list at the end.</span>
                  </div>
                )}

                {renderStepButtons()}
              </motion.div>
            )}

            {/* STEP 4: Phone Normalization */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">Normalize Phone Numbers</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Normalizes Indian phone formats to standard E.164 <code className="text-[var(--gold-300)] font-semibold">+91</code> format. Preview changes before saving.</p>
                </div>

                <div className="overflow-x-auto border border-[#2a2d38] rounded-lg bg-[#22252f]">
                  <Table>
                    <TableHeader className="bg-[#1a1d25]">
                      <TableRow className="border-[#2a2d38]">
                        <TableHead className="text-white font-semibold w-16">Row</TableHead>
                        <TableHead className="text-white font-semibold">Contact Name</TableHead>
                        <TableHead className="text-white font-semibold">Original Input</TableHead>
                        <TableHead className="text-white font-semibold">Normalized Output</TableHead>
                        <TableHead className="text-white font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneResults.slice(0, 10).map((res) => {
                        const originalRow = csvData[res.rowNum - 1]
                        return (
                          <TableRow key={res.rowNum} className="border-[#2a2d38] hover:bg-[#282c38]/20">
                            <TableCell className="font-semibold text-[var(--text-secondary)]">{res.rowNum}</TableCell>
                            <TableCell className="text-white">{originalRow[mapping['full_name']]}</TableCell>
                            <TableCell className="text-[var(--text-secondary)] font-mono">{res.original || <span className="italic text-[var(--text-muted)]">empty</span>}</TableCell>
                            <TableCell className="text-white font-semibold font-mono">{res.normalized || <span className="italic text-[var(--text-muted)]">empty</span>}</TableCell>
                            <TableCell>
                              {res.isValid ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Valid +91</Badge>
                              ) : res.original ? (
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Imported As-Is</Badge>
                              ) : (
                                <Badge className="bg-[#22252f] text-[var(--text-muted)] border border-[#2a2d38] font-medium">None</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {phoneResults.length > 10 && (
                    <div className="p-3 bg-[#1a1d25] border-t border-[#2a2d38] text-center text-xs text-[var(--text-secondary)] font-medium">
                      Showing first 10 of {phoneResults.length} normalized phone numbers.
                    </div>
                  )}
                </div>

                {renderStepButtons()}
              </motion.div>
            )}

            {/* STEP 5: Location Parser (Semi-Auto) */}
            {step === 5 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">Extract States & Cities</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Extracts state and city coordinates from raw addresses. Unmapped rows will be marked for admin review later.</p>
                </div>

                {/* Location parser stats */}
                <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--gold-500)]/10 flex items-center justify-center text-[var(--gold-400)] border border-[var(--gold-500)]/20">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] font-medium">Address Auto-Mapping Status</p>
                      <p className="text-xl font-bold text-white">Auto-mapped {autoMappedCount} of {totalAddressRows} addresses</p>
                    </div>
                  </div>
                  <Badge className="bg-[var(--gold-500)]/10 text-[var(--gold-400)] border border-[var(--gold-500)]/20 px-3 py-1 font-semibold">
                    {totalAddressRows - autoMappedCount} Remain Unmapped
                  </Badge>
                </div>

                <div className="overflow-x-auto border border-[#2a2d38] rounded-lg bg-[#22252f]">
                  <Table>
                    <TableHeader className="bg-[#1a1d25]">
                      <TableRow className="border-[#2a2d38]">
                        <TableHead className="text-white font-semibold w-16">Row</TableHead>
                        <TableHead className="text-white font-semibold">Raw Address Input</TableHead>
                        <TableHead className="text-white font-semibold">Extracted State</TableHead>
                        <TableHead className="text-white font-semibold">Extracted City</TableHead>
                        <TableHead className="text-white font-semibold">Geo Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addressResults.filter(r => r.raw !== '').slice(0, 10).map((res) => (
                        <TableRow key={res.rowNum} className="border-[#2a2d38] hover:bg-[#282c38]/20">
                          <TableCell className="font-semibold text-[var(--text-secondary)]">{res.rowNum}</TableCell>
                          <TableCell className="text-white max-w-sm truncate">{res.raw}</TableCell>
                          <TableCell className="text-[var(--gold-300)] font-semibold">{res.extractedState || <span className="text-[var(--text-muted)] italic">empty</span>}</TableCell>
                          <TableCell className="text-[var(--gold-300)] font-semibold">{res.extractedCity || <span className="text-[var(--text-muted)] italic">empty</span>}</TableCell>
                          <TableCell>
                            {res.isMapped ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Mapped</Badge>
                            ) : (
                              <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">Unmapped</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {addressResults.filter(r => r.raw !== '').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-[var(--text-muted)] italic">
                            No rows contain raw address inputs. Map raw address column to extract coordinates.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {addressResults.filter(r => r.raw !== '').length > 10 && (
                    <div className="p-3 bg-[#1a1d25] border-t border-[#2a2d38] text-center text-xs text-[var(--text-secondary)] font-medium">
                      Showing first 10 of {addressResults.filter(r => r.raw !== '').length} parsed addresses.
                    </div>
                  )}
                </div>

                {renderStepButtons()}
              </motion.div>
            )}

            {/* STEP 6: Confirm & Import OR Complete Status */}
            {step === 6 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {!importStats ? (
                  /* Confirmation State before insert */
                  <div className="space-y-6">
                    <div className="text-center py-6 space-y-2">
                      <div className="w-16 h-16 rounded-full bg-[var(--gold-500)]/10 flex items-center justify-center mx-auto border border-[var(--gold-500)]/20 animate-pulse">
                        <FileSpreadsheet className="w-8 h-8 text-[var(--gold-400)]" />
                      </div>
                      <h3 className="text-xl font-bold text-white mt-4">Confirm Contact Import</h3>
                      <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                        You are ready to import contacts from spreadsheet. Please specify the default agent assignment and confirm the execution.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto bg-[#22252f] rounded-xl border border-[#2a2d38] p-6 space-y-4">
                      {/* Default assigned agent selection */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white uppercase tracking-wider">Default Assigned Agent</label>
                        <div className="relative">
                          <select
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            className="w-full bg-[#1a1d25] border border-[#2a2d38] text-white rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--gold-500)]"
                          >
                            <option value="">-- Unassigned --</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Summary statistics */}
                      <div className="pt-4 border-t border-[#2a2d38] space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Total records:</span>
                          <span className="text-white font-bold">{csvData.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Ready to import:</span>
                          <span className="text-emerald-400 font-bold">{validRowCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Skipped (errors):</span>
                          <span className="text-rose-400 font-bold">{errorCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar (during import) */}
                    {importing && (
                      <div className="max-w-md mx-auto space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
                          <span>Importing contacts...</span>
                          <span>{importProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#2a2d38] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--gold-500)] transition-all duration-200" 
                            style={{ width: `${importProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {renderStepButtons()}
                  </div>
                ) : (
                  /* Completed State after insert */
                  <div className="space-y-6 text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Import Execution Completed</h3>
                      <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                        The contacts have been processed. See below for the import metrics and any failed records.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
                      <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5">
                        <p className="text-sm text-[var(--text-secondary)] font-medium">Successfully Imported</p>
                        <p className="text-3xl font-extrabold text-emerald-400 mt-1">{importStats.success}</p>
                      </div>

                      <div className="bg-[#22252f] rounded-xl border border-[#2a2d38] p-5">
                        <p className="text-sm text-[var(--text-secondary)] font-medium">Failed / Skipped</p>
                        <p className="text-3xl font-extrabold text-rose-400 mt-1">{importStats.failed}</p>
                      </div>
                    </div>

                    {importStats.failed > 0 && (
                      <div className="max-w-md mx-auto border border-[#2a2d38] rounded-lg bg-[#22252f] p-4 flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2 text-[var(--warning)] text-sm font-semibold">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span>{importStats.failed} records failed to import.</span>
                        </div>
                        <Button 
                          onClick={downloadFailedRowsCsv}
                          className="bg-[#1a1d25] border border-[#2a2d38] text-white hover:bg-[#282c38] font-semibold text-xs py-2 px-4 rounded-md inline-flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download Failed Rows CSV
                        </Button>
                      </div>
                    )}

                    <div className="pt-6 border-t border-[#2a2d38] flex justify-center gap-4">
                      <Link href="/contacts">
                        <Button className="bg-gradient-to-r from-[var(--gold-600)] to-[var(--gold-500)] hover:from-[var(--gold-500)] hover:to-[var(--gold-400)] text-[var(--text-inverse)] font-semibold px-6 shadow-md">
                          View Contacts
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setFile(null)
                          setCsvData([])
                          setHeaders([])
                          setMapping({})
                          setValidationResults([])
                          setPhoneResults([])
                          setAddressResults([])
                          setImportStats(null)
                          setFailedRowsList([])
                          setStep(1)
                        }}
                        className="border-[#2a2d38] text-[var(--text-secondary)] hover:bg-[#282c38] hover:text-white"
                      >
                        Import Another File
                      </Button>
                    </div>
                  </div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}
