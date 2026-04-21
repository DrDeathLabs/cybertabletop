import { execFileSync } from 'node:child_process';
import path from 'node:path';

async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'https://localhost';
  const shouldResetDocker =
    process.env.E2E_SKIP_DOCKER_RESET !== 'true'
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

  if (!shouldResetDocker) return;

  const repoRoot = path.resolve(process.cwd(), '..');
  const backendContainer = process.env.E2E_BACKEND_CONTAINER ?? 'cybertabletop-backend-1';

  execFileSync('docker', ['compose', 'restart', 'backend'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const status = execFileSync('docker', [
      'inspect',
      '--format',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
      backendContainer,
    ], { encoding: 'utf8' }).trim();

    if (status === 'healthy' || status === 'running') return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`Timed out waiting for ${backendContainer} to become healthy.`);
}

export default globalSetup;
