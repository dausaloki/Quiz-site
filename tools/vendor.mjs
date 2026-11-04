import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('assets/vendor', { recursive: true });
await build({ stdin: { contents: "import { createClient } from '@supabase/supabase-js'; window.supabase = { createClient };", resolveDir: process.cwd(), loader: 'js' }, bundle: true, minify: true, format: 'iife', target: ['es2020'], outfile: 'assets/vendor/supabase.js', legalComments: 'inline' });
await copyFile('node_modules/jspdf/dist/jspdf.umd.min.js', 'assets/vendor/jspdf.umd.min.js');
await copyFile('node_modules/html2canvas/dist/html2canvas.min.js', 'assets/vendor/html2canvas.min.js');
for (const [src, dest] of [['node_modules/@supabase/supabase-js/LICENSE','LICENSE-supabase-js.txt'],['node_modules/jspdf/LICENSE','LICENSE-jspdf.txt'],['node_modules/html2canvas/LICENSE','LICENSE-html2canvas.txt']]) { try { await copyFile(src, 'assets/vendor/' + dest); } catch { console.warn('Review upstream license:', src); } }
console.log('Vendored browser libraries. No CDN is required by the new portal.');
