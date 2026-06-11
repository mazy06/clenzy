package com.clenzy.service;

import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.repository.MessageTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageTemplateServiceTest {

    @Mock private MessageTemplateRepository templateRepository;

    private MessageTemplateService service;

    @BeforeEach
    void setUp() {
        service = new MessageTemplateService(templateRepository);
    }

    private static MessageTemplate checkInTemplate(String body) {
        MessageTemplate t = new MessageTemplate();
        t.setType(MessageTemplateType.CHECK_IN);
        t.setSubject("Bienvenue");
        t.setBody(body);
        return t;
    }

    @Test
    void ensureGuideLinkTag_templateMissingTag_appendsBlock() {
        MessageTemplate template = checkInTemplate("Bonjour {guestName}, voici les infos de votre séjour.");
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(7L, MessageTemplateType.CHECK_IN))
            .thenReturn(List.of(template));

        service.ensureGuideLinkTag(7L);

        assertThat(template.getBody()).contains("{guideLink}");
        assertThat(template.getBody()).contains("[Ouvrir mon livret d'accueil]({guideLink})");
        // L'ancien contenu est préservé (append non destructif).
        assertThat(template.getBody()).startsWith("Bonjour {guestName}, voici les infos de votre séjour.");
        verify(templateRepository).save(template);
    }

    @Test
    void ensureGuideLinkTag_templateAlreadyHasTag_noDoubleAppend() {
        String body = "Bonjour, votre livret : [ici]({guideLink}). Bon séjour.";
        MessageTemplate template = checkInTemplate(body);
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(7L, MessageTemplateType.CHECK_IN))
            .thenReturn(List.of(template));

        service.ensureGuideLinkTag(7L);

        // Idempotent : corps inchangé, pas de sauvegarde.
        assertThat(template.getBody()).isEqualTo(body);
        assertThat(occurrences(template.getBody(), "{guideLink}")).isEqualTo(1);
        verify(templateRepository, never()).save(any());
    }

    @Test
    void ensureGuideLinkTag_tagOnlyInSubject_noAppendToBody() {
        // Le tag peut être référencé dans le sujet : on considère le template couvert.
        MessageTemplate template = checkInTemplate("Corps sans tag.");
        template.setSubject("Votre livret {guideLink}");
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(7L, MessageTemplateType.CHECK_IN))
            .thenReturn(List.of(template));

        service.ensureGuideLinkTag(7L);

        assertThat(template.getBody()).isEqualTo("Corps sans tag.");
        verify(templateRepository, never()).save(any());
    }

    @Test
    void ensureGuideLinkTag_multipleTemplates_onlyMissingOnesUpdated() {
        MessageTemplate withTag = checkInTemplate("Lien : {guideLink}");
        MessageTemplate withoutTag = checkInTemplate("Aucun lien ici.");
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(7L, MessageTemplateType.CHECK_IN))
            .thenReturn(List.of(withTag, withoutTag));

        service.ensureGuideLinkTag(7L);

        assertThat(withoutTag.getBody()).contains("{guideLink}");
        verify(templateRepository).save(withoutTag);
        verify(templateRepository, never()).save(withTag);
    }

    @Test
    void ensureGuideLinkTag_nullOrg_noOp() {
        service.ensureGuideLinkTag(null);

        verify(templateRepository, never()).findByOrganizationIdAndTypeAndIsActiveTrue(any(), any());
        verify(templateRepository, never()).save(any());
    }

    @Test
    void ensureGuideLinkTag_noCheckInTemplate_noOp() {
        when(templateRepository.findByOrganizationIdAndTypeAndIsActiveTrue(7L, MessageTemplateType.CHECK_IN))
            .thenReturn(List.of());

        service.ensureGuideLinkTag(7L);

        verify(templateRepository, never()).save(any());
    }

    private static int occurrences(String haystack, String needle) {
        int count = 0;
        int idx = 0;
        while ((idx = haystack.indexOf(needle, idx)) != -1) {
            count++;
            idx += needle.length();
        }
        return count;
    }
}
