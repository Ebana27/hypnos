# KPay-NOW dans le backend Hypnos

Cette intégration expose l’initialisation des paiements KPay, le callback signé et la consultation du statut. Elle accepte le paiement Mobile Money USSD (`MTN_MOMO_COG`, `AIRTEL_COG`) et la page Gateway, y compris le parcours Visa/Mastercard. Aucun paiement n’a été lancé pendant le développement; les tests Django remplacent l’API KPay par des réponses simulées.

## Configuration sandbox

Dans `backend/api`, copiez `.env.example` vers `.env`, puis renseignez uniquement les identifiants `kpay_test_…` du dashboard KPay. Ne mettez pas les secrets dans Git ni dans le frontend. Gardez `KPAY_ALLOW_LIVE_PAYMENTS=0`. L’API officielle est `https://admin.kpay.site`.

```dotenv
KPAY_API_KEY=kpay_test_…
KPAY_SECRET_KEY=…
KPAY_WEBHOOK_SECRET=…
KPAY_GATEWAY_SECRET=…
KPAY_BASE_URL=https://admin.kpay.site
KPAY_PUBLIC_BASE_URL=https://api.votre-domaine.tld
KPAY_ALLOW_LIVE_PAYMENTS=0
```

`KPAY_PUBLIC_BASE_URL` doit être l’origine HTTPS publique de l’API Hypnos, sans chemin, requête ni fragment. Elle sert à générer le retour du checkout. Dans le dashboard KPay, configurez le callback des dépôts vers :

```text
https://api.votre-domaine.tld/api/payments/kpay/webhook/
```

Copiez le secret HMAC du webhook dans `KPAY_WEBHOOK_SECRET`. Le secret de signature du retour Gateway est distinct et doit aller dans `KPAY_GATEWAY_SECRET`. Si votre compte KPay ne fournit pas ces secrets séparément ou les nomme autrement, utilisez les valeurs exactes du dashboard KPay, sans réutiliser la clé API. Le serveur doit être accessible publiquement en HTTPS pour recevoir les callbacks; `localhost` ne suffit pas.

## Routes ajoutées

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| `POST` | `/api/payments/kpay/init/` | JWT requis | Créer le paiement KPay et renvoyer son statut/lien Gateway |
| `POST` | `/api/payments/kpay/webhook/` | Public, HMAC obligatoire | Recevoir les événements finaux KPay, idempotemment |
| `GET` | `/api/payments/kpay/return/` | Public, signature Gateway obligatoire | Vérifier le retour navigateur sans modifier le statut local |
| `GET` | `/api/payments/kpay/status/<externalId>/` | JWT requis, limité à l’hôtel | Lire le statut local et tenter une actualisation côté KPay |

L’endpoint d’initialisation ne renvoie pas de lien Gateway si KPay n’a pas confirmé `isTest=true` avec une clé sandbox. Les clés `kpay_live_…` sont refusées sauf activation explicite `KPAY_ALLOW_LIVE_PAYMENTS=1`; ne changez pas ce réglage pour les essais.

## Essai du checkout carte en sandbox

Obtenez d’abord un JWT Hypnos via `/api/token/`, puis envoyez une initiation Gateway. L’exemple ne contacte l’API de paiement que si les clés sandbox sont configurées :

```bash
curl -X POST "$API_URL/api/payments/kpay/init/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "GATEWAY",
    "paymentMethod": "CARD",
    "amount": 1000,
    "currency": "XAF",
    "externalId": "hypnos-card-test-001",
    "description": "Réservation sandbox"
  }'
```

La réponse comprend `gatewayUrl`; ouvrez-la dans le navigateur pour faire le parcours hébergé. Les cartes de test indiquées par KPay sont Visa `4242 4242 4242 4242` et Mastercard `5555 5555 5555 4444`, avec une date d’expiration future et un CVC de trois chiffres. Elles ne sont utilisables que dans le parcours sandbox du fournisseur.

## Essai Mobile Money

Pour un pay-in direct, remplacez le provider et le numéro par des données de test officiellement fournies par KPay pour le Congo-Brazzaville :

```json
{
  "mode": "USSD",
  "amount": 1000,
  "currency": "XAF",
  "externalId": "hypnos-momo-test-001",
  "provider": "MTN_MOMO_COG",
  "phoneNumber": "<NUMERO_TEST_KPAY_COG>"
}
```

Le numéro doit être au format international `+242XXXXXXXXX` (9 chiffres après 242); le backend le normalise sans le signe `+`. Les pages publiques KPay consultées répertorient des numéros de test CMR mais pas de numéros COG. N’utilisez donc pas un numéro inventé ou un numéro client comme numéro sandbox : demandez à KPay un numéro de test COG ou utilisez d’abord le parcours carte sandbox.

## Vérifier le statut et les callbacks

Après une initiation, la consultation authentifiée est :

```bash
curl "$API_URL/api/payments/kpay/status/hypnos-card-test-001/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Le retour du navigateur est seulement informatif, même si KPay y indique `COMPLETED`. Le statut final Hypnos n’est mis à jour que par les événements webhook signés (`payment.completed`, `payment.failed`, `payment.cancelled`). Le webhook vérifie `X-KPAY-Signature` comme HMAC-SHA256 du corps JSON brut, vérifie le montant si celui-ci est présent, et accepte les doublons sans transition supplémentaire.

## Tests Django sans appel réseau

À la racine `backend/api` :

```bash
.venv/bin/python manage.py test payments
```

La suite couvre la payload carte, la normalisation du numéro Mobile Money, l’idempotence de l’externalId, le refus d’une clé live sans opt-in, la validation HMAC, la répétition d’un webhook, le fait que le retour navigateur ne valide pas seul un paiement et l’exigence d’authentification pour l’initiation. Ces tests n’utilisent pas de vraie clé et ne déclenchent aucun transfert.

Références KPay : https://kpay.site/documentation/paiements · https://kpay.site/documentation/authentification · https://kpay.site/documentation/environnements · https://kpay.site/documentation/webhooks · https://kpay.site/documentation/providers · https://kpay.site/documentation/cartes · https://kpay.site/documentation/donnees-test
