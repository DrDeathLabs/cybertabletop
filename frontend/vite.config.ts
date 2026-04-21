import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')
            || id.includes('node_modules/react-dom')
            || id.includes('node_modules/react-router-dom')) return 'vendor';
          if (id.includes('node_modules/socket.io-client')) return 'socket';
          if (id.includes('node_modules/lucide-react')
            || id.includes('node_modules/@radix-ui/react-dialog')) return 'ui';
          return undefined;
        },
      },
    },
  },
});
