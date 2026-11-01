# API Hypnos — guide d'utilisation (JavaScript)

Ce document est la référence pour consommer l'API Django depuis un client
JavaScript : le site public, et l'application Electron.

Il est écrit à la main, donc **l'API reste la source de vérité** : en cas de
désaccord entre ce fichier et une réponse réelle du serveur, c'est la réponse
qui gagne.

- Base : `http://localhost:8000` en développement
- Préfixe de toute l'API : `/api/`
- Authentification : `Authorization: Bearer <access>`

---

## 1. Cinq conventions à connaître avant d'écrire la première requête

### 1.1 La barre finale est obligatoire

```js
// BON
await fetch(`${API}/api/hotels/`)
// MAUVAIS -> 301, et le corps JSON est perdu
await fetch(`${API}/api/hotels`)
```

Sur un `POST`, le `301` fait rejouer la requête en `GET` : le corps est
perdu et la création n'a pas lieu. Ce symptôme est trompeur.

### 1.2 Les listes ne sont pas des tableaux

`PAGE_SIZE = 50` avec une pagination par numéro de page. Toute liste répond :

```json
{ "count": 128, "next": "http://.../?page=2", "previous": null, "results": [ ... ] }
```

```js
const reponse = await fetch(url, options)
const { results } = await reponse.json()   // <- .results, pas le tableau direct
```

### 1.3 Les dates : une date seule suffit

`date_debut` et `date_fin` sont des **instants**. Deux écritures acceptées :

| Envoyer | Signifie |
|---|---|
| `"2026-10-01"` | arrivée à l'heure d'arrivée de l'hôtel (15 h par défaut) |
| `"2026-10-01T22:30:00+00:00"` | arrivée à 22 h 30 exactement |

Une heure explicite **prime toujours** sur l'heure de l'hôtel. Un client qui
demande explicitement une arrivée tardive est conservé tel quel.

En réponse, les dates reviennent toujours en ISO 8601 avec l'offset :
`"2026-10-01T15:00:00+00:00"`.

### 1.4 Le client ne décide jamais seul

`statut`, `date_decision` et `motif_refus` sont présents dans les réponses
mais **ignorés** s'ils sont envoyés sur une demande. Le serveur les renseigne
lui-même. Un client HTTP qui tente de s'auto-accorder reçoit `201`, puis
constate que la demande est restée `en_attente`.

C'est volontaire : seule la route de synchronisation décide.

### 1.5 Les erreurs sont du JSON, pas des pages HTML

Sous `/api/`, une erreur est toujours du JSON :

```json
{ "detail": "Authentification requise." }
{ "email": ["Cette adresse est déjà utilisée."] }
```

`400` validation · `401` non authentifié ou compte bloqué · `403` droit
insuffisant · `404` inexistant **ou appartenant à un autre hôtel** · `409`
conflit d'état · `429` quota dépassé.

Un `404` sur un objet existant mais d'un autre hôtel est **voulu** : on ne
confirme pas son existence à quelqu'un qui n'a pas le droit de le voir.

---

## 2. L'ordre des appels

Ce n'est **pas** « il faut d'abord créer un utilisateur ». Il y a deux points
d'entrée distincts, selon que la base est neuve ou déjà installée.

```
Base neuve                                Base déjà installée
─────────────                             ──────────────────────
BOOTSTRAP_TOKEN défini ?      ── non ──▶  ┌─────────────────────┐
        │ oui                              │ 0. POST /api/token/ │
        ▼                                  └─────────────────────┘
0. POST /api/users/   (propriétaire)              │
   + X-Bootstrap-Token                           │
        │                                        │
        ├──────────┬───────────────┐              │
        ▼          ▼               ▼              │
   1. /api/token/ 2. /api/hotels/  6. /api/demandes/  (public, sans jeton)
                    │
        ┌───────────┼───────────────┐
        ▼           ▼               ▼
  3. types-   4. chambres/    5. /api/users/
     chambre        (agents)
        │           │
        └─────┬─────┘
              ▼
   7. GET /api/sync/demandes/      (file d'attente)
              │
              ▼
   8. POST /api/sync/demandes/<num>/valider/
              │
              ▼
        crée la réservation
```

