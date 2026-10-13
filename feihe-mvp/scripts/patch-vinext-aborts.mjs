import { readFile, writeFile } from 'node:fs/promises';

// Compatibility guard for the pinned transport. Keep cancelled POST streams
// out of Request cloning; active requests and API/authentication remain intact.
const packagePath = new URL('../node_modules/vinext/package.json', import.meta.url);
const runtimePath = new URL('../node_modules/vinext/dist/server/app-rsc-handler.js', import.meta.url);
const version = JSON.parse(await readFile(packagePath, 'utf8')).version;
if (version !== '1.0.0-beta.3') throw new Error('Review the cancelled-request guard before changing vinext ' + version);
const source = await readFile(runtimePath, 'utf8');
const marker = '/* feihe: discard closed request before body cloning */';
if (source.includes(marker)) process.stdout.write('Vinext closed-request guard already applied\n');
else {
  const anchor = '\t\tawait options.ensureInstrumentation?.();';
  if (source.split(anchor).length !== 2) throw new Error('Vinext request entry changed; guard was not applied');
  const guard = `${anchor}\n\t\t${marker}\n\t\tconst transport = rawRequest.runtime?.node;\n\t\tif (rawRequest.signal.aborted || transport?.req?.aborted || (transport?.res?.destroyed && !transport.res.writableEnded)) return new Response(null, { status: 499 });`;
  await writeFile(runtimePath, source.replace(anchor, guard));
  process.stdout.write('Applied Vinext closed-request guard\n');
}
