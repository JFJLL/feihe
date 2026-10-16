import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['public/vendor/**', '.next/**', 'dist/**', 'out/**', 'build/**', '.verification/**', 'next-env.d.ts']),
]);

export default eslintConfig;
