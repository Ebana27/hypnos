/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import Button from './base/Button'
import Input from './base/Input'
import PanneauMarque, { BarreFenetre } from './base/PanneauMarque'
import ProgressBar from './base/ProgressBar'
import injecterStyles from './base/injecterStyles'
import { DEVISE, formatArgent } from '../lib/reservations'

const ETAPES = [
  { titre: 'Votre établissement', aide: 'Comment s’appelle votre hôtel, et où se trouve-t-il ?' },
  { titre: 'Le bâtiment', aide: 'Indiquez les étages et les chambres : nous les créons pour vous.' },
  { titre: 'Tarifs et horaires', aide: 'Des valeurs de départ, modifiables à tout moment.' },
  { titre: 'Votre compte', aide: 'Vous serez l’administrateur de cet hôtel.' },
  { titre: 'Vérification', aide: 'Relisez avant de créer votre hôtel.' }
]
const DERNIERE = ETAPES.length - 1
const ETAGES_MAX = 30 // au-dessus du rez-de-chaussée
const CHAMBRES_MAX = 60 // par étage

const FORMULAIRE_VIDE = {
  nom: '',
  ville: '',
  adresse: '',
  tel: '',
  etagesHauts: 2,
  chambresParEtage: 5,
  chambresRez: 0, // rare : le rez-de-chaussée accueille la réception et les espaces communs
  tarif: '30000',
  arrivee: '15:00',
  depart: '11:00',
  prenom: '',
  nomFamille: '',
  email: '',
  motDePasse: '',
  confirmation: ''
}

const pluriel = (n, singulier, plur = `${singulier}s`) => `${n} ${n > 1 ? plur : singulier}`

// Les chambres sont numérotées de 1 à N sans interruption, en partant du niveau le plus bas.
const totalChambres = (f) => f.chambresRez + f.etagesHauts * f.chambresParEtage

// ============================================================
//  APERÇU DU BÂTIMENT (SVG, mis à l'échelle automatiquement)
// ============================================================
const CW = 26 // largeur d'une chambre
const FH = 34 // hauteur d'un étage
const MARGE = 14
const FEN_L = 16
const FEN_H = 18
const TOIT = 8
const SOL_Y = 216
const CENTRE_X = 180