| # | Appel | Précondition |
|---|---|---|
| 0 | `POST /api/users/` + `X-Bootstrap-Token` | `BOOTSTRAP_TOKEN` défini **et** table des comptes **vide**. Une seule fois, à l'installation. |
| 1 | `POST /api/token/` | un compte existe |
| 2 | `POST /api/hotels/` | jeton propriétaire |
| 3 | `POST /api/types-chambre/` | hôtel créé |
| 4 | `POST /api/chambres/` | types de chambre créés |
| 5 | `POST /api/users/` | hôtel créé ; `role` réservé au propriétaire |
| 6 | `POST /api/demandes/` | **aucune** — public, sans jeton |
| 7 | `GET /api/sync/demandes/` | compte qui traite les demandes |
| 8 | `POST /api/sync/demandes/<num>/valider/` | demande `en_attente` |

### Les trois dépendances invisibles

Elles ne sont dans aucun code : ce sont des contraintes de clé étrangère, et
ellesaparaisent uniquement à l'exécution.

1. **Un compte a besoin d'un hôtel** — sauf s'il est superadmin. Créer un
   compte avant l'hôtel renvoie `400`.
2. **Une chambre a besoin d'un type de chambre.** Créer la chambre 101 avant
   le type `Double` renvoie `400`.
3. **`/api/token/` est un endpoint de connexion, pas de création.** Il
   exige un compte déjà existant et ne rend aucun jeton sur un POST de
   création.

C'est pour ça que l'étape 0 existe : sur une base neuve, aucun compte n'a
encore de jeton, donc `/api/token/` ne peut pas être la première requête.

### La porte de l'étape 0

Elle s'ouvre **uniquement** si les deux conditions sont réunies :

- `BOOTSTRAP_TOKEN` est défini dans l'environnement Django ;
- la table des comptes est vide.

Dès qu'un compte existe, `POST /api/users/` redevient une route API ordinaire
et renvoie `401` sans jeton. Le rôle ne se choisit plus dans la requête : il
est fixé par le serveur.

```bash
# Vérifier que le jeton est défini (sinon 403, quelle que soit la base)
python manage.py shell -c "from django.conf import settings; print(bool(settings.BOOTSTRAP_TOKEN))"
```

---

## 3. Qui peut faire quoi

| Compte | Lit | Écrit | Bloque un compte |
|---|---|---|---|
| superadmin (sans hôtel) | tout, partout | tout, partout | n'importe qui |
| `manager` (son hôtel) | son hôtel | son hôtel | les comptes de son hôtel |
| `admin` (son hôtel) | son hôtel | **rien** | les comptes de son hôtel |
| `receptionniste` (son hôtel) | son hôtel | **rien** | non |

Un compte write always borné à son hôtel : un `manager` de l'hôtel A ne peut
ni lire ni modifier une donnée de l'hôtel B.

Bloquer un compte (`is_active = false`) est **immédiat** : le serveur refuse
un compte inactif dès l'authentification, donc un jeton déjà obtenu avant le
blocage ne donne plus rien. Suspendre ne supprime pas : les réservations et
les décisions restent rattachées au compte.

---

## 4. Référence

`?` = obligatoire · `ro` = lecture seule, ignoré en écriture

### Comptes — `/api/users/`

`id_user` · `username` · `email` · `password` (écriture) · `role` · `hotel`
(read-only) · `is_active` (ro)

