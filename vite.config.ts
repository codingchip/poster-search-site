import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function githubPagesBase() {
  const configuredBase = process.env.VITE_BASE_PATH;
  if (configuredBase) {
    const normalizedBase = configuredBase.replace(/^\/+|\/+$/g, '');
    return normalizedBase ? `/${normalizedBase}/` : '/';
  }

  if (process.env.GITHUB_ACTIONS !== 'true') return '/';

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (!repositoryName || repositoryName.endsWith('.github.io')) return '/';
  return `/${repositoryName}/`;
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [react()],
});
