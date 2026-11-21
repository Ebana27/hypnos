import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dossier = resolve(dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/assets/fonts')
const poidsDemandes = ['600', '700']
const apiFontshare = 'https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap'

async function existe(fichier) {
  try {
    await access(fichier)
    return true
  } catch {
    return false
  }
}

if (await Promise.all(poidsDemandes.map((poids) => existe(resolve(dossier, `clash-display-${poids}.woff2`)))).then((r) => r.every(Boolean))) {
  process.exit(0)
}

const reponseCss = await fetch(apiFontshare, { headers: { 'User-Agent': 'Hypnos Desktop build' } })
if (!reponseCss.ok) throw new Error(`Fontshare CSS indisponible (${reponseCss.status}).`)
const css = await reponseCss.text()
const blocs = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1])
const telechargements = poidsDemandes.map((poids) => {
  const bloc = blocs.find((contenu) => contenu.match(/font-weight:\s*(\d+)/)?.[1] === poids)
  const urlRelative = bloc?.match(/url\(['"]?(\/\/[^)'"\s]+\.woff2)['"]?\)/)?.[1]
  if (!urlRelative) throw new Error(`Graisse ${poids} de Clash Display absente de la réponse Fontshare.`)
  return { poids, url: `https:${urlRelative}` }
})

await mkdir(dossier, { recursive: true })
for (const { poids, url } of telechargements) {
  const reponse = await fetch(url, { headers: { 'User-Agent': 'Hypnos Desktop build' } })
  if (!reponse.ok) throw new Error(`Téléchargement Clash Display ${poids} impossible (${reponse.status}).`)
  await writeFile(resolve(dossier, `clash-display-${poids}.woff2`), Buffer.from(await reponse.arrayBuffer()))
  console.log(`Clash Display ${poids} prête pour le build.`)
}