| Méthode | Route | Note |
|---|---|---|
| `GET` | `/api/users/` | filtré sur son hôtel |
| `POST` | `/api/users/` | `hotel` obligatoire ; `role` réservé au superadmin |
| `PATCH` | `/api/users/<id_user>/` | |
| `POST` | `/api/users/<id_user>/bloquer/` | |
| `POST` | `/api/users/<id_user>/reactiver/` | |

`role` : `admin` · `manager` · `receptionniste` (défaut).

Un compte `manager` peut créer un agent pour **son** hôtel ; `role` lui reste
indisponible, l'agent créé est donc un `receptionniste`. Seuls le propriétaire
et un `admin` peuvent suspendre un compte.

### Hôtels — `/api/hotels/`

`hotel_id` · `nom` · `adresse` · `ville` · `tel` · `email` ·
`nombre_etages` ? · `nombre_chambres` ? · `heure_arrivee` ? ·
`heure_depart` ?

`heure_arrivee` / `heure_depart` pilotent la conversion des dates seules
(§ 1.3). Par défaut `15:00` / `11:00`.

### Types de chambre — `/api/types-chambre/`

`id_type` · `label` · `prix` · `capacite`

### Chambres — `/api/chambres/`

`id_chambre` · `hotel` ? · `type_chambre` ? · `numero` ? · `etage` ? ·
`statut`

`statut` : `disponible` (défaut) · `occupee` · `maintenance`

`etage` ne peut pas dépasser `nombre_etages` de l'hôtel.

### Personnel — `/api/personnels/`

`matricule` · `user` · `sexe` · `poste`

### Clients — `/api/clients/`

`id_client` · `nom` · `prenom` · `tel` · `email` · `document` · `preference`
· `sexe` · `loyalty`

`sexe` : `M` · `F`

### Demandes — `/api/demandes/`

`num` · `hotel` ? · `client` ? · `chambre_demandee` · `date_debut` ? ·
`date_fin` ? · `nombreDePersonne` ? · `statut` (ro) · `date_decision` (ro)
· `motif_refus` (ro) · `created_at` (ro) · `updated_at` (ro)

`statut` : `en_attente` (défaut) · `acceptee` · `refusee`

`POST /api/demandes/` est **public** : pas de jeton, quota **20 requêtes par
heure et par IP**. Le champ `client` accepte deux formes :

```jsonc
// ses coordonnées -> la fiche client est créée dans la même requête
{ "nom": "Martin", "prenom": "Lucie", "email": "lucie@exemple.dev",
  "tel": "0600000000", "sexe": "F" }

// ou l'identifiant d'une fiche existante
{ "id": 42 }
```

La lecture, elle, reste réservée aux comptes.

### Réservations — `/api/reservations/`

`num` · `hotel` ? · `client` ? · `chambre` ? · `demande` · `date_debut` ? ·
`date_fin` ? · `nombreDePersonne` ? · `statut`

`statut` : `confirmee` (défaut) · `terminee` · `annulee`

Une chambre déjà prise sur la période renvoie `400`, avec un message qui dit
précisément ce qui coince.

### Synchronisation — `/api/sync/demandes/`

Trois routes, réservées au compte qui traite les demandes.

#### `GET /api/sync/demandes/`

