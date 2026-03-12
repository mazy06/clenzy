import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ClenzyBooking',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'clenzy-booking.esm.js';
        if (format === 'cjs') return 'clenzy-booking.cjs.js';
        return 'clenzy-booking.min.js'; // IIFE for CDN
      },
    },
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
});
