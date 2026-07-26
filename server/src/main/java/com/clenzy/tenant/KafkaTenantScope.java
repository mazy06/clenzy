package com.clenzy.tenant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Politique unique de scoping tenant pour les consommateurs Kafka.
 *
 * <h2>Le problème qu'il résout</h2>
 * <p>Audit 2026-07 : les 18 {@code @KafkaListener} résolvaient l'organisation de
 * <b>sept manières différentes</b> — {@code resolveOrganizationId}, {@code resolveOrgId},
 * {@code parseOrgId}, {@code asLong(event…)}, {@code extractLong(event, "orgId")}… — et selon
 * <b>deux politiques opposées</b> : certains la re-dérivaient de la base (correct), d'autres
 * la lisaient dans le payload. Cette seconde famille laissait l'émetteur d'un événement
 * choisir le tenant sous lequel il s'exécutait, d'où les constats P1-03 (exfiltration
 * documentaire), P1-04 (mutation financière) et P1-19 (Expedia).</p>
 *
 * <p>CLAUDE.md désigne bien {@link TenantScopedExecutor} comme composant canonique du
 * contexte tenant hors HTTP, mais rien n'exprimait la <b>politique</b> : d'où vient
 * l'organisation, et que faire lorsqu'elle est absente ou contredite par le payload. C'est ce
 * vide qui a produit les sept variantes. Ce composant le comble et <b>délègue</b> l'exécution
 * à {@code TenantScopedExecutor} — conformément à « ne pas réinventer, ne pas contourner ».</p>
 *
 * <h2>Le contrat, en trois règles</h2>
 * <ol>
 *   <li>L'organisation vient <b>toujours</b> d'une source de confiance : une entité chargée
 *       depuis la base. Jamais du payload.</li>
 *   <li>Organisation introuvable ⇒ <b>refus</b>. On n'exécute pas hors scope (fail-closed).</li>
 *   <li>Organisation annoncée par le payload et différente ⇒ <b>refus</b> et trace de sécurité.
 *       Une divergence est la signature d'une forge, pas une donnée à corriger.</li>
 * </ol>
 *
 * <h2>Ce qui reste propre à chaque listener</h2>
 * <p>La <b>façon</b> de résoudre l'organisation — via un mapping de channel, un device, une
 * transaction, une référence documentaire — reste locale : elle est intrinsèque au canal et
 * n'a pas d'abstraction commune raisonnable. Conforme à la règle « un peu de duplication vaut
 * 10x mieux que la mauvaise abstraction ».</p>
 *
 * <h2>Usage</h2>
 * <pre>{@code
 * Long orgId = mapping.getOrganizationId();          // re-derivee de la base
 * kafkaTenantScope.run(TOPIC, orgId, () -> traiter(event));
 *
 * // Variante avec controle de coherence quand le payload annonce une organisation :
 * kafkaTenantScope.run(TOPIC, orgId, payloadOrgId, () -> traiter(event));
 * }</pre>
 */
@Component
public class KafkaTenantScope {

    private static final Logger log = LoggerFactory.getLogger(KafkaTenantScope.class);

    private final TenantScopedExecutor tenantScopedExecutor;

    public KafkaTenantScope(TenantScopedExecutor tenantScopedExecutor) {
        this.tenantScopedExecutor = tenantScopedExecutor;
    }

    /**
     * Exécute {@code action} dans le contexte tenant de {@code trustedOrganizationId}.
     *
     * @param eventLabel             topic ou libellé d'événement, pour la traçabilité
     * @param trustedOrganizationId  organisation <b>re-dérivée d'une source de confiance</b>
     *                               (entité chargée en base) ; {@code null} ⇒ refus
     * @return {@code true} si l'action a été exécutée
     */
    public boolean run(String eventLabel, Long trustedOrganizationId, Runnable action) {
        return run(eventLabel, trustedOrganizationId, null, action);
    }

    /**
     * Même contrat, avec contrôle de cohérence de l'organisation annoncée par le payload.
     *
     * @param declaredOrganizationId organisation annoncée dans l'événement, ou {@code null}.
     *                               Sert <b>uniquement</b> de contrôle : elle n'est jamais
     *                               utilisée comme contexte d'exécution.
     */
    public boolean run(String eventLabel, Long trustedOrganizationId,
                       Long declaredOrganizationId, Runnable action) {
        if (trustedOrganizationId == null) {
            log.error("{} : organisation introuvable — traitement refuse. Le contexte tenant ne "
                    + "peut pas etre pose, et executer hors scope exposerait les autres tenants.",
                    eventLabel);
            return false;
        }
        if (declaredOrganizationId != null && !declaredOrganizationId.equals(trustedOrganizationId)) {
            log.error("SECURITE : {} annonce l'organisation {} alors que l'entite appartient a {}. "
                    + "Evenement rejete (signature d'un payload forge).",
                    eventLabel, declaredOrganizationId, trustedOrganizationId);
            return false;
        }
        tenantScopedExecutor.runAsOrganization(trustedOrganizationId, action);
        return true;
    }
}