File d'attente de l'hôtel, de la plus proche dans le temps. Répond un
**tableau** (pas de pagination : une file d'attente est courte).

| Paramètre | Rôle |
|---|---|
| `?depuis=` | ISO 8601, ne renvoie que les demandes modifiées après cet instant |
| `?hotel=<id>` | **obligatoire pour un superadmin**, sinon `400` |

Écrire le suffixe `Z` plutôt que `+00:00` : dans une chaîne de requête HTTP,
`+` signifie un espace, donc `...?depuis=2026-10-01T15:00:00+00:00` arrive
cassé chez le serveur.

#### `GET /api/sync/demandes/<num>/propositions/`

Trois chambres libres, les moins chères d'abord. La forme de la réponse est
**toujours** la même, chambre demandée libre ou non :

```jsonc
{
  "detail": null,          // ou "La chambre demandée est encore libre."
  "propositions": [        // [] dans ce cas
    {
      "chambre": { "id_chambre": 12, "numero": "104", /* ... */ },
      "type_label": "Double",
      "capacite": 2,
      "prix": "60.00",     // le prix est sur le TYPE, pas sur la chambre
      "est_equivalente": true
    }
  ]
}
```

#### `POST /api/sync/demandes/<num>/valider/`

Deux formes **exclusives** :

```jsonc
{ "chambre": 12 }                            // accepte
{ "refusee": true, "motif": "Complet" }      // refuse
```

N'envoyer ni l'un ni l'autre est une erreur `400` : ne rien transmettre ne
valide rien. Réponse :

```jsonc
{
  "demande": { "statut": "acceptee", "date_decision": "...", /* ... */ },
  "reservation": { "num": 3 }     // null si refusée
}
```

Le refus ne bloque aucune chambre. La réponse `409` signale une demande qui
a déjà reçu une réponse ; la chambre peut devenir occupée entre les
propositions et la décision, auquel cas c'est un `400` et rien n'est écrit.

### Notifications — `/api/notifications/`

`id_notif` · `user` · `title` · `detail` · `action` · `lu` (booléen, `false`
par défaut) · `created_at` (ro)

Trié de la plus récente à la plus ancienne. Une notification est supprimée
avec le compte qui la reçoit.

### Jetons — `/api/token/`

| Route | Rôle |
|---|---|
| `POST /api/token/` | `{"username", "password"}` → `{"access", "refresh"}` |
| `POST /api/token/refresh/` | `{"refresh"}` → `{"access"}` |
| `POST /api/token/verify/` | `{"access"}` → `{}` si valide |

L'identifiant est `username`. Envoyer `email` renvoie `400`.

---

## 5. Exemples

### 5.1 Un client minimal en `fetch`

```js
const API = 'http://localhost:8000'

export async function api(chemin, { methode = 'GET', corps, jeton } = {}) {
  const reponse = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  })

  const donnees = await reponse.json()
  if (!reponse.ok) {
    const detail = donnees.detail
      ?? Object.entries(donnees).map(([champ, msg]) => `${champ}: ${msg}`).join(' ')
    throw new Error(`${reponse.status} — ${detail}`)
  }
  return donnees
}
```

Une seule fonction, deux usages :

```js
const { results } = await api('/api/hotels/', { jeton: access })          // GET
const { hotel_id } = await api('/api/hotels/', {                            // POST
  methode: 'POST',
  jeton: access,
  corps: { nom: 'Hôtel Ebanapla', ville: 'Lomé', /* ... */ },
})
```

### 5.2 Le même en axios

```js
import axios from 'axios'

export const api = axios.create({ baseURL: 'http://localhost:8000' })

// Un 400 de validation doit lever une exception comme les autres : sans cela
// axios résout la promesse, et le bug n'apparaît qu'à l'étape suivante —
// souvent bien plus loin.
api.interceptors.response.use((reponse) => reponse, (erreur) => {
  const { status, data } = erreur.response ?? {}
  const detail = data?.detail ?? JSON.stringify(data)
  throw new Error(`${status} — ${detail}`)
})

// Le jeton est stocké à un seul endroit : après un refresh, il n'y a qu'une
// variable à mettre à jour.
let jeton = null
api.interceptors.request.use((config) => {
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`
  return config
})

export function definirJeton(valeur) { jeton = valeur }
```

| | fetch | axios |
|---|---|---|
| lire une liste | `(await api(...)).results` | `(await api.get(...)).data.results` |
| lire un objet | `await api(...)` | `(await api.get(...)).data` |
| créer | `api(url, { methode: 'POST', corps })` | `api.post(url, corps)` |
| réponse vide | `await api(url, { methode: 'POST', corps })` | `(await api.post(...)).data` |

### 5.3 Connexion

```js
// fetch
const { access } = await api('/api/token/', {
  methode: 'POST',
  corps: { username: 'proprietaire', password: 'MotDePasse123!' },
})

