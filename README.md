# Hypnos

Logiciel de gestion hôtelière doublé d'un système de réservation en ligne, développé pour l'Hôtel Céleste (Mampassi, Brazzaville, République du Congo).

> Projet en phase d'étude / développement — usage interne, non destiné à la diffusion publique pour le moment.

## Présentation

Hypnos est composé de deux briques :

- **Backoffice (logiciel de bureau)** — installé à l'hôtel, utilisé par le personnel pour gérer les chambres, les réservations, le personnel et les notifications.
- **Site de réservation en ligne** — accessible à la clientèle de l'hôtel pour consulter les disponibilités et réserver directement, sans création de compte.

Le projet est porté par **Moukassa Vivien Louange** (initiateur, connaissance du terrain) et développé par **Plamedi Ebana**.

## Fonctionnalités (MVP)

- Gestion des chambres et de leur statut (disponible, occupée, maintenance)
- Gestion des catégories de chambres (types, tarifs, capacité)
- Gestion des réservations, de la demande en ligne à la confirmation par la réception
- Envoi automatique d'un email de confirmation au client
- Gestion du personnel et rattachement optionnel à un compte utilisateur
- Notifications internes (nouvelle réservation, changement de statut)
- Calcul automatique du montant d'une réservation

Fonctionnalités prévues pour une V2 : rôles et permissions différenciés, bilans financiers, gestion de la paie du personnel.

## Stack technique

- **Backoffice** : Electron (JavaScript / React), stockage local léger (electron-store ou micro-ORM)
- **API** : Django + Django REST Framework, architecture "API first"
- **Site de réservation** : consomme la même API, sans authentification côté client

## Structure du projet

```
hypnos/
├── backoffice/       # Application Electron (logiciel de bureau)
├── api/               # Backend Django REST Framework
├── site-reservation/  # Site web de réservation en ligne
└── docs/              # Cahier des charges, MCD, business plan
```

*(à ajuster selon l'organisation réelle des dossiers)*

## Installation

### API (Django)

```bash
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Backoffice (Electron)

```bash
cd backoffice
npm install
npm start
```

### Site de réservation

```bash
cd site-reservation
npm install
npm run dev
```

## Roadmap

1. **Étude** — conception fonctionnelle et technique (en cours)
2. **MVP** — développement de la première version fonctionnelle
3. **Test** — mise à l'épreuve en conditions réelles à l'Hôtel Céleste
4. **Vente** — mise en place de l'abonnement et démarrage commercial

## Équipe

- **Moukassa Vivien Louange** — initiateur du projet, terrain
- **Plamedi Ebana** — conception et développement

## Licence

Projet privé — tous droits réservés. Non destiné à la redistribution sans accord des auteurs.
