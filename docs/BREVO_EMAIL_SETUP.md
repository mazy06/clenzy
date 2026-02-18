# Configuration Brevo (SMTP) - Module Email Clenzy

## Objectif
Configurer un envoi SMTP Brevo fiable pour :
- messages contact (`/api/contact/messages`)
- formulaires publics (devis, maintenance)

La reception reste gerée par IMAP (`clenzy.imap.*`) via la boite du domaine.

## Variables d'environnement
Configurer au minimum :

```bash
MAIL_PROVIDER=brevo
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=a27b10001@smtp-brevo.com
MAIL_PASSWORD=xsmtpsib-a63c9b8a8a2ea993515c9d273cb60c1c42e2b494a049de40a4eff67083ace3b8-TaxVcGnOHQuywuEp
MAIL_FROM=info@clenzy.fr
MAIL_NOTIFICATION_TO=info@clenzy.fr
```

Pour la robustesse SMTP :

```bash
MAIL_SMTP_CONNECTION_TIMEOUT_MS=5000
MAIL_SMTP_TIMEOUT_MS=5000
MAIL_SMTP_WRITE_TIMEOUT_MS=5000
MAIL_SMTP_POOL_SIZE=20
```

## DNS & delivrabilite (obligatoire)
- SPF : inclure Brevo dans l'enregistrement SPF de votre domaine.
- DKIM : publier les clefs DKIM fournies par Brevo.
- DMARC : definir une politique (`p=none` puis `quarantine/reject` apres stabilisation).
- Aligner `MAIL_FROM` avec un domaine valide dans Brevo.

## Reception (IMAP)
Configurer les variables IMAP si vous souhaitez exploiter la reception mailbox :

```bash
IMAP_ENABLED=true
IMAP_HOST=<serveur-imap>
IMAP_PORT=993
IMAP_USERNAME=<adresse-mail>
IMAP_PASSWORD=<mot-de-passe-imap>
```

## Bonnes pratiques de production
- Utiliser des secrets (Vault, Docker secrets, AWS SSM), jamais de clé SMTP en clair dans Git.
- Monitorer le ratio `SENT` vs `DELIVERED` dans les messages de contact.
- Garder les timeouts SMTP courts et le pooling actif pour limiter la latence.
- Mettre en place alertes sur erreurs d'envoi et saturation pool SMTP.
