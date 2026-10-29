# Remettre Figma XR en service avec l’OAuth Figma actuel

Vérifié le 29 octobre 2026 dans la documentation officielle Figma.

## Ce que l’inspection a trouvé

Le dépôt utilisait déjà les scopes granulaires `current_user:read` et `file_content:read`, et le nouvel endpoint d’échange. Les problèmes de code étaient ailleurs : paramètres placés dans l’URL au lieu du corps du POST, renouvellement envoyé à `/oauth/token` au lieu de `/oauth/refresh`, expiration calculée avec une mauvaise unité au premier échange, état OAuth généré avec `Math.random()`, et tentatives de renouvellement même sur des erreurs réseau, 403 et 429. La route pouvait aussi lancer une navigation pendant sa propre garde.

Le workflow de déploiement injectait `VITE_SECRET` dans le frontend. Les variables `VITE_*` sont publiques après compilation : l’ancien secret doit être considéré comme exposé et remplacé. Le nouveau secret est utilisé exclusivement par `server/figma-auth.mjs`.

Figma exige aussi la republication des anciennes applications depuis le 17 novembre 2025. Le statut de ton application et son éventuel message « Update required » ne sont pas visibles depuis le dépôt : il faut les vérifier dans ton compte.

## 1. Ouvrir et mettre à jour l’application Figma

Ouvre <https://www.figma.com/developers/apps> et sélectionne l’application Figma XR existante. Il n’est normalement pas nécessaire de créer une autre application ou de changer de Client ID. Une nouvelle application n’est utile que si tu ne peux plus administrer l’ancienne.

- Associe l’application à ton équipe ou organisation Figma.
- Vérifie son nom, son logo et sa description.
- Dans **OAuth credentials**, ajoute exactement ces URL de redirection, avec le slash et `?callback` :

```text
https://arthurmougin.github.io/figma-xr/?callback
https://localhost:5173/figma-xr/?callback
```

Le callback reste le frontend. L’adresse du relais serveur n’est pas une URL de redirection OAuth. Pour tester avec un smartphone ou un casque via une autre adresse HTTPS, il faut enregistrer cette adresse exacte dans Figma et dans `FIGMA_REDIRECT_URIS`, puis son origine dans `FIGMA_ALLOWED_ORIGINS`.

Dans **OAuth scopes**, conserve seulement :

| Scope | Justification à saisir dans Figma |
| --- | --- |
| `current_user:read` | Read the signed-in user's name and avatar to display their profile in Figma XR. |
| `file_content:read` | Read the frames in a Figma file selected by the user and render those frames as images for placement in a WebXR scene. |

`file_metadata:read` n’est pas nécessaire pour les appels actuels : le projet utilise `/v1/me`, `/v1/files/:key` et `/v1/images/:key`. Il ne fait pas d’appel à l’endpoint séparé de métadonnées.

Description possible :

> Figma XR is an open-source prototype that lets users select a Figma design file, render its frames as images, and place them in an immersive WebXR scene to explore interface layouts at scale.

Dans **Publish**, choisis selon l’usage :

- **Private** : usage limité à l’équipe ou organisation propriétaire ; pas de revue Figma.
- **Public** : nécessaire pour permettre la connexion d’utilisateurs Figma extérieurs ; revue et approbation Figma avant utilisation publique.

Pour une soumission publique, les instructions de test peuvent être : ouvrir l’application, se connecter à Figma, coller le lien d’un fichier Figma Design accessible contenant des frames, ouvrir le projet, puis vérifier le rendu des panneaux en 3D. Préciser qu’un casque compatible est nécessaire pour tester le mode immersif ; ne pas présenter des fonctions qui ne sont pas implémentées. Préparer un fichier de démonstration accessible au reviewer. Attendre d’avoir une URL fonctionnelle du relais et un parcours testé avant de soumettre la version publique.

## 2. Régénérer le secret et le garder côté serveur

Dans les identifiants OAuth de l’application, utilise la fonction de régénération du **Client Secret**. Si le secret n’est plus récupérable, génère un remplacement avec les contrôles proposés par Figma. Si tu crées une nouvelle application, Figma affiche le secret à sa création : conserve-le immédiatement dans un gestionnaire de secrets.

- Garde le **Client ID** : c’est un identifiant public, utilisé des deux côtés.
- Place le nouveau **Client Secret** dans `FIGMA_CLIENT_SECRET` du serveur uniquement.
- Supprime l’ancien secret GitHub Actions nommé `VITE_SECRET`.
- Ne colle pas le secret dans le chat, le code, une issue ou une PR.

La rotation invalide l’ancien secret pour l’échange et le renouvellement. Le frontend demande une nouvelle connexion après migration : l’ancien stockage `localStorage.auth` est supprimé. Les nouvelles sessions sont conservées dans `sessionStorage`, par onglet. Les jetons utilisateur restent accessibles au JavaScript de cet onglet ; ce relais n’est pas une implémentation de sessions serveur avec cookies HttpOnly.

## 3. Tester en local

Prérequis : Node.js 22.18+ ou Node.js 24 LTS, npm, et les deux callbacks enregistrés dans Figma. Utiliser le même Client ID dans le frontend et le serveur.

