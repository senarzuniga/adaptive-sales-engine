import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface SetupOptions {
  setupTemplates: boolean;
  seedConditions: boolean;
}

function parseArgs(): SetupOptions {
  const args = new Set(process.argv.slice(2));
  return {
    setupTemplates: args.has('--setup-templates'),
    seedConditions: args.has('--seed-conditions'),
  };
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

export async function runOfferSystemSetup() {
  const options = parseArgs();

  run('npx', ['supabase', 'migration', 'up']);

  if (options.setupTemplates || options.seedConditions) {
    run('npx', ['supabase', 'db', 'push']);
  }

  run('npx', ['supabase', 'functions', 'deploy', 'offers-api']);

  console.log('Offer system setup completed.');
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentFilePath = fileURLToPath(import.meta.url);

if (scriptPath && scriptPath === currentFilePath) {
  runOfferSystemSetup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
