import 'dotenv/config';

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

function requireAnyEnv(names: string[], description: string) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${description}. Tried: ${names.join(', ')}`);
}

async function rollbackByRegenerationId(baseUrl: string, apiKey: string, regenerationId: string) {
  const endpoints = [
    `${baseUrl}/functions/v1/data-api/api/admin/regenerate/rollback`,
    `${baseUrl}/functions/v1/data-api`,
  ];

  let lastError = 'Rollback failed';
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
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
    if (response.ok) {
      return payload;
    }

    lastError = payload?.error || `Rollback failed (${response.status})`;
    if (String(lastError).toLowerCase().includes('unknown endpoint')) {
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError);
}

async function getLatestRegenerationId(baseUrl: string, apiKey: string) {
  const endpoints = [
    `${baseUrl}/functions/v1/data-api/api/admin/regenerate/status?action=admin.regenerate.status`,
    `${baseUrl}/functions/v1/data-api?action=admin.regenerate.status`,
  ];

  let lastError = 'Could not read latest regeneration status';
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const id = payload?.log?.id;
      if (!id) throw new Error('No regeneration log found to roll back.');
      return String(id);
    }

    lastError = payload?.error || `Could not read latest regeneration status (${response.status})`;
    if (String(lastError).toLowerCase().includes('unknown endpoint')) {
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError);
}

async function run() {
  const args = parseArgs();
  const baseUrl = requireAnyEnv(
    ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    'Supabase URL environment variable',
  );
  const serviceKey = requireAnyEnv(
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'],
    'Supabase service role key environment variable',
  );

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
