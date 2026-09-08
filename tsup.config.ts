import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/apix': 'src/bin/apix.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  target: 'node20',
  sourcemap: true,
});
