import { defineConfig } from 'vite';

// GitHub Pages serves the site at https://pedmafia.github.io/Test-3D-wed01/
// Dev server stays at the root so `npm run dev` keeps working at localhost:5173/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/Test-3D-wed01/' : '/',
}));
