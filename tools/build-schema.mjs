import { readdir, readFile, writeFile } from 'node:fs/promises';
const dir = 'supabase/migrations';
const files = (await readdir(dir)).filter(x => x.endsWith('.sql')).sort();
const parts = await Promise.all(files.map(async f => `\n-- ===== ${f} =====\n` + await readFile(`${dir}/${f}`, 'utf8')));
await writeFile('supabase/schema.sql', '-- KALAM SE KRANTI: generated from migrations; edit migrations, then npm run build:schema.\n-- Run on a NEW/staging project first. Additive: legacy tables are not dropped.\n' + parts.join('\n'));
console.log(`Built supabase/schema.sql from ${files.length} migrations.`);
