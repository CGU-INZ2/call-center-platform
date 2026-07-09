require('dotenv').config({ path: '.env.local' });

async function check() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  };

  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log('Available RPC paths:');
    const rpcPaths = Object.keys(data.paths).filter(p => p.startsWith('/rpc/'));
    console.log(rpcPaths);
  } catch (err) {
    console.error(err);
  }
}

check();
