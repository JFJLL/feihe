#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Delegate to feihe-mvp/scripts/migrate-delivery-project.mjs
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetScript = path.resolve(__dirname, '../feihe-mvp/scripts/migrate-delivery-project.mjs');
await import(pathToFileURL(targetScript).href);