function ApercuHotel({ nom, etagesHauts, chambresParEtage, chambresRez }) {
  const niveaux = etagesHauts + 1
  const total = chambresRez + etagesHauts * chambresParEtage
  const cellules = Math.max(chambresParEtage, chambresRez, 3)
  const largeur = cellules * CW + 2 * MARGE
  const hauteur = niveaux * FH
  const echelle = Math.min(300 / largeur, 140 / (hauteur + TOIT), 1.6)

  const propre = nom.trim()
  const nomAffiche = propre ? (propre.length > 24 ? `${propre.slice(0, 23)}…` : propre) : 'Votre hôtel'
  const largeurEnseigne = Math.min(300, Math.max(96, nomAffiche.length * 8 + 28))
  const enseigneY = Math.max(4, SOL_Y - (hauteur + TOIT) * echelle - 36)

  const liste = Array.from({ length: niveaux }, (_, i) => i)

  // Étages : une rangée de fenêtres centrée
  const decalage = ((cellules - chambresParEtage) * CW) / 2
  const pieces = Array.from({ length: chambresParEtage }, (_, j) => j)

  // Rez-de-chaussée : les fenêtres se placent de part et d'autre de la porte
  const cellulesRez = Array.from({ length: cellules }, (_, j) => j)
    .filter((j) => Math.abs(MARGE + j * CW + CW / 2 - largeur / 2) >= 20)
    .slice(0, chambresRez)

  return (
    <div className="apercu">
      <svg
        className="apercu__svg"
        viewBox="0 0 360 236"
        role="img"
        aria-label={`Aperçu du bâtiment : ${pluriel(niveaux, 'niveau', 'niveaux')}, ${pluriel(total, 'chambre')}`}
      >
        <rect x="24" y={SOL_Y} width="312" height="3" rx="1.5" className="apercu__sol" />

        <g
          className="apercu__batiment"
          style={{
            transform: `translate(${CENTRE_X}px, ${SOL_Y}px) scale(${echelle}) translate(${-largeur / 2}px, 0px)`
          }}
        >
          <rect x={-4} y={-hauteur - TOIT} width={largeur + 8} height={TOIT} rx={2} className="apercu__toit" />
          <rect x={0} y={-hauteur} width={largeur} height={hauteur} className="apercu__corps" />

          {liste.map((niveau) => (
            <g key={niveau} className="apercu__niveau">
              {niveau > 0 && (
                <line
                  x1={0}
                  x2={largeur}
                  y1={-niveau * FH}
                  y2={-niveau * FH}
                  className="apercu__separation"
                />
              )}

              {niveau === 0 && chambresRez === 0 && (
                <>
                  {/* Pas de chambres au rez-de-chaussée : deux vitrines de réception autour de la porte */}
                  <rect
                    x={MARGE}
                    y={-FH + 7}
                    width={largeur / 2 - 18 - MARGE}
                    height={FEN_H + 4}
                    rx={3}
                    className="apercu__vitrine"
                  />
                  <rect
                    x={largeur / 2 + 18}
                    y={-FH + 7}
                    width={largeur / 2 - 18 - MARGE}
                    height={FEN_H + 4}
                    rx={3}
                    className="apercu__vitrine"
                  />
                </>
              )}

              {niveau === 0 &&
                cellulesRez.map((j) => (
                  <rect
                    key={j}
                    x={MARGE + j * CW + (CW - FEN_L) / 2}
                    y={-FH + 8}
                    width={FEN_L}
                    height={FEN_H}
                    rx={3}
                    className="apercu__fenetre"
                  />
                ))}

              {niveau > 0 &&
                pieces.map((j) => (
                  <rect
                    key={j}
                    x={MARGE + decalage + j * CW + (CW - FEN_L) / 2}
                    y={-(niveau + 1) * FH + 8}
                    width={FEN_L}
                    height={FEN_H}
                    rx={3}
                    className="apercu__fenetre"
                  />
                ))}
            </g>
          ))}

          <rect x={largeur / 2 - 12} y={-30} width={24} height={30} rx={4} className="apercu__porte" />
        </g>

        <g
          className="apercu__enseigne"
          style={{ transform: `translate(${CENTRE_X - largeurEnseigne / 2}px, ${enseigneY}px)` }}
        >
          <rect width={largeurEnseigne} height={28} rx={8} />
          <text x={largeurEnseigne / 2} y={19} textAnchor="middle">
            {nomAffiche}
          </text>
        </g>
      </svg>
      <p className="apercu__legende">
        {pluriel(niveaux, 'niveau', 'niveaux')} · {pluriel(total, 'chambre')}
      </p>
    </div>
  )
}

// ============================================================
//  COMPTEUR − / +
// ============================================================
function Compteur({ label, valeur, min, max, onChange, aide, alerte }) {
  return (
    <div className="compteur">
      <span className="compteur__label">{label}</span>
      <div className="compteur__controles" role="group" aria-label={label}>
        <Button
          variante="secondaire"
          iconeSeule
          icone={Minus}
          aria-label={`Diminuer : ${label}`}
          disabled={valeur <= min}
          onClick={() => onChange(valeur - 1)}
        />
        <output className="compteur__valeur" aria-live="polite">
          {valeur}
        </output>
        <Button
          variante="secondaire"
          iconeSeule
          icone={Plus}
          aria-label={`Augmenter : ${label}`}
          disabled={valeur >= max}
          onClick={() => onChange(valeur + 1)}
        />
      </div>
      {alerte ? (
        <p className="compteur__alerte">{alerte}</p>
      ) : (
        aide && <p className="compteur__aide">{aide}</p>
      )}
    </div>
  )
}

