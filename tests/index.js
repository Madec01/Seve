// Point d'entrée de `node --test tests/` : Node traite le dossier comme un module et charge ce fichier,
// qui importe chaque fichier *.test.js du dossier (`node --test` sans argument les trouve aussi tout seul).
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()) {
  await import(pathToFileURL(`${dir}/${file}`).href);
}
