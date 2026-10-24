package com.clenzy.dto;

/**
 * Payload d'une alerte ops (deploiement echoue, incident infra/monitoring) postee
 * par le CI/CD (cd-deploy.yml) ou un systeme de monitoring vers
 * {@code POST /api/ops/alerts}.
 *
 * @param severity "critical" | "warning" | "info" (indicatif ; defaut "critical")
 * @param title    champ historique obligatoire, jamais recopié dans la notification Baitly
 * @param message  champ historique obligatoire, jamais recopié dans la notification Baitly
 * @param source   origine historique facultative, jamais utilisée comme label libre
 * @param link     URL HTTPS d'un run GitHub Baitly connu, sans query ni fragment ; sinon ignorée
 */
public record OpsAlertRequest(
        String severity,
        String title,
        String message,
        String source,
        String link
) {}
