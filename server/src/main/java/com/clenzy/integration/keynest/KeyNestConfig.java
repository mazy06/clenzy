package com.clenzy.integration.keynest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration pour l'API KeyNest V3.
 * Variables d'environnement :
 * - KEYNEST_API_KEY      : cle d'API KeyNest
 * - KEYNEST_API_URL      : URL de base (default: https://api.keynest.com/v3)
 * - KEYNEST_WEBHOOK_SECRET : secret HMAC-SHA256 pour la verification des webhooks
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TODO [KEYNEST-1] — Obtenir les credentials API KeyNest V3
 *   1. Creer un compte pro KeyNest : https://keynest.com/business
 *   2. Recuperer l'API key V3 depuis le dashboard KeyNest > Settings > API
 *   3. Configurer le webhook secret dans le dashboard KeyNest > Webhooks
 *   4. Ajouter les variables d'environnement en production :
 *      - KEYNEST_API_KEY=<votre-cle-api>
 *      - KEYNEST_API_URL=https://api.keynest.com/v3  (verifier l'URL exacte dans la doc)
 *      - KEYNEST_WEBHOOK_SECRET=<votre-secret-webhook>
 *   5. Dans docker-compose.yml ou le deploiement Kubernetes, ajouter :
 *        environment:
 *          - KEYNEST_API_KEY=${KEYNEST_API_KEY}
 *          - KEYNEST_API_URL=${KEYNEST_API_URL}
 *          - KEYNEST_WEBHOOK_SECRET=${KEYNEST_WEBHOOK_SECRET}
 *   6. Verifier que isConfigured() retourne true apres configuration
 *
 * TODO [KEYNEST-2] — Valider l'URL de base de l'API
 *   L'URL par defaut est https://api.keynest.com/v3 (hypothese basee sur la doc publique).
 *   A confirmer avec la documentation officielle KeyNest V3 :
 *   - L'URL pourrait etre https://api.keynest.com/api/v3 ou un autre format
 *   - Verifier s'il existe un environnement sandbox/staging pour les tests
 *   - Si sandbox disponible, ajouter un profil Spring pour basculer :
 *       keynest.api.url=https://sandbox.keynest.com/v3  (exemple)
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Configuration
public class KeyNestConfig {

    @Value("${keynest.api.key:}")
    private String apiKey;

    @Value("${keynest.api.url:https://api.keynest.com/v3}")
    private String apiUrl;

    @Value("${keynest.webhook.secret:}")
    private String webhookSecret;

    public String getApiKey() { return apiKey; }
    public String getApiUrl() { return apiUrl; }
    public String getWebhookSecret() { return webhookSecret; }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
