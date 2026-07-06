import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function testTemplates() {
  console.log('Checking if public.whatsapp_templates exists...')
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching whatsapp_templates:', error.message)
  } else {
    console.log('whatsapp_templates exists! Data:', data)
  }
}

testTemplates().catch(console.error)
