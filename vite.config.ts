import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Two real pages (no router): the shop and /about.html. rolldownOptions is Vite 8's name for rollupOptions.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rolldownOptions: { input: { main: 'index.html', about: 'about.html' } } },
});