```bash
npm ci
```

Copie `.env.example` vers `.env.local`, puis `.env.auth.example` vers `.env.auth` avec ton éditeur ou ton explorateur. Ces fichiers locaux sont ignorés par Git. Renseigne :

```dotenv
# .env.local — public
VITE_ID=ton_client_id
VITE_AUTH_API_URL=
```

```dotenv
# .env.auth — privé, seulement sur le serveur
FIGMA_CLIENT_ID=ton_client_id
FIGMA_CLIENT_SECRET=ton_nouveau_secret
FIGMA_ALLOWED_ORIGINS=https://localhost:5173,https://arthurmougin.github.io
FIGMA_REDIRECT_URIS=https://localhost:5173/figma-xr/?callback,https://arthurmougin.github.io/figma-xr/?callback
PORT=8787
AUTH_HOST=127.0.0.1
```

Lance deux terminaux dans le dépôt :

```bash
npm run dev:auth
```

```bash
npm run dev
```

Ouvre <https://localhost:5173/figma-xr/>. Accepte le certificat de développement si ton navigateur le demande. Vite transmet les requêtes `/api/figma` au serveur local sur le port 8787. Le port Vite est fixe pour éviter un callback différent de celui enregistré.

Vérifie : connexion, consentement, retour à la liste des projets sans code OAuth dans l’URL, affichage du profil, import d’un fichier accessible, rendu des images, déconnexion, puis nouvelle connexion. Le code d’autorisation expire au bout de **30 secondes** : ne pas mettre de pause manuelle entre le callback et l’échange.

```bash
npm test
npm run build
```

Les 12 tests utilisent des réponses Figma simulées : ils couvrent notamment le store Pinia, la persistance par onglet, le callback, le renouvellement partagé, les requêtes API et le relais HTTP. Ils ne remplacent pas la validation dans un navigateur avec ton application Figma publiée et ton compte.

## 4. Remettre en ligne le site GitHub Pages

GitHub Pages ne peut pas exécuter le relais Node.js. Héberge `server/figma-auth.mjs` sur un serveur ou service Node.js accessible en HTTPS, avec les quatre variables `FIGMA_*` ci-dessus et :

```dotenv
AUTH_HOST=0.0.0.0
```

Commande de démarrage : `npm run start:auth` (ou `node server/figma-auth.mjs`, sans dépendance serveur externe). Le service utilise le port `PORT` fourni par l’hébergeur. `/health` répond `{ "ok": true }`. En production, limite `FIGMA_ALLOWED_ORIGINS` à `https://arthurmougin.github.io` et `FIGMA_REDIRECT_URIS` au callback GitHub Pages, à moins d’avoir besoin d’autres environnements. Une origine CORS est une contrainte navigateur, pas une authentification du client ; activer les protections de quota de l’hébergeur si le service est exposé publiquement.

Dans le dépôt GitHub → **Settings → Secrets and variables → Actions** :

| Type | Nom | Valeur |
| --- | --- | --- |
| Secret existant | `VITE_ID` | Le Client ID de l’application Figma. Un secret GitHub peut le stocker, mais cette valeur devient publique dans le frontend. |
| Variable de dépôt | `VITE_AUTH_API_URL` | `https://ton-serveur-auth.example/api/figma` |

L’URL doit inclure `/api/figma` et utiliser HTTPS. Aucun Client Secret ne doit être configuré dans les variables du build Vite. Le workflow refuse de déployer si `VITE_AUTH_API_URL` est vide. Une nouvelle exécution du workflow est nécessaire après toute modification de ces valeurs.

Le déploiement du relais et la republication dans Figma doivent être terminés pour pouvoir valider la connexion réelle. Cette branche ne choisit ni ne provisionne un hébergeur.

## Comprendre une erreur persistante

| Symptôme | Vérification |
| --- | --- |
| Application indisponible ou « Update required » | Republier l’application ; vérifier la revue Figma pour une application publique. |
| Erreur de redirect URI | Comparer caractère par caractère le callback enregistré et celui du navigateur, y compris `/` et `?callback`. |
| Échange refusé | Client ID identique des deux côtés, nouveau secret côté serveur, code échangé en moins de 30 s. |
| Relais inaccessible / CORS | `VITE_AUTH_API_URL`, HTTPS, origine autorisée exacte et processus serveur démarré. |
| 403 sur un fichier | Partage du fichier et scopes accordés ; un renouvellement de token ne donne pas de permissions supplémentaires. |
| 429 | Limite API Figma ; attendre selon `Retry-After` plutôt que reconnecter le compte. |

## Sources officielles

- [OAuth apps : création, configuration, PKCE, échange et renouvellement](https://developers.figma.com/docs/rest-api/oauth-apps/)
- [Republication des anciennes applications et migration des scopes](https://developers.figma.com/docs/rest-api/republish-oauth-apps/)
- [Changements de la plateforme développeur](https://developers.figma.com/docs/updates-to-figmas-developer-platform/)
- [Scopes](https://developers.figma.com/docs/rest-api/scopes/)
- [Endpoints des fichiers et des images](https://developers.figma.com/docs/rest-api/file-endpoints/)
