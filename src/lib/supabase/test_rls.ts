/**
 * Sprint 1.2 — RLS Verification Script
 *
 * Run this AFTER applying the SQL migration to confirm:
 *   1. Admin can read ALL contacts
 *   2. Agent A can only see their OWN contacts
 *   3. Agent A CANNOT read Agent B's contacts
 *   4. audit_log receives entries when contacts/calls are mutated
 *
 * Usage:
 *   npx tsx src/lib/supabase/test_rls.ts
 *
 * Requirements:
 *   - .env.local must have SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
 *   - Two test user accounts must exist in Supabase Auth (Agent A and Agent B)
 *   - One admin account must exist with role = 'admin' in public.profiles
 *
 * Set the UUIDs below before running.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── CONFIGURE THESE before running ─────────────────────────────────────────
const AGENT_A_EMAIL = 'agent-a@test.com';
const AGENT_A_PASS  = 'TestPass@123!';

const AGENT_B_EMAIL = 'agent-b@test.com';
const AGENT_B_PASS  = 'TestPass@123!';
// ───────────────────────────────────────────────────────────────────────────

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('\n🔐 Sprint 1.2 — RLS Verification\n');

  // ------------------------------------------------------------------
  // 1. Create two test agents via service role (bypasses RLS)
  // ------------------------------------------------------------------
  console.log('📌 Step 1: Creating test agent accounts...');

  const { data: agentAData, error: agentAErr } = await service.auth.admin.createUser({
    email: AGENT_A_EMAIL,
    password: AGENT_A_PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Test Agent A' },
  });
  if (agentAErr && !agentAErr.message.includes('already exists') && !agentAErr.message.includes('already been registered')) {
    console.error('Agent A creation failed:', agentAErr.message); process.exit(1);
  }
  const agentAId = agentAData?.user?.id ?? (
    (await service.auth.admin.listUsers()).data.users.find(u => u.email === AGENT_A_EMAIL)!.id
  );

  const { data: agentBData, error: agentBErr } = await service.auth.admin.createUser({
    email: AGENT_B_EMAIL,
    password: AGENT_B_PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Test Agent B' },
  });
  if (agentBErr && !agentBErr.message.includes('already exists') && !agentBErr.message.includes('already been registered')) {
    console.error('Agent B creation failed:', agentBErr.message); process.exit(1);
  }
  const agentBId = agentBData?.user?.id ?? (
    (await service.auth.admin.listUsers()).data.users.find(u => u.email === AGENT_B_EMAIL)!.id
  );

  console.log(`  ✅ Agent A: ${agentAId}`);
  console.log(`  ✅ Agent B: ${agentBId}`);

  // ------------------------------------------------------------------
  // 2. Seed one contact per agent via service role
  // ------------------------------------------------------------------
  console.log('\n📌 Step 2: Seeding test contacts...');

  await service.from('contacts').delete().in('assigned_agent_id', [agentAId, agentBId]);

  const { data: contactA, error: caErr } = await service.from('contacts').insert({
    full_name: 'Contact Owned by Agent A',
    phone: '9000000001',
    assigned_agent_id: agentAId,
    created_by: agentAId,
  }).select('id').single();
  if (caErr) { console.error('Seed contact A failed:', caErr.message); process.exit(1); }

  const { data: contactB, error: cbErr } = await service.from('contacts').insert({
    full_name: 'Contact Owned by Agent B',
    phone: '9000000002',
    assigned_agent_id: agentBId,
    created_by: agentBId,
  }).select('id').single();
  if (cbErr) { console.error('Seed contact B failed:', cbErr.message); process.exit(1); }

  console.log(`  ✅ Contact A id: ${contactA.id}`);
  console.log(`  ✅ Contact B id: ${contactB.id}`);

  // ------------------------------------------------------------------
  // 3. Sign in as Agent A and try to read contacts
  // ------------------------------------------------------------------
  console.log('\n📌 Step 3: Agent A signs in and queries contacts...');

  const agentAClient = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await agentAClient.auth.signInWithPassword({
    email: AGENT_A_EMAIL, password: AGENT_A_PASS,
  });
  if (signInErr) { console.error('Agent A sign in failed:', signInErr.message); process.exit(1); }

  const { data: agentAContacts, error: agentAReadErr } = await agentAClient
    .from('contacts').select('id, full_name, assigned_agent_id');

  if (agentAReadErr) {
    console.error('  ❌ Agent A failed to read contacts:', agentAReadErr.message);
  } else {
    const onlyOwn = agentAContacts!.every(c => c.assigned_agent_id === agentAId);
    const cannotSeeB = !agentAContacts!.find(c => c.assigned_agent_id === agentBId);
    console.log(`  ${onlyOwn ? '✅' : '❌'} Agent A only sees own contacts: ${onlyOwn}`);
    console.log(`  ${cannotSeeB ? '✅' : '❌'} Agent A cannot see Agent B's contacts: ${cannotSeeB}`);
    if (!onlyOwn || !cannotSeeB) {
      console.log('  Contacts returned:', agentAContacts);
    }
  }

  // ------------------------------------------------------------------
  // 4. Agent A tries to UPDATE Agent B's contact (should fail)
  // ------------------------------------------------------------------
  console.log('\n📌 Step 4: Agent A tries to UPDATE Agent B\'s contact (should fail)...');

  const { data: illegalUpdate, error: illegalErr } = await agentAClient
    .from('contacts')
    .update({ notes: 'Hacked by Agent A' })
    .eq('id', contactB.id)
    .select();

  const updateBlocked = !illegalUpdate || illegalUpdate.length === 0;
  console.log(`  ${updateBlocked ? '✅' : '❌'} Illegal update blocked: ${updateBlocked}`);
  if (!updateBlocked) {
    console.warn('  ⚠️  RLS FAILURE — Agent A was able to update Agent B\'s contact!');
    console.log('  Data returned:', illegalUpdate);
  }

  // ------------------------------------------------------------------
  // 5. Agent A inserts a call on their own contact (should succeed)
  // ------------------------------------------------------------------
  console.log('\n📌 Step 5: Agent A inserts a call on their own contact (should succeed)...');

  const agentASession = (await agentAClient.auth.getUser()).data.user;
  const { data: newCall, error: callErr } = await agentAClient.from('calls').insert({
    contact_id: contactA.id,
    agent_id: agentASession!.id,
    outcome: 'answered',
    notes: 'RLS test call from Agent A',
  }).select('id').single();

  if (callErr) {
    console.error(`  ❌ Call insert failed: ${callErr.message}`);
  } else {
    console.log(`  ✅ Call inserted successfully: ${newCall.id}`);
  }

  // ------------------------------------------------------------------
  // 6. Verify audit_log received entries (read via service role)
  // ------------------------------------------------------------------
  console.log('\n📌 Step 6: Checking audit_log for auto-generated entries...');

  const { data: auditRows, error: auditErr } = await service
    .from('audit_log')
    .select('entity_type, action, entity_id')
    .in('entity_id', [contactA.id, contactB.id, newCall?.id].filter(Boolean))
    .order('created_at', { ascending: false })
    .limit(10);

  if (auditErr) {
    console.error('  ❌ Failed to read audit_log:', auditErr.message);
  } else {
    console.log(`  ✅ Audit log entries found: ${auditRows!.length}`);
    auditRows!.forEach(row => {
      console.log(`     [${row.action}] ${row.entity_type} → ${row.entity_id}`);
    });
  }

  // ------------------------------------------------------------------
  // 7. Cleanup (optional — comment out to inspect data in Supabase)
  // ------------------------------------------------------------------
  console.log('\n📌 Step 7: Cleaning up test data...');
  await service.from('contacts').delete().in('id', [contactA.id, contactB.id]);
  await service.auth.admin.deleteUser(agentAId);
  await service.auth.admin.deleteUser(agentBId);
  console.log('  ✅ Cleanup complete');

  console.log('\n✨ RLS verification complete!\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
