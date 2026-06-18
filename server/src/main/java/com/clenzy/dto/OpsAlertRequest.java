package com.clenzy.dto;

/**
 * Payload d'une alerte ops (deploiement echoue, incident infra/monitoring) postee
 * par le CI/CD (cd-deploy.yml) ou un systeme de monitoring vers
 * {@code POST /api/ops/alerts}.
 *
 * @param severity "critical" | "warning" | "info" (indicatif ; defaut "critical")
 * @param title    titre court de l'alerte (obligatoire)
 * @param message  detail de l'alerte (obligatoire)
 * @param source   origine ("cd-deploy", "alertmanager", ...) — facultatif
 * @param link     lien d'action (URL du run CI / dashboard) — facultatif
 */
public record OpsAlertRequest(
        String severity,
        String title,
        String message,
        String source,
        String link
) {}
