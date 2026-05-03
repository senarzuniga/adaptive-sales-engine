function parseArgs() {
  const args = process.argv.slice(2);
  const toMigration = args.find((arg) => arg.startsWith('--to-migration='))?.split('=')[1]
    || args[args.indexOf('--to-migration') + 1]
    || null;
  const regenerationId = args.find((arg) => arg.startsWith('--regeneration-id='))?.split('=')[1]
    || args[args.indexOf('--regeneration-id') + 1]
    || null;

  return {
    toMigration,
    regenerationId,
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function rollbackByRegenerationId(baseUrl: string, apiKey: string, regenerationId: string) {
  const response = await fetch(`${baseUrl}/functions/v1/data-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'admin.regenerate.rollback',
      regenerationId,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Rollback failed (${response.status})`);
  }
  return payload;
}

async function getLatestRegenerationId(baseUrl: string, apiKey: string) {
  const response = await fetch(`${baseUrl}/functions/v1/data-api/api/admin/regenerate/status?action=admin.regenerate.status`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Could not read latest regeneration status (${response.status})`);
  }

  const id = payload?.log?.id;
  if (!id) throw new Error('No regeneration log found to roll back.');
  return String(id);
}

async function run() {
  const args = parseArgs();
  const baseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (args.toMigration && args.toMigration !== 'pre_regeneration_backup') {
    throw new Error('This rollback command currently supports only --to-migration pre_regeneration_backup.');
  }

  const regenerationId = args.regenerationId || await getLatestRegenerationId(baseUrl, serviceKey);
  const result = await rollbackByRegenerationId(baseUrl, serviceKey, regenerationId);

  console.log(`Rollback complete for regeneration ${result.regenerationId}. Status: ${result.status}`);
}

run().catch((error) => {
  console.error(`Rollback error: ${error.message}`);
  process.exit(1);
});
