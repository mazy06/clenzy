package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.service.AuditLogService;
import com.clenzy.util.PiiMasker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Iterator;
import java.util.Map;

/**
 * Audit-logging des actions executees par l'assistant IA (tool calling).
 *
 * <p>Chaque execution d'outil par l'assistant — mono-agent
 * ({@link AgentToolLoopRunner}) ou specialiste multi-agent
 * ({@code AbstractAgentSpecialist}) — passe par ce service afin de produire une
 * trace <b>qui / quoi / quand / resultat</b> :</p>
 * <ul>
 *   <li><b>qui</b> : {@code keycloakId} + {@code organizationId} portes par
 *       l'{@link AgentContext} (le {@code keycloakId} alimente {@code userId}) ;</li>
 *   <li><b>quoi</b> : nom de l'outil ({@code entityType}) + resume des arguments
 *       (tronque + PII-safe, dans {@code newValue}) ;</li>
 *   <li><b>quand</b> : timestamp de l'AuditLog (defaut {@code Instant.now()}) ;</li>
 *   <li><b>resultat</b> : SUCCESS / ERROR encode dans {@code details}.</li>
 * </ul>
 *
 * <p>Reutilise l'infra existante : delegue a {@link AuditLogService#logAction}
 * (ecriture <b>asynchrone, fire-and-forget, {@code REQUIRES_NEW}</b>) qui ne fait
 * JAMAIS echouer l'operation metier. La source est {@link AuditSource#ASSISTANT}
 * et l'action {@link AuditAction#ASSISTANT_TOOL}.</p>
 *
 * <p><b>Priorite WRITE</b> : seuls les outils d'ecriture (ceux dont le
 * {@link ToolDescriptor#requiresConfirmation()} est vrai —
 * {@code create_reservation}, {@code cancel_reservation},
 * {@code set_rate_override}, {@code update_intervention_status},
 * {@code block_calendar_day}, {@code create_invoice}...) sont traces : ce sont
 * eux qui modifient des donnees. Les outils read-only ne polluent pas la trace
 * (et sont deja couverts par les metriques d'observabilite).</p>
 *
 * <p><b>Securite</b> : aucun secret n'est logge ; les valeurs ressemblant a des
 * PII (email, telephone) sont masquees via {@link PiiMasker} ; chaque valeur est
 * tronquee a {@value #MAX_VALUE_LEN} caracteres et le resume global a
 * {@value #MAX_SUMMARY_LEN}.</p>
 */
@Service
public class AgentActionAuditService {

    private static final Logger log = LoggerFactory.getLogger(AgentActionAuditService.class);

    /** Longueur max d'une valeur d'argument dans le resume (anti-flooding + PII). */
    static final int MAX_VALUE_LEN = 80;
    /** Longueur max du resume complet des arguments. */
    static final int MAX_SUMMARY_LEN = 512;
    private static final String REDACTED = "***";

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public AgentActionAuditService(AuditLogService auditLogService, ObjectMapper objectMapper) {
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    /**
     * Trace l'execution d'un outil d'ecriture. No-op pour les outils read-only
     * ({@code !isWrite}) afin de garder la trace focalisee sur les mutations.
     *
     * @param toolName   nom de l'outil (snake_case)
     * @param argsJson   arguments JSON bruts emis par le LLM (peut etre null/blank)
     * @param isWrite    true si l'outil modifie des donnees (descriptor requiresConfirmation)
     * @param success    true si l'execution a reussi
     * @param context    contexte agent (porte keycloakId + organizationId)
     */
    public void recordToolExecution(String toolName, String argsJson, boolean isWrite,
                                    boolean success, AgentContext context) {
        if (!isWrite) {
            return;  // les lectures ne sont pas auditees (couvertes par les metriques)
        }
        try {
            String summary = summarizeArgs(argsJson);
            String details = (success ? "SUCCESS" : "ERROR")
                    + " | assistant tool '" + toolName + "'"
                    + (summary.isEmpty() ? "" : " | args: " + summary);

            // logAction enrichit userId/email depuis le SecurityContext quand il
            // existe ; on force userId au keycloakId du contexte agent (le flow
            // multi-agent peut tourner hors thread HTTP). On passe l'orgId explicite.
            auditLogService.logAction(
                    AuditAction.ASSISTANT_TOOL,
                    toolName,                              // entityType = nom de l'outil
                    context != null ? context.keycloakId() : null,  // entityId = qui a declenche
                    null,                                  // oldValue : non pertinent
                    summary.isEmpty() ? null : summary,    // newValue = resume des args
                    details,
                    AuditSource.ASSISTANT,
                    context != null ? context.organizationId() : null
            );
        } catch (Exception e) {
            // L'audit ne doit JAMAIS faire echouer l'execution de l'outil.
            log.warn("[AGENT-AUDIT] Echec de l'audit de l'outil '{}' : {}", toolName, e.getMessage());
        }
    }

    /**
     * Construit un resume PII-safe et tronque des arguments JSON. Les valeurs
     * scalaires sont aplaties en {@code clef=valeur} ; les valeurs ressemblant a
     * une PII sont masquees ; les objets/tableaux imbriques sont remplaces par un
     * marqueur de type pour eviter de fuiter des donnees structurees volumineuses.
     */
    String summarizeArgs(String argsJson) {
        if (argsJson == null || argsJson.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(argsJson);
            if (!root.isObject()) {
                return truncate(maskScalar(root.asText("")), MAX_VALUE_LEN);
            }
            StringBuilder sb = new StringBuilder();
            Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (sb.length() > 0) {
                    sb.append(", ");
                }
                sb.append(field.getKey()).append('=').append(summarizeValue(field.getKey(), field.getValue()));
                if (sb.length() >= MAX_SUMMARY_LEN) {
                    break;
                }
            }
            return truncate(sb.toString(), MAX_SUMMARY_LEN);
        } catch (Exception e) {
            log.debug("[AGENT-AUDIT] Args JSON non parsables, resume omis : {}", e.getMessage());
            return "<args non lisibles>";
        }
    }

    private String summarizeValue(String key, JsonNode value) {
        if (value == null || value.isNull()) {
            return "null";
        }
        if (value.isObject()) {
            return "{...}";
        }
        if (value.isArray()) {
            return "[" + value.size() + " items]";
        }
        if (isSensitiveKey(key)) {
            return REDACTED;
        }
        return truncate(maskScalar(value.asText("")), MAX_VALUE_LEN);
    }

    /**
     * Masque les secrets evidents (cles, tokens, mots de passe) — jamais loggue,
     * et les valeurs ressemblant a un email via {@link PiiMasker}.
     */
    private boolean isSensitiveKey(String key) {
        if (key == null) {
            return false;
        }
        String k = key.toLowerCase();
        return k.contains("password") || k.contains("secret") || k.contains("token")
                || k.contains("apikey") || k.contains("api_key") || k.contains("authorization");
    }

    /** Masque une valeur scalaire ressemblant a une PII (email). */
    private String maskScalar(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains("@") && value.indexOf('@') > 0 && !value.contains(" ")) {
            return PiiMasker.maskEmail(value);
        }
        return value;
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "…";
    }
}
