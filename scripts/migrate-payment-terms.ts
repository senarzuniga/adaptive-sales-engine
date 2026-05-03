import { spawnSync } from 'node:child_process';

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

try {
  run('npx', ['supabase', 'migration', 'up']);
  console.log('Payment terms migrations applied.');
} catch (error: any) {
  console.error(error?.message || 'Migration failed');
  process.exit(1);
}
