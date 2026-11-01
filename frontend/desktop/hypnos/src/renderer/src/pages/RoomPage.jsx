import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import Button from '../components/base/Button'
import CardRoom, { STATUTS_CHAMBRE } from '../components/base/CardRoom'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import Modal from '../components/base/Modal'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'

const STYLES = `
.chambres__filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.chambres__etage {
  margin-bottom: 24px;
}
.chambres__etage-titre {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
}
.chambres__grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}
.chambres__vide {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}
.chambres__statuts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.chambres__categories {
  margin-bottom: 24px;
}
.chambres__categories-entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.chambres__categories-titre {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.chambres__categories-note,
.chambres__categories-vide {
  color: var(--color-text-muted);
  font-size: 13px;
}
.chambres__categories-grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.chambres__categorie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.chambres__categorie-infos {
  min-width: 0;
}
.chambres__categorie-nom {
  overflow: hidden;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chambres__categorie-detail {
  margin-top: 3px;
  color: var(--color-text-muted);
  font-size: 12px;
}
`

injecterStyles('hypnos-page-chambres', STYLES)

const CATEGORIE_VIDE = { label: '', prix: '', capacite: '' }
const chambreVide = (types) => ({
  numero: '',
  etage: '0',
  typeId: types.length === 1 ? String(types[0].id) : ''
})

function libelleEtage(etage) {
  if (etage === 0) return 'RDC'
  return etage === 1 ? '1er étage' : `${etage}e étage`
}

