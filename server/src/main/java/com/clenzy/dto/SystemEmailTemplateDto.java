package com.clenzy.dto;

import com.clenzy.model.SystemEmailTemplate;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO d'une ligne {@code system_email_template} expose au frontend.
 *
 * @param id                   identifiant DB
 * @param organizationId       null si template systeme, defini si override per-org
 * @param templateKey          slug logique stable
 * @param language             locale (fr, en, ar)
 * @param recipientType        OWNER | GUEST | INTERNAL_TEAM | INVITED_USER
 * @param subject              sujet de l'email (peut contenir des variables)
 * @param body                 corps plain text editable (wrappe en HTML cote serveur)
 * @param isSystem             true = template systeme read-only
 * @param parentTemplateId     si override, id du template systeme parent
 * @param variables            variables {nameVar} extraites du subject + body
 * @param updatedAt            derniere modification
 */
public record SystemEmailTemplateDto(
    Long id,
    Long organizationId,
    String templateKey,
    String language,
    String recipientType,
    String subject,
    String body,
    boolean isSystem,
    Long parentTemplateId,
    List<String> variables,
    LocalDateTime updatedAt
) {
    public static SystemEmailTemplateDto fromEntity(SystemEmailTemplate entity, List<String> variables) {
        return new SystemEmailTemplateDto(
            entity.getId(),
            entity.getOrganizationId(),
            entity.getTemplateKey(),
            entity.getLanguage(),
            entity.getRecipientType(),
            entity.getSubject(),
            entity.getBody(),
            entity.isSystem(),
            entity.getParentTemplateId(),
            variables,
            entity.getUpdatedAt()
        );
    }
}