// axios
const { data: { access } } = await api.post('/api/token/', {
  username: 'proprietaire',
  password: 'MotDePasse123!',
})
```

### 5.4 Premier compte (installation uniquement)

L'en-tête `X-Bootstrap-Token` est obligatoire. Il ne peut pas passer par le
helper `api()` de § 5.1, qui ne gère pas les en-têtes personnalisés.

```js
// fetch
await fetch(`${API}/api/users/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bootstrap-Token': import.meta.env.VITE_BOOTSTRAP_TOKEN,
  },
  body: JSON.stringify({
    username: 'proprietaire',
    email: 'p@hypnos.dev',
    password: 'MotDePasse123!',
  }),
})

// axios
await api.post(
  '/api/users/',
  { username: 'proprietaire', email: 'p@hypnos.dev', password: 'MotDePasse123!' },
  { headers: { 'X-Bootstrap-Token': import.meta.env.VITE_BOOTSTRAP_TOKEN } },
)
```

### 5.5 Demande publique (site, sans jeton)

```js
// fetch
const { num } = await api('/api/demandes/', {
  methode: 'POST',
  corps: {
    hotel: 1,
    date_debut: '2026-10-01',        // -> 15 h 00
    date_fin: '2026-10-05',           // -> 11 h 00
    nombreDePersonne: 2,
    chambre_demandee: 12,
    client: {
      nom: 'Martin', prenom: 'Lucie',
      email: 'lucie@exemple.dev', tel: '0600000000', sexe: 'F',
    },
  },
})

// axios
const { data: { num } } = await api.post('/api/demandes/', { /* ... idem ... */ })
```

### 5.6 Traiter une demande (logiciel de l'agent)

```js
// File d'attente : un TABLEAU, pas { results }
const file = await api('/api/sync/demandes/', { jeton: access })

for (const demande of file) {
  const { propositions } = await api(
    `/api/sync/demandes/${demande.num}/propositions/`, { jeton: access },
  )

  const chambre = propositions.length ? propositions[0].chambre.id_chambre : null
  await api(`/api/sync/demandes/${demande.num}/valider/`, {
    methode: 'POST',
    jeton: access,
    corps: chambre
      ? { chambre }
      : { refusee: true, motif: 'Aucune chambre disponible sur la période' },
  })
}
```

### 5.7 Rafraîchir un jeton expiré

```js
async function rafraichir() {
  const { access } = await api('/api/token/refresh/', {
    methode: 'POST',
    corps: { refresh: refreshToken },
  })
  return access
}
```

---

## 6. Limites connues

À connaître avant de construire dessus. Aucune n'est un bug de client.

1. **`/api/clients/` et `/api/types-chambre/` sont globaux.** Ces deux
   ressources n'appartiennent à aucun hôtel dans le modèle, donc tout compte
   authentifié voit **tous** les clients. Sur une installation multi-hôtels,
   filtrer côté client est obligatoire tant que le modèle n'a pas changé.

2. **Le prix est porté par le type de chambre**, pas par la chambre. Deux
   chambres du même type ont le même prix. Le tri des propositions se fait
   donc sur `type_chambre.prix`.

3. **Les propositions sont figées au moment de la lecture.** La chambre peut
   être prise entre l'appel et la décision. Le serveur revalide et répond
   `400` — il faut gérer ce cas, pas supposer que la liste tient.

4. **`?depuis=` n'a pas d'offset maximal.** Le curseur est un horodatage ;
   s'y accumulent des demandes, il faut les traiter toutes avant de passer à
   la page suivante.

5. **Le quota anonyme est de 20 requêtes par heure et par IP**, pas par
   utilisateur. Derrière un proxy mutualisé, plusieurs visiteurs peuvent se
   partager le quota.