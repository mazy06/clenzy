package com.clenzy.service;

import com.clenzy.dto.MessageTemplateDto;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.repository.MessageTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CRUD des modeles de messages pour la communication avec les voyageurs.
 * Logique deplacee depuis {@code MessageTemplateController} (refactor
 * T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>Tous les acces unitaires passent par
 * {@code findByIdAndOrganizationId(id, orgId)} : un template d'une autre
 * organisation est introuvable (ownership org systematique).</p>
 */
@Service
public class MessageTemplateService {

    /**
     * Bloc markdown ajoute en fin de corps des templates CHECK_IN pour y injecter le
     * lien du livret d'accueil. IDENTIQUE au bloc seede par la migration 0230 (append
     * non destructif) : la generalisation a la publication d'un livret et le re-seed
     * historique doivent produire exactement le meme texte. Le tag {@code {guideLink}}
     * est resolu a l'envoi par {@code GuestMessagingService.templateReferencesGuideLink}.
     */
    static final String GUIDE_LINK_TAG = "{guideLink}";
    static final String GUIDE_LINK_BLOCK =
        "\n\n🏠 **Votre livret d'accueil numérique**\n"
        + "Retrouvez le code d'accès, les instructions d'arrivée et toutes les infos pratiques de votre séjour :\n"
        + "[Ouvrir mon livret d'accueil](" + GUIDE_LINK_TAG + ")\n";

    private final MessageTemplateRepository templateRepository;

    public MessageTemplateService(MessageTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    /**
     * Garantit que les templates CHECK_IN actifs de l'organisation referencent le tag
     * {@code {guideLink}}, afin que l'email de bienvenue contienne le lien du livret.
     *
     * <p>Appele a la publication d'un livret (premier livret publie d'une org) : c'est
     * l'equivalent runtime de la migration 0230, pour les organisations qui publient
     * leur premier livret APRES cette migration et n'auraient donc jamais beneficie du
     * re-seed historique.</p>
     *
     * <p>Idempotent : un template dont le corps OU le sujet contient deja le tag n'est
     * pas modifie (pas de double bloc). Org-scope : seuls les templates de
     * {@code organizationId} sont touches. No-op si {@code organizationId} est null
     * (staff plateforme sans org de contexte n'edite pas les templates d'une org).</p>
     */
    @Transactional
    public void ensureGuideLinkTag(Long organizationId) {
        if (organizationId == null) {
            return;
        }
        for (MessageTemplate template : templateRepository
                .findByOrganizationIdAndTypeAndIsActiveTrue(organizationId, MessageTemplateType.CHECK_IN)) {
            if (referencesGuideLink(template)) {
                continue; // deja present (corps ou sujet) -> idempotent
            }
            template.setBody(template.getBody() + GUIDE_LINK_BLOCK);
            templateRepository.save(template);
        }
    }

    /** Vrai si le sujet ou le corps du template reference deja le tag {@code {guideLink}}. */
    private static boolean referencesGuideLink(MessageTemplate template) {
        return (template.getSubject() != null && template.getSubject().contains(GUIDE_LINK_TAG))
            || (template.getBody() != null && template.getBody().contains(GUIDE_LINK_TAG));
    }

    @Transactional(readOnly = true)
    public List<MessageTemplate> getTemplates(Long organizationId) {
        return templateRepository.findByOrganizationIdOrderByNameAsc(organizationId);
    }

    @Transactional(readOnly = true)
    public Optional<MessageTemplate> getTemplate(Long id, Long organizationId) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId);
    }

    @Transactional
    public MessageTemplate createTemplate(Long organizationId, MessageTemplateDto dto) {
        MessageTemplate template = new MessageTemplate();
        template.setOrganizationId(organizationId);
        template.setName(dto.name());
        template.setType(MessageTemplateType.valueOf(dto.type()));
        template.setSubject(dto.subject());
        template.setBody(dto.body());
        template.setLanguage(dto.language() != null ? dto.language() : "fr");
        template.setActive(true);
        return templateRepository.save(template);
    }

    /** Patch partiel : seuls les champs non-null du DTO sont appliques. */
    @Transactional
    public Optional<MessageTemplate> updateTemplate(Long id, Long organizationId, MessageTemplateDto dto) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId)
            .map(existing -> {
                if (dto.name() != null) existing.setName(dto.name());
                if (dto.type() != null) existing.setType(MessageTemplateType.valueOf(dto.type()));
                if (dto.subject() != null) existing.setSubject(dto.subject());
                if (dto.body() != null) existing.setBody(dto.body());
                if (dto.language() != null) existing.setLanguage(dto.language());
                return templateRepository.save(existing);
            });
    }

    /** Suppression logique (active = false). Retourne false si introuvable dans l'org. */
    @Transactional
    public boolean deactivateTemplate(Long id, Long organizationId) {
        return templateRepository.findByIdAndOrganizationId(id, organizationId)
            .map(existing -> {
                existing.setActive(false);
                templateRepository.save(existing);
                return true;
            })
            .orElse(false);
    }
}
