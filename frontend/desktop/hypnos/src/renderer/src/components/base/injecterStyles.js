// Ajoute le CSS d'un composant une seule fois dans <head>.
// Si la balise existe déjà (rechargement à chaud en dev), son contenu est mis à jour.
export default function injecterStyles(id, css) {
  if (typeof document === 'undefined') return
  let balise = document.getElementById(id)
  if (!balise) {
    balise = document.createElement('style')
    balise.id = id
    document.head.appendChild(balise)
  }
  balise.textContent = css
}