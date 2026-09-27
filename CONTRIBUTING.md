# Workflow de developpement Hypnos (monorepo)

## Le principe : une seule branche de travail

Ce projet contient **trois applications dans un seul depot** :

| Dossier                | Application            | Branche de deploiement |
| ---------------------- | ---------------------- | ---------------------- |
| `backend/api`          | API Django (REST)      | `main`                 |
| `frontend/website/site`| Site vitrine (React)   | `main`                 |
| `frontend/desktop/hypnos` | App Electron         | `main`                 |

**Il n'existe pas de branche `api`, `website` ou `desktop`.** Ce serait la
source du probleme qui t'inquiete : ces trois branches ne contiendraient
qu'une partie du depot, et les fusionner entre elles provoquerait des
conflits sur la totalite des fichiers, parce que chacune a ete creee a
partir de `main` et non de l'etat courant du projet.

Le depot est un **monorepo** : tout le monde travaille sur le meme
historique, et la separation se fait au moment du **build**, pas au moment
du **merge**. C'est exactement ce que font les filtres `paths:` des
workflows GitHub Actions.

## Les branches qui existent

```
main       <- production. Protégée, jamais de push direct.
  |
develop    <- intégration. Les tests tournent ici en continu.
  |
feature/*  <- une branche courte par tâche, supprimée après le merge.
```

## Le cycle de travail

```bash
# 1. On part de develop, jamais de main.
git switch develop
git pull

# 2. On crée une branche pour UNE tâche.
git switch -c feature/api-reservation-endpoints

# 3. On travaille, on commit souvent.
git add .
git commit -m "feat(api): ajoute les endpoints de réservation"

# 4. On pousse la branche.
git push -u origin feature/api-reservation-endpoints

# 5. On ouvre une Pull Request vers develop sur GitHub.
#    La CI se lance automatiquement et la branche est protégée :
#    impossible de merger si les checks sont rouges.

# 6. Après merge, la branche est supprimée automatiquement.
git switch develop
git pull
git branch -d feature/api-reservation-endpoints
```

## Pourquoi `develop` ne "melange" pas les fichiers

Quand tu fusionnes `feature/api-reservation-endpoints` dans `develop`,
Git applique un **diff**, fichier par fichier. Il ne remplace jamais un
dossier par un autre. Concretement :

- la branche ne contient que `backend/api/**` de modifie
- `frontend/website/site/**` est copie tel quel, sans conflit possible
- un conflit ne peut survenir que si **deux personnes ont modifie le meme
  fichier du meme dossier**, ce qui est le comportement voulu

## Repartir de la a

```bash
git checkout main
git merge develop      # develop devient la source de main
git push
```

## Le passage en production, quand tu seras pret

Quand l'API Django sera déployee quelque part (Railway, Render, Fly.io,
un VPS) et que le site web sera heberge (Vercel, Netlify, Cloudflare
Pages), le deploiement n'a pas besoin d'une branche par application :

- Railway / Render / Fly.io : connexion directe au depot GitHub, avec la
  commande `python manage.py migrate && gunicorn config.wsgi:application`.
  Le deploiement se fait au push sur `main`, automatiquement.
- Vercel / Netlify / Cloudflare Pages : idem, le site est construit a
  chaque push sur `main`. Ces services lisent `frontend/website/site`
  comme racine de projet, il n'y a rien a ecrire.
- L'app desktop : deja gere par `.github/workflows/release-desktop.yml`,
  sur publication d'un tag `v1.0.0`.

Tant que ces services ne sont pas configures, aucun workflow de
deploiement n'est necessaire : les workflows presents ne font que
verifier que le code est sain.
