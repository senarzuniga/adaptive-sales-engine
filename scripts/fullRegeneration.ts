import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

interface StartResult {
  regenerationId: string;
  status: string;
}

interface RegenerationStatusPayload {
  log: {
    id: string;
    status: string;
    pre_entity_count: number;
    post_entity_count: number;
    pre_document_count: number;
    post_document_count: number;
    unresolved_contradictions: number;
  } | null;
  pendingContradictions: Array<{
    id: string;
    entity_name: string;
    field_name: string;
    value_a: string;
    value_b: string;
  }>;
}

const DEFAULT_REASON = 'regeneration_after_protocol_upgrade';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    confirm: args.has('--confirm'),
    dryRun: args.has('--dry-run'),
    keepTemplates: args.has('--keep-templates'),
    companyId: process.argv.find((arg) => arg.startsWith('--company='))?.split('=')[1] || null,
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function startRegeneration(baseUrl: string, apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/functions/v1/data-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'admin.regenerate.start',
      ...payload,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `Regeneration start failed (${response.status})`);
  }

  return json as StartResult;
}

async function fetchStatus(baseUrl: string, apiKey: string, regenerationId: string) {
  const response = await fetch(
    `${baseUrl}/functions/v1/data-api/api/admin/regenerate/status?action=admin.regenerate.status&regenerationId=${encodeURIComponent(regenerationId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `Status request failed (${response.status})`);
  }

  return json as RegenerationStatusPayload;
}

async function resolveContradiction(baseUrl: string, apiKey: string, contradictionId: string, resolvedValue: string) {
  const response = await fetch(`${baseUrl}/functions/v1/api-contradictions/api/contradictions/${encodeURIComponent(contradictionId)}/resolve`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolvedValue }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `Resolution failed for contradiction ${contradictionId}`);
  }
}

async function run() {
  const args = parseArgs();
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!args.dryRun && !args.confirm) {
    throw new Error('This command is destructive. Re-run with --confirm.');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(args.dryRun ? '> Dry run: validating regeneration plan...' : '> Starting full regeneration...');
  const start = await startRegeneration(supabaseUrl, serviceKey, {
    keepTemplates: args.keepTemplates,
    dryRun: args.dryRun,
    companyId: args.companyId,
    reason: DEFAULT_REASON,
    userId: 'cli',
  });

  console.log(`> Regeneration run: ${start.regenerationId}`);

  const channel = supabase
    .channel(`regen-cli-${start.regenerationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'regeneration_logs',
        filter: `id=eq.${start.regenerationId}`,
      },
      (payload) => {
        const row = payload.new as any;
        console.log(`> [ws] status=${row.status} documents=${row.documents_processed || 0} entities=${row.entities_processed || 0}`);
      },
    )
    .subscribe();

  const rl = createInterface({ input, output });

  try {
    while (true) {
      const status = await fetchStatus(supabaseUrl, serviceKey, start.regenerationId);
      const log = status.log;

      if (!log) {
        console.log('> Waiting for log materialization...');
        await sleep(2000);
        continue;
      }

      console.log(`> Status: ${log.status}`);

      if (log.status === 'dry_run') {
        console.log(`> Dry run completed. Entities pre-count: ${log.pre_entity_count}, documents pre-count: ${log.pre_document_count}.`);
        return;
      }

      if (status.pendingContradictions.length > 0) {
        console.log(`> Contradictions found: ${status.pendingContradictions.length}`);

        for (const item of status.pendingContradictions) {
          console.log(`> ${item.entity_name}: ${item.field_name} -> A="${item.value_a}" | B="${item.value_b}"`);
          const answer = await rl.question('  Choose [a|b|c(custom)|s(skip)]: ');
          const normalized = answer.trim().toLowerCase();

          if (normalized === 's') {
            continue;
          }

          if (normalized === 'a') {
            await resolveContradiction(supabaseUrl, serviceKey, item.id, item.value_a);
            console.log('  Resolved with value A.');
            continue;
          }

          if (normalized === 'b') {
            await resolveContradiction(supabaseUrl, serviceKey, item.id, item.value_b);
            console.log('  Resolved with value B.');
            continue;
          }

          const custom = await rl.question('  Enter custom value: ');
          if (custom.trim()) {
            await resolveContradiction(supabaseUrl, serviceKey, item.id, custom.trim());
            console.log('  Resolved with custom value.');
          }
        }
      }

      if (log.status === 'completed') {
        console.log(`> Regeneration complete.`);
        console.log(`> Entity count: ${log.pre_entity_count} -> ${log.post_entity_count}`);
        console.log(`> Document count: ${log.pre_document_count} -> ${log.post_document_count}`);
        return;
      }

      if (log.status === 'waiting_manual_resolution') {
        console.log('> Manual contradiction resolution was required and captured.');
        console.log('> Re-run npm run regenerate:full -- --confirm after resolving all contradictions if cascade steps are still pending.');
        return;
      }

      if (log.status === 'failed') {
        throw new Error('Regeneration failed. Check regeneration_logs execution_log for details.');
      }

      await sleep(3000);
    }
  } finally {
    rl.close();
    await supabase.removeChannel(channel);
  }
}

run().catch((error) => {
  console.error(`Regeneration error: ${error.message}`);
  process.exit(1);
});
