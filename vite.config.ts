import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Stable, unhashed filenames for the client build so manual re-uploads
      // overwrite cleanly instead of orphaning hashed files (which 404).
      // The SSR build keeps its default output (dist-ssr/entry-server.js).
      output: isSsrBuild
        ? {}
        : {
            entryFileNames: 'assets/index.js',
            chunkFileNames: 'assets/[name].js',
            assetFileNames: 'assets/index.[ext]',
          },
    },
  },
}));
