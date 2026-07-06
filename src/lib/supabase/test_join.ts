import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const client = createClient(SUPABASE_URL, ANON_KEY);

async function testJoin() {
  console.log('Testing contacts -> profiles join...');
  const { data, error } = await client
    .from('contacts')
    .select('id, full_name, agent:profiles!contacts_assigned_agent_id_fkey(id, full_name)')
    .limit(1);

  if (error) {
    console.error('❌ Join query failed:', error);
  } else {
    console.log('✅ Join query succeeded! Data:', JSON.stringify(data, null, 2));
  }
}

testJoin().catch(console.error);
