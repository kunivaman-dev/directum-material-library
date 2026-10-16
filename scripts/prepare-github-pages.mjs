import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const homePath = args.get('--home');
const outputPath = path.resolve(args.get('--out') || '.github-pages');

if (!homePath) {
  throw new Error('Usage: node scripts/prepare-github-pages.mjs --home <html> [--out <directory>]');
}

const withBase = html => html.replace('<head>', '<head>\n  <base href="/">');

await rm(outputPath, { recursive: true, force: true });
await mkdir(outputPath, { recursive: true });
await cp('dist/client', outputPath, { recursive: true });
await writeFile(path.join(outputPath, 'index.html'), await readFile(homePath));
await writeFile(path.join(outputPath, 'CNAME'), 'directum-design.desserg.ru\n');
await writeFile(path.join(outputPath, '.nojekyll'), '');

for (const route of ['icons', 'logos']) {
  const routePath = path.join(outputPath, route);
  await mkdir(routePath, { recursive: true });
  const html = await readFile(path.join(outputPath, `${route}.html`), 'utf8');
  await writeFile(path.join(routePath, 'index.html'), withBase(html));
}

// GitHub Pages cannot run the dynamic SVG endpoint. Keep copied links useful by
// pointing them at the canonical Sites endpoint, which renders the same asset.
const appPath = path.join(outputPath, 'app.js');
const app = await readFile(appPath, 'utf8');
await writeFile(
  appPath,
  app.replace(
    "const variantUrl=new URL('/api/icon',location.href);",
    "const variantUrl=new URL('/api/icon',location.hostname==='directum-design.desserg.ru'?'https://directum-icon-library.kunivaman.chatgpt.site':location.href);",
  ),
);

console.log(`Prepared GitHub Pages artifact in ${outputPath}`);
