package com.clenzy.audit;

import com.clenzy.model.AuditSource;
import com.clenzy.service.AuditLogService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Aspect AOP qui intercepte les methodes annotees {@link Audited}
 * et enregistre automatiquement l'action dans l'audit trail.
 *
 * Exigence Airbnb Partner : audit automatique de toutes les operations sensibles.
 */
@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final AuditLogService auditLogService;

    public AuditAspect(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @AfterReturning(pointcut = "@annotation(audited)", returning = "result")
    public void auditMethod(JoinPoint joinPoint, Audited audited, Object result) {
        try {
            String entityId = extractEntityId(result);
            String details = audited.description().isEmpty()
                    ? joinPoint.getSignature().toShortString()
                    : audited.description();

            auditLogService.logAction(
                    audited.action(),
                    audited.entityType(),
                    entityId,
                    null,
                    result != null ? summarize(result) : null,
                    details,
                    AuditSource.WEB
            );
        } catch (Exception e) {
            // Ne jamais faire echouer l'operation metier a cause de l'audit
            log.error("Erreur dans l'aspect d'audit pour {}: {}",
                    joinPoint.getSignature().toShortString(), e.getMessage());
        }
    }

    /**
     * Tente d'extraire l'ID de l'entite depuis le resultat de la methode.
     * Supporte les objets avec getId() ou id.
     */
    private String extractEntityId(Object result) {
        if (result == null) return null;
        try {
            var method = result.getClass().getMethod("getId");
            Object id = method.invoke(result);
            return id != null ? id.toString() : null;
        } catch (NoSuchMethodException e) {
            // L'objet n'a pas de getId(), essayer toString
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Resume l'objet resultat pour le log (max 500 caracteres).
     */
    private String summarize(Object result) {
        String str = result.toString();
        if (str.length() > 500) {
            return str.substring(0, 500) + "...";
        }
        return str;
    }
}
