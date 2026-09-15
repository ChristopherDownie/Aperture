import { defineConfig } from 'vite';
import { libraryPlugin } from './server/luxalgo-library.mjs';

export default defineConfig({ plugins: [libraryPlugin()] });