// ============================================================
//  STYLE
// ============================================================
const STYLES = `
/* ---------- Aperçu du bâtiment ---------- */
.apercu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 0;
}
.apercu__svg {
  width: 100%;
  max-width: 360px;
  max-height: 100%;
}
.apercu__legende {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}
.apercu__batiment,
.apercu__enseigne {
  transition: transform 0.35s ease;
}
.apercu__sol {
  fill: color-mix(in srgb, var(--white) 35%, transparent);
}
.apercu__toit {
  fill: color-mix(in srgb, var(--white) 70%, transparent);
}
.apercu__corps {
  fill: color-mix(in srgb, var(--white) 94%, transparent);
}
.apercu__separation {
  stroke: color-mix(in srgb, var(--color-brand, var(--medium-blue)) 18%, transparent);
  stroke-width: 1;
}
.apercu__fenetre {
  fill: var(--color-brand, var(--medium-blue));
  animation: apercu-apparition 0.3s ease both;
}
.apercu__vitrine {
  fill: color-mix(in srgb, var(--soft-periwinkle) 55%, transparent);
  animation: apercu-apparition 0.3s ease both;
}
.apercu__porte {
  fill: var(--soft-periwinkle);
}
.apercu__niveau {
  animation: apercu-apparition 0.35s ease both;
}
.apercu__enseigne rect {
  fill: var(--color-brand-contrast, var(--white));
}
.apercu__enseigne text {
  fill: var(--color-brand, var(--medium-blue));
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
}
@keyframes apercu-apparition {
  from { opacity: 0; }
}

/* ---------- Assistant ---------- */
.wiz__etape {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
}
.wiz .progression {
  margin-bottom: 22px;
}
.wiz__titre {
  font-size: 30px;
}
.wiz__corps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: wiz-entree 0.25s ease both;
}
.wiz__duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wiz__note {
  font-size: 13px;
  color: var(--color-text-muted);
}
.wiz__erreur {
  min-height: 20px;
  margin: 12px 0 4px;
  font-size: 14px;
  color: var(--color-danger);
}
.wiz__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
@keyframes wiz-entree {
  from { opacity: 0; transform: translateX(12px); }
}

/* ---------- Compteurs ---------- */
.compteur {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
}
.compteur__label {
  font-size: 13px;
  font-weight: 500;
}
.compteur__controles {
  display: flex;
  align-items: center;
  gap: 16px;
}
.compteur__valeur {
  min-width: 3ch;
  text-align: center;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.compteur__aide,
.compteur__alerte {
  font-size: 12px;
}
.compteur__aide {
  color: var(--color-text-muted);
}
.compteur__alerte {
  color: var(--color-warning);
}

/* ---------- Vérification ---------- */
.recap {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}
.recap__ligne {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}
.recap__ligne:last-child {
  border-bottom: none;
}
.recap__titre {
  font-size: 12px;
  color: var(--color-text-muted);
}
.recap__valeur {
  font-size: 14px;
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .apercu__batiment, .apercu__enseigne { transition: none; }
  .apercu__fenetre, .apercu__vitrine, .apercu__niveau, .wiz__corps { animation: none; }
}
`

injecterStyles('hypnos-register', STYLES)

// ============================================================
//  VALIDATION PAR ÉTAPE
// ============================================================
function valider(etape, f) {
  const e = {}
  if (etape === 0) {
    if (!f.nom.trim()) e.nom = "Indiquez le nom de l'hôtel."
    if (!f.ville.trim()) e.ville = 'Indiquez la ville.'
  }
  if (etape === 1) {
    if (totalChambres(f) < 1) e.batiment = 'Prévoyez au moins une chambre.'
  }
  if (etape === 2) {
    if (!(Number(f.tarif) > 0)) e.tarif = 'Indiquez un tarif supérieur à 0.'
    if (!f.arrivee) e.arrivee = 'Indiquez une heure.'
    if (!f.depart) e.depart = 'Indiquez une heure.'
  }
  if (etape === 3) {
    if (!f.prenom.trim()) e.prenom = 'Indiquez votre prénom.'
    if (!f.nomFamille.trim()) e.nomFamille = 'Indiquez votre nom.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Adresse e-mail invalide.'
    if (f.motDePasse.length < 8) e.motDePasse = '8 caractères minimum.'
    if (f.confirmation !== f.motDePasse) e.confirmation = 'Les mots de passe ne correspondent pas.'
  }
  return e
}

