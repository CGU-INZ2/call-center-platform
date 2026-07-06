const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('contacts')
    .select('language, watched_program, cell_group_name, call_status')
    .limit(1);

  if (error) {
    console.error('Error fetching contacts with Sprint 2.2 columns:', error.message);
  } else {
    console.log('Columns exist! Successfully queried columns language, watched_program, cell_group_name, call_status');
  }
}

check();