export default function RoomPage() {
  const [chambres, setChambres] = useState([])
  const [types, setTypes] = useState([])
  const [filtre, setFiltre] = useState('tous')

  const [modale, setModale] = useState(null) // 'chambre' | 'categorie' | 'statut'
  const [selection, setSelection] = useState(null)
  const [categorieSelectionnee, setCategorieSelectionnee] = useState(null)
  const [formChambre, setFormChambre] = useState(chambreVide([]))
  const [formCategorie, setFormCategorie] = useState(CATEGORIE_VIDE)

  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  const charger = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        window.electronAPI.getAll('chambre'),
        window.electronAPI.getAll('typedechambre')
      ])
      setChambres(c)
      setTypes(t)
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  // Exécute une action, recharge la liste, ferme la modale et affiche le résultat
  async function executer(action, messageSucces) {
    setChargement(true)
    try {
      await action()
      await charger()
      setModale(null)
      setSucces(messageSucces)
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  const creerChambre = () =>
    executer(
      () =>
        window.electronAPI.create('chambre', {
          numero: formChambre.numero.trim(),
          etage: Number(formChambre.etage),
          typeId: Number(formChambre.typeId)
        }),
      `Chambre ${formChambre.numero.trim()} ajoutée.`
    )

  const enregistrerCategorie = () => {
    const donneesCategorie = {
      label: formCategorie.label.trim(),
      prix: Number(formCategorie.prix),
      capacite: Number(formCategorie.capacite)
    }
    const action = categorieSelectionnee
      ? () => window.electronAPI.update('typedechambre', categorieSelectionnee.id, donneesCategorie)
      : () => window.electronAPI.create('typedechambre', donneesCategorie)
    const message = categorieSelectionnee
      ? `Catégorie « ${donneesCategorie.label} » modifiée.`
      : `Catégorie « ${donneesCategorie.label} » ajoutée.`
    return executer(action, message)
  }

  const changerStatut = (statut) =>
    executer(
      () => window.electronAPI.update('chambre', selection.id, { statut }),
      `Chambre ${selection.numero} : ${STATUTS_CHAMBRE[statut].libelle}.`
    )

  function ouvrirChambre() {
    if (types.length === 0) {
      setEchec("Créez d'abord une catégorie de chambre.")
      return
    }
    setFormChambre(chambreVide(types))
    setModale('chambre')
  }

  function ouvrirCategorie() {
    setCategorieSelectionnee(null)
    setFormCategorie(CATEGORIE_VIDE)
    setModale('categorie')
  }

  function modifierCategorie(categorie) {
    setCategorieSelectionnee(categorie)
    setFormCategorie({
      label: categorie.label ?? '',
      prix: String(categorie.prix ?? ''),
      capacite: String(categorie.capacite ?? '')
    })
    setModale('categorie')
  }

  // ---------- Données affichées ----------
  const typesParId = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types])

  const visibles = useMemo(
    () =>
      chambres
        .filter((c) => filtre === 'tous' || c.statut === filtre)
        .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })),
    [chambres, filtre]
  )
  const etages = [...new Set(visibles.map((c) => c.etage))].sort((a, b) => a - b)
  const compter = (statut) => chambres.filter((c) => c.statut === statut).length
  const fermer = () => setModale(null)

  return (
    <section>
      <Header titre="Chambres">
        <Button variante="secondaire" icone={Plus} onClick={ouvrirCategorie}>
          Ajouter une catégorie
        </Button>
        <Button icone={Plus} onClick={ouvrirChambre}>
          Ajouter une chambre
        </Button>
      </Header>

      <section className="chambres__categories" aria-labelledby="titre-categories">
        <div className="chambres__categories-entete">
          <h2 className="chambres__categories-titre" id="titre-categories">Catégories de chambres</h2>
          <p className="chambres__categories-note">Tarif par nuit et capacité maximale</p>
        </div>
        {types.length > 0 ? (
          <div className="chambres__categories-grille">
            {types.map((categorie) => (
              <article className="chambres__categorie" key={categorie.id}>
                <div className="chambres__categorie-infos">
                  <p className="chambres__categorie-nom">{categorie.label}</p>
                  <p className="chambres__categorie-detail">
                    {Number(categorie.prix).toLocaleString('fr-FR')} XAF / nuit · {categorie.capacite} {Number(categorie.capacite) === 1 ? 'personne' : 'personnes'}
                  </p>
                </div>
                <Button
                  variante="secondaire"
                  taille="s"
                  icone={Pencil}
                  aria-label={`Modifier la catégorie ${categorie.label}`}
                  onClick={() => modifierCategorie(categorie)}
                >
                  Modifier
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="chambres__categories-vide">Aucune catégorie. Ajoutez-en une pour pouvoir créer des chambres.</p>
        )}
      </section>

      <div className="chambres__filtres">
        <FilterPillule
          libelle="Toutes"
          compteur={chambres.length}
          actif={filtre === 'tous'}
          onClick={() => setFiltre('tous')}
        />
        {Object.keys(STATUTS_CHAMBRE).map((statut) => (
          <FilterPillule
            key={statut}
            statut={statut}
            compteur={compter(statut)}
            actif={filtre === statut}
            onClick={() => setFiltre(filtre === statut ? 'tous' : statut)}
          />
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="chambres__vide">
          {chambres.length === 0
            ? 'Aucune chambre pour le moment. Ajoutez une catégorie, puis votre première chambre.'
            : 'Aucune chambre ne correspond à ce filtre.'}
        </p>
      ) : (
        etages.map((etage) => (
          <div className="chambres__etage" key={etage}>
            <h3 className="chambres__etage-titre">{libelleEtage(etage)}</h3>
            <div className="chambres__grille">
              {visibles
                .filter((c) => c.etage === etage)
                .map((c) => (
                  <CardRoom
                    key={c.id}
                    numero={c.numero}
                    statut={c.statut}
                    detail={typesParId[c.typeId]?.label}
                    onClick={() => {
                      setSelection(c)
                      setModale('statut')
                    }}
                  />
                ))}
            </div>
          </div>
        ))
      )}

      {/* ---------- Ajouter une chambre ---------- */}
      <Modal
        ouvert={modale === 'chambre'}
        onFermer={fermer}
        titre="Ajouter une chambre"
        libelleValider="Ajouter"
        onValider={creerChambre}
        chargement={chargement}
      >
        <Input
          label="Numéro"
          placeholder="Ex. 206"
          requis
          value={formChambre.numero}
          onChange={(e) => setFormChambre({ ...formChambre, numero: e.target.value })}
        />
        <Input
          label="Étage"
          type="number"
          min={0}
          requis
          value={formChambre.etage}
          onChange={(e) => setFormChambre({ ...formChambre, etage: e.target.value })}
          aide="0 pour le rez-de-chaussée."
        />
        <Input
          label="Catégorie"
          requis
          placeholder="Choisir une catégorie"
          value={formChambre.typeId}
          onChange={(e) => setFormChambre({ ...formChambre, typeId: e.target.value })}
          options={types.map((t) => ({
            valeur: String(t.id),
            libelle: `${t.label} · ${t.prix.toLocaleString('fr-FR')} XAF`
          }))}
        />
      </Modal>

      {/* ---------- Ajouter une catégorie ---------- */}
      <Modal
        ouvert={modale === 'categorie'}
        onFermer={fermer}
        titre={categorieSelectionnee ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
        description="Exemple : Standard, Suite, Familiale."
        libelleValider={categorieSelectionnee ? 'Enregistrer' : 'Ajouter'}
        onValider={enregistrerCategorie}
        chargement={chargement}
      >
        <Input
          label="Nom de la catégorie"
          placeholder="Ex. Standard"
          requis
          value={formCategorie.label}
          onChange={(e) => setFormCategorie({ ...formCategorie, label: e.target.value })}
        />
        <Input
          label="Prix par nuit (XAF)"
          type="number"
          min={0}
          requis
          placeholder="15000"
          value={formCategorie.prix}
          onChange={(e) => setFormCategorie({ ...formCategorie, prix: e.target.value })}
        />
        <Input
          label="Capacité (personnes)"
          type="number"
          min={1}
          requis
          placeholder="2"
          value={formCategorie.capacite}
          onChange={(e) => setFormCategorie({ ...formCategorie, capacite: e.target.value })}
        />
      </Modal>

      {/* ---------- Changer le statut ---------- */}
      <Modal
        ouvert={modale === 'statut'}
        onFermer={fermer}
        titre={`Chambre ${selection?.numero ?? ''}`}
        description={`Statut actuel : ${STATUTS_CHAMBRE[selection?.statut]?.libelle ?? '—'}`}
        pied={
          <Button variante="secondaire" onClick={fermer}>
            Fermer
          </Button>
        }
      >
        <div className="chambres__statuts">
          {Object.entries(STATUTS_CHAMBRE).map(([statut, infos]) => (
            <Button
              key={statut}
              variante={selection?.statut === statut ? 'principal' : 'secondaire'}
              icone={infos.icone}
              disabled={chargement}
              onClick={() => changerStatut(statut)}
            >
              {infos.libelle}
            </Button>
          ))}
        </div>
      </Modal>

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}