import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    // Just build regardless of errors
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/TransformControls']
  }
}); 