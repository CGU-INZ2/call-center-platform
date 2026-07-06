import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testSchema() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
    }
  });
  const doc = await res.json();
  
  console.log('Tables exposed via API:');
  console.log(Object.keys(doc.definitions || {}));
  
  if (doc.definitions && doc.definitions.contacts) {
    console.log('Properties in contacts:');
    console.log(Object.keys(doc.definitions.contacts.properties));
  } else {
    console.log('contacts definition not found');
  }
}

testSchema().catch(console.error);
