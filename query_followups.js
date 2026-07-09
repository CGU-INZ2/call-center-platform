const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('Querying profiles...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, role');

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError.message);
  } else {
    console.log('Profiles:', profiles);
  }

  console.log('\nQuerying all contacts details...');
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*, category:categories(id, label)');

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError.message);
    return;
  }

  console.log(`Total contacts in database: ${contacts.length}`);
  contacts.forEach(c => {
    console.log(`- Name: ${c.full_name}, Status: ${c.call_status}, Category: ${c.category ? c.category.label : 'None'} (ID: ${c.category_id}), Phone: ${c.phone}, Notes: ${c.notes}, Want Prayer: ${c.want_prayer}, Watched Program: ${c.watched_program}, Created At: ${c.created_at}`);
  });




  console.log('\nQuerying followups table for pending/all statuses...');
  const { data: followups, error: followupsError } = await supabase
    .from('followups')
    .select('id, contact_id, status, due_at');

  if (followupsError) {
    console.error('Error fetching followups:', followupsError.message);
    return;
  }

  console.log(`Found ${followups.length} total follow-up records in the database:`);
  followups.forEach(f => {
    const contactName = contacts.find(c => c.id === f.contact_id)?.full_name || 'Other/Unknown';
    console.log(`- ID: ${f.id}, Contact: ${contactName} (ID: ${f.contact_id}), Status: ${f.status}, Due: ${f.due_at}`);
  });
}

check();
