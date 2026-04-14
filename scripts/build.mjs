import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = 'src';
const outDir = 'docs';

if (!existsSync(srcDir)) {
  throw new Error('src directory not found.');
}

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });
cpSync(srcDir, outDir, { recursive: true });

const indexPath = join(outDir, 'index.html');
const builtAt = new Date().toISOString();
const html = readFileSync(indexPath, 'utf8').replace(
  '</head>',
  `  <meta name="build-timestamp" content="${builtAt}" />\n</head>`
);
writeFileSync(indexPath, html, 'utf8');

console.log(`Build complete: ${srcDir} -> ${outDir}`);
