// Vérifie que chaque import relatif pointe vers un fichier SUIVI PAR GIT, avec la bonne casse.
// C'est exactement ce que voit GitHub Actions sur Linux.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const suivis = new Set(
  execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .map((l) => l.trim().replace(/\\/g, '/'))
    .filter(Boolean)
)
const suivisMinuscules = new Map([...suivis].map((p) => [p.toLowerCase(), p]))

const EXTENSIONS = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.css']
const REGEX = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"?]+)(?:\?[^'"]*)?['"]/g

let problemes = 0

for (const fichier of suivis) {
  if (!fichier.startsWith('src/') || !/\.(jsx?|mjs|tsx?)$/.test(fichier)) continue
  const contenu = fs.readFileSync(fichier, 'utf8')

  for (const m of contenu.matchAll(REGEX)) {
    const base = path.posix.join(path.posix.dirname(fichier), m[1])
    const candidats = [
      ...EXTENSIONS.map((e) => base + e),
      ...EXTENSIONS.slice(1).map((e) => `${base}/index${e}`)
    ]
    if (candidats.some((c) => suivis.has(c))) continue

    problemes++
    const memeCasse = candidats.map((c) => suivisMinuscules.get(c.toLowerCase())).find(Boolean)
    const surDisque = candidats.find((c) => fs.existsSync(c))
    console.log(`\n✗ ${fichier}\n  importe « ${m[1]} »`)
    if (memeCasse) {
      console.log(`  → Git contient « ${memeCasse} » : la CASSE ne correspond pas (change l'import).`)
    } else if (surDisque) {
      console.log(`  → Le fichier existe sur ton disque (${surDisque}) mais Git ne le suit pas.`)
      console.log(`    Corrige avec : git add -f ${surDisque}`)
    } else {
      console.log('  → Aucun fichier de ce nom nulle part : import à corriger ou fichier à recréer.')
    }
  }
}

console.log(problemes === 0 ? '\n✓ Tous les imports relatifs sont corrects.' : `\n${problemes} problème(s) trouvé(s).`)
process.exit(problemes === 0 ? 0 : 1)