// ============================================================
//  ASSISTANT DE CRÉATION
// ============================================================
export default function Register({ onTermine }) {
  const [etape, setEtape] = useState(0)
  const [form, setForm] = useState(FORMULAIRE_VIDE)
  const [erreurs, setErreurs] = useState({})
  const [erreurGlobale, setErreurGlobale] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const maj = (champ) => (e) => {
    const valeur = e.target.value
    setForm((f) => ({ ...f, [champ]: valeur }))
    setErreurs((x) => ({ ...x, [champ]: undefined }))
  }
  const regler = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))

  const niveaux = form.etagesHauts + 1
  const total = totalChambres(form)

  function continuer() {
    const e = valider(etape, form)
    setErreurs(e)
    if (Object.keys(e).length === 0) setEtape((n) => n + 1)
  }

  function retour() {
    setErreurs({})
    setErreurGlobale('')
    setEtape((n) => Math.max(0, n - 1))
  }

  async function creer() {
    for (const i of [0, 1, 2, 3]) {
      const e = valider(i, form)
      if (Object.keys(e).length > 0) {
        setErreurs(e)
        setEtape(i)
        return
      }
    }
    setEnvoi(true)
    setErreurGlobale('')
    try {
      await window.electronAPI.creerHotel({
        nom: form.nom,
        ville: form.ville,
        adresse: form.adresse,
        tel: form.tel,
        etagesHauts: form.etagesHauts,
        chambresParEtage: form.chambresParEtage,
        chambresRez: form.chambresRez,
        tarif: Number(form.tarif),
        arrivee: form.arrivee,
        depart: form.depart,
        prenom: form.prenom,
        nomFamille: form.nomFamille,
        email: form.email,
        motDePasse: form.motDePasse
      })
      onTermine() // la fenêtre se ferme, on garde l'indicateur
    } catch (err) {
      setErreurGlobale(err.message)
      setEnvoi(false)
    }
  }

  function soumettre(e) {
    e.preventDefault()
    if (envoi) return
    if (etape === DERNIERE) creer()
    else continuer()
  }

  const alerteEtages = form.etagesHauts > 10 ? 'Plus de 10 étages : vérifiez ce nombre.' : ''
  const alerteChambres =
    form.chambresParEtage > 30 ? 'Plus de 30 chambres par étage : vérifiez ce nombre.' : ''

  const recap = [
    {
      etape: 0,
      titre: 'Établissement',
      valeur: [form.nom.trim(), form.ville.trim(), form.adresse.trim()].filter(Boolean).join(' · ')
    },
    {
      etape: 1,
      titre: 'Bâtiment',
      valeur: `${pluriel(niveaux, 'niveau', 'niveaux')} · ${pluriel(total, 'chambre')} (n° 1 à ${total})${
        form.chambresRez > 0 ? ` · dont ${form.chambresRez} au rez-de-chaussée` : ''
      }`
    },
    {
      etape: 2,
      titre: 'Tarifs et horaires',
      valeur: `${formatArgent(Number(form.tarif) || 0)} ${DEVISE} par nuit · arrivée ${form.arrivee} · départ ${form.depart}`
    },
    {
      etape: 3,
      titre: 'Compte',
      valeur: `${form.prenom.trim()} ${form.nomFamille.trim()} · ${form.email.trim()}`
    }
  ]

  function corps() {
    if (etape === 0) {
      return (
        <>
          <Input
            label="Nom de l’hôtel"
            requis
            autoFocus
            placeholder="Ex. Hôtel Le Céleste"
            value={form.nom}
            onChange={maj('nom')}
            erreur={erreurs.nom}
          />
          <Input
            label="Ville"
            requis
            placeholder="Ex. Brazzaville"
            value={form.ville}
            onChange={maj('ville')}
            erreur={erreurs.ville}
          />
          <div className="wiz__duo">
            <Input label="Adresse" placeholder="Facultatif" value={form.adresse} onChange={maj('adresse')} />
            <Input label="Téléphone" placeholder="+242 …" value={form.tel} onChange={maj('tel')} />
          </div>
          <p className="wiz__note">L’adresse et le téléphone serviront sur vos factures. Vous pourrez les ajouter plus tard.</p>
        </>
      )
    }

    if (etape === 1) {
      return (
        <>
          <Compteur
            label="Étages avec chambres"
            valeur={form.etagesHauts}
            min={form.chambresRez === 0 ? 1 : 0}
            max={ETAGES_MAX}
            onChange={(v) => regler('etagesHauts', v)}
            aide={
              form.etagesHauts === 0
                ? 'Aucun étage : rez-de-chaussée uniquement.'
                : form.etagesHauts === 1
                  ? '1er étage.'
                  : `Du 1er au ${form.etagesHauts}e étage.`
            }
            alerte={alerteEtages}
          />
          <Compteur
            label="Chambres par étage"
            valeur={form.chambresParEtage}
            min={1}
            max={CHAMBRES_MAX}
            onChange={(v) => regler('chambresParEtage', v)}
            aide="Le même nombre à chaque étage : vous ajusterez ensuite dans l’onglet Chambres."
            alerte={alerteChambres}
          />
          <Compteur
            label="Chambres au rez-de-chaussée"
            valeur={form.chambresRez}
            min={0}
            max={CHAMBRES_MAX}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                chambresRez: v,
                // Sans chambre au rez-de-chaussée, il faut au moins un étage
                etagesHauts: v === 0 ? Math.max(1, f.etagesHauts) : f.etagesHauts
              }))
            }
            aide="Rare : le rez-de-chaussée accueille en général la réception et les espaces communs, pour préserver l’intimité des clients."
          />
          {erreurs.batiment && (
            <p className="compteur__alerte" role="alert">
              {erreurs.batiment}
            </p>
          )}
          <p className="wiz__note">
            {pluriel(total, 'chambre')} seront créées, numérotées de 1 à {total}.
          </p>
        </>
      )
    }

    if (etape === 2) {
      return (
        <>
          <Input
            label={`Tarif moyen par nuit (${DEVISE})`}
            type="number"
            min={0}
            step={500}
            requis
            autoFocus
            value={form.tarif}
            onChange={maj('tarif')}
            erreur={erreurs.tarif}
            aide={`${formatArgent(Number(form.tarif) || 0)} ${DEVISE} par nuit`}
          />
          <div className="wiz__duo">
            <Input
              label="Heure d’arrivée"
              type="time"
              value={form.arrivee}
              onChange={maj('arrivee')}
              erreur={erreurs.arrivee}
            />
            <Input
              label="Heure de départ"
              type="time"
              value={form.depart}
              onChange={maj('depart')}
              erreur={erreurs.depart}
            />
          </div>
          <p className="wiz__note">
            Une catégorie « Standard » sera créée à ce tarif pour toutes vos chambres. Vous pourrez en
            ajouter d’autres ensuite.
          </p>
        </>
      )
    }

    if (etape === 3) {
      return (
        <>
          <div className="wiz__duo">
            <Input
              label="Prénom"
              requis
              autoFocus
              value={form.prenom}
              onChange={maj('prenom')}
              erreur={erreurs.prenom}
            />
            <Input
              label="Nom"
              requis
              value={form.nomFamille}
              onChange={maj('nomFamille')}
              erreur={erreurs.nomFamille}
            />
          </div>
          <Input
            label="Adresse e-mail"
            requis
            placeholder="vous@hotel.cg"
            autoComplete="username"
            value={form.email}
            onChange={maj('email')}
            erreur={erreurs.email}
          />
          <Input
            label="Mot de passe"
            type="password"
            requis
            autoComplete="new-password"
            value={form.motDePasse}
            onChange={maj('motDePasse')}
            erreur={erreurs.motDePasse}
            aide="8 caractères minimum."
          />
          <Input
            label="Confirmation"
            type="password"
            requis
            autoComplete="new-password"
            value={form.confirmation}
            onChange={maj('confirmation')}
            erreur={erreurs.confirmation}
          />
        </>
      )
    }

    return (
      <>
        <div className="recap">
          {recap.map((ligne) => (
            <div className="recap__ligne" key={ligne.etape}>
              <div>
                <p className="recap__titre">{ligne.titre}</p>
                <p className="recap__valeur">{ligne.valeur}</p>
              </div>
              <Button variante="lien" taille="s" onClick={() => setEtape(ligne.etape)}>
                Modifier
              </Button>
            </div>
          ))}
        </div>
        <p className="wiz__note">
          Tout est enregistré sur cet ordinateur, sans connexion internet. Vous pourrez modifier les
          chambres et les tarifs ensuite.
        </p>
      </>
    )
  }

  return (
    <div className="auth">
      <PanneauMarque
        compact
        titre="Créez votre hôtel en 2 minutes."
        texte="Renseignez votre établissement et votre compte administrateur : vos chambres sont générées pour vous."
      >
        <ApercuHotel
          nom={form.nom}
          etagesHauts={form.etagesHauts}
          chambresParEtage={form.chambresParEtage}
          chambresRez={form.chambresRez}
        />
      </PanneauMarque>

      <main className="auth__principal">
        <form className="auth__formulaire wiz" onSubmit={soumettre} noValidate>
          <p className="wiz__etape">
            Étape {etape + 1} sur {ETAPES.length}
          </p>
          <ProgressBar
            valeur={((etape + 1) / ETAPES.length) * 100}
            libelle="Progression de la création de l’hôtel"
          />
          <h1 className="auth__titre wiz__titre">{ETAPES[etape].titre}</h1>
          <p className="auth__sous-titre">{ETAPES[etape].aide}</p>

          <div className="wiz__corps" key={etape}>
            {corps()}
          </div>

          <p className="wiz__erreur" role="alert">
            {erreurGlobale}
          </p>

          <div className="wiz__actions">
            {etape > 0 ? (
              <Button variante="secondaire" className="auth__bouton" onClick={retour} disabled={envoi}>
                Retour
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" className="auth__bouton" chargement={envoi}>
              {etape === DERNIERE ? 'Créer mon hôtel' : 'Continuer'}
            </Button>
          </div>
        </form>
      </main>

      <BarreFenetre />
    </div>
  )
}