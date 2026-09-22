# Baitly: découverte publique et négociation Markdown

## Comportement livré

Le build `npm run build:site` régénère `sitemap.xml`, `robots.txt`, `llms.txt`,
les représentations Markdown des pages publiques et les fragments nginx associés.
Les routes sont lues dans `site/main.tsx`, les slugs dans `site/data/catalog.tsx`
et le corpus juridique. Une nouvelle route sans politique de découverte ou sans
texte Markdown fait échouer le build. Une route retirée disparaît au build suivant.
Les pages d'inscription et d'activation sont exclues du sitemap et du Markdown.

Le sitemap contient les URL publiques sans paramètres de session, fragments,
liens privés ni dates `lastmod` artificielles. L'artefact statique utilise
`https://baitly.fr`. En production nginx sert les URL absolues avec le nom d'hôte
HTTPS transmis par le reverse proxy, limité aux caractères d'un nom DNS; une même image peut
ainsi servir plusieurs domaines. `robots.txt` référence le sitemap du même hôte.
Les hôtes alternatifs qui doivent rediriger vers un domaine canonique continuent
de relever des règles de redirection du reverse proxy ou de Cloudflare.

Les réponses des pages publiques annoncent une ressource réellement servie:

```http
Link: </llms.txt>; rel="describedby"; type="text/plain"
```

`llms.txt` décrit Baitly et liste ses pages. Aucun catalogue d'API, endpoint MCP,
endpoint A2A ou Swagger public n'est annoncé sans service correspondant.

Une requête qui accepte explicitement `text/markdown` avec un poids non nul reçoit
`Content-Type: text/markdown; charset=utf-8`. `q=0` et les jokers seuls ne
déclenchent pas le Markdown. Les requêtes ordinaires reçoivent le HTML habituel.
Les deux représentations portent `Vary: Accept` et `Cache-Control: no-store`
pour éviter de mélanger les formats dans les caches. Une règle Cloudflare qui
force le cache en ignorant ces en-têtes doit être exclue de ces pages.

Le Markdown reprend les textes éditoriaux des dictionnaires utilisés par les
pages, sans maquettes, composants interactifs ou données de compte. `?lang=en`
et `?lang=ar` sélectionnent les traductions; le défaut est le français. Les pages
juridiques restent en français, conformément au rendu actuel de `LegalPage`.
Il ne s'agit pas d'un convertisseur général de pages privées ou de contenu
chargé après authentification. Aucun nombre de tokens approximatif n'est annoncé.

Les fragments nginx sont copiés uniquement dans l'image marketing par
`Dockerfile.site`, hors de la racine web. Le PMS conserve son `robots.txt`
restrictif et ne publie pas de sitemap de comptes ou de réservations privées.

## Vérification et publication

La CI frontend exécute les tests du générateur, les deux builds puis
`python3 tooling/check_baitly_discovery.py --nginx /usr/sbin/nginx`. Ce dernier
lance uniquement un processus nginx natif temporaire, avec un port de boucle
locale libre. Il vérifie GET/HEAD, XML, MIME, négociation et refus `q=0`, langues,
Link, cache, domaines distincts et isolation du PMS. Aucun conteneur n'est manipulé.

La publication suit exclusivement la PR vers `production` puis GitHub Actions;
le workflow frontend publie les images et demande au dépôt infra le déploiement
de `pms-client` et `baitly-site`. Une fois ce déploiement autorisé et terminé:

```sh
rtk curl -i https://baitly.fr/robots.txt
rtk curl -i https://baitly.fr/sitemap.xml
rtk curl -I https://baitly.fr/
rtk curl -i -H 'Accept: text/markdown' 'https://baitly.fr/?lang=fr'
rtk curl -i -H 'Accept: text/markdown;q=0, text/html' https://baitly.fr/
rtk curl -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' -d '{"url":"https://baitly.fr"}'
```

Le scan distant doit alors retourner `pass` pour
`checks.discoverability.robotsTxt`, `checks.discoverability.sitemap`,
`checks.discoverability.linkHeaders` et
`checks.contentAccessibility.markdownNegotiation`. Il n'a pas été utilisé pour
valider un déploiement qui n'a pas encore eu lieu.

## DNS-AID: prérequis encore manquants

État constaté le 22 septembre 2026: DNS autoritaire Cloudflare, registrar OVH
(RDAP AFNIC), aucune réponse DS positive au niveau `.fr` via Google Public DNS.
Cela ne suffit pas à déterminer si Cloudflare signe déjà la zone; cela montre
que la chaîne DNSSEC publique complète n'est pas établie par un DS publié.
La recherche dans le backend n'a trouvé aucun endpoint public MCP ou A2A.
L'assistant interne authentifié n'est pas automatiquement un tel endpoint.

Avant de créer un enregistrement sous `_agents.baitly.fr`, identifier le vrai
service, son URL HTTPS, son protocole et son descripteur public. Un index
`_index._agents.baitly.fr` doit désigner un registre d'agents réellement disponible,
pas simplement la page marketing. Ne pas inventer un endpoint pour satisfaire
le scanner.

Le déploiement DNS devra passer par un workflow CI/CD disposant d'un token
Cloudflare limité à cette zone, avec `DNS Write` (permission requise aussi par
l'API de modification DNSSEC).
Il devra lire les enregistrements existants, préparer un changement ciblé puis:

1. Activer ou vérifier la signature DNSSEC chez Cloudflare et récupérer les
   paramètres DS publics exacts de cette zone.
2. Publier ces paramètres chez OVH via une intégration CI/CD autorisée. Ne jamais
   deviner ou recopier le DS d'une autre zone. Attendre la validation de la chaîne.
3. Publier un SVCB en ServiceMode (priorité supérieure à zéro) ou un HTTPS adapté
   au service réel, avec `alpn`, le port et les paramètres de connexion exacts.
   Les clés expérimentales non enregistrées utilisent `keyNNNNN`; leurs numéros
   et leur sémantique doivent être convenus avec le client qui les interprète.
4. Vérifier les réponses via un résolveur validant (données authentifiées, pas
   seulement présence d'un record), puis relancer le scan DNS-AID.

Aucun enregistrement DNS ni paramètre DNSSEC n'est modifié par cette PR. Les
identifiants CI/CD et l'endpoint d'agent doivent être disponibles avant de rendre
ce changement concret. Le draft DNS-AID `-02` est encore expérimental et rend
DNSSEC recommandé; la demande présente impose bien une zone signée.

## Références

- [Skill sitemap](https://isitagentready.com/.well-known/agent-skills/sitemap/SKILL.md)
- [Skill Link](https://isitagentready.com/.well-known/agent-skills/link-headers/SKILL.md)
- [Skill Markdown](https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md)
- [Skill DNS-AID](https://isitagentready.com/.well-known/agent-skills/dns-aid/SKILL.md)
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288), [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727)
- [DNS-AID draft -02](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dnsop-dnsaid-02), [RFC 9460](https://www.rfc-editor.org/rfc/rfc9460)
- [Cloudflare Markdown for Agents: forfaits Pro, Business ou Enterprise](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Cloudflare DNSSEC](https://developers.cloudflare.com/dns/dnssec/)
