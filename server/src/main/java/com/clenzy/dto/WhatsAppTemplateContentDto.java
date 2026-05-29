package com.clenzy.dto;

import com.clenzy.model.WhatsAppTemplateContent;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO d'une ligne {@code whatsapp_template_content} expose au frontend.
 *
 * <p>Inclut les variables extraites du body pour permettre a l'UI d'afficher
 * "Ce template utilise : guestFirstName, accessCode" sans re-parser cote client.</p>
 *
 * @param id                   identifiant DB (null si pas encore persiste)
 * @param organizationId       null si template systeme, defini si override per-org
 * @param templateKey          slug logique stable
 * @param language             locale Meta (fr_FR, en_US, ar_AR)
 * @param category             UTILITY | MARKETING | AUTHENTICATION
 * @param bodyNamed            body au format nomme editable
 * @param isSystem             true = template systeme read-only
 * @param parentTemplateId     si override, id du template systeme parent
 * @param metaTemplateName     nom Meta (clenzy_xxx_v1) si soumis
 * @param metaApprovalStatus   PENDING | APPROVED | REJECTED | PAUSED ou null
 * @param variables            liste ordonnee des variables {nameVar} extraites du body
 * @param updatedAt            derniere modification (utile pour cache busting frontend)
 */
public record WhatsAppTemplateContentDto(
    Long id,
    Long organizationId,
    String templateKey,
    String language,
    String category,
    String bodyNamed,
    boolean isSystem,
    Long parentTemplateId,
    String metaTemplateName,
    String metaApprovalStatus,
    List<String> variables,
    LocalDateTime updatedAt
) {

    /**
     * Conversion depuis l'entite. Les variables sont extraites a la volee via
     * le converter (extractVariables) — le caller doit passer la liste deja
     * calculee pour eviter d'injecter le converter ici.
     */
    public static WhatsAppTemplateContentDto fromEntity(WhatsAppTemplateContent entity,
                                                          List<String> variables) {
        return new WhatsAppTemplateContentDto(
            entity.getId(),
            entity.getOrganizationId(),
            entity.getTemplateKey(),
            entity.getLanguage(),
            entity.getCategory(),
            entity.getBodyNamed(),
            entity.isSystem(),
            entity.getParentTemplateId(),
            entity.getMetaTemplateName(),
            entity.getMetaApprovalStatus(),
            variables,
            entity.getUpdatedAt()
        );
    }
}
