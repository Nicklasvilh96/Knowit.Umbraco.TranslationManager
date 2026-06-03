import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/dashboard.element.ts',
      formats: ['es'],
      fileName: 'dashboard',
    },
    outDir: '../App_Plugins/TranslationManager',
    emptyOutDir: false,
    rollupOptions: {
      external: [/^@umbraco-cms\//],
    },
  },
});
