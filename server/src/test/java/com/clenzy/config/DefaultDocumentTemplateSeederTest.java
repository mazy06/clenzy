package com.clenzy.config;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentTemplateTag;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Organization;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.TemplateParserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link DefaultDocumentTemplateSeeder}.
 *
 * <p>On mocke les repositories, le parser et le PlatformTransactionManager.
 * Le {@code TransactionTemplate} construit dans le constructeur execute le
 * callback de maniere synchrone avec un manager mocke (getTransaction renvoie
 * null, commit est un no-op).</p>
 *
 * <p>Les ressources ODT reelles (src/main/resources : devis + facture) sont sur
 * le classpath de test : le chemin heureux valide donc aussi que les fichiers
 * embarques sont lisibles.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("DefaultDocumentTemplateSeeder")
class DefaultDocumentTemplateSeederTest {

    @Mock private DocumentTemplateRepository templateRepository;
    @Mock private DocumentTemplateTagRepository tagRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TemplateParserService templateParserService;
    @Mock private PlatformTransactionManager transactionManager;

    private DefaultDocumentTemplateSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new DefaultDocumentTemplateSeeder(templateRepository, tagRepository,
                organizationRepository, templateParserService, transactionManager);
        ReflectionTestUtils.setField(seeder, "enabled", true);
        ReflectionTestUtils.setField(seeder, "orgName", "Clenzy");
    }

    /** Rend le traitement d'un type neutre (template actif personnalise admin -> jamais touche). */
    private void stubTypeAsNoOp(DocumentType type) {
        DocumentTemplate custom = new DocumentTemplate();
        custom.setCreatedBy("admin-user");
        when(templateRepository.existsByDocumentTypeAndActiveTrue(type)).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(type)).thenReturn(Optional.of(custom));
    }

    @Test
    @DisplayName("run: feature flag desactive -> aucune interaction")
    void run_disabled_doesNothing() {
        ReflectionTestUtils.setField(seeder, "enabled", false);

        seeder.run(null);

        verifyNoInteractions(templateRepository, organizationRepository,
                tagRepository, templateParserService, transactionManager);
    }

    @Test
    @DisplayName("run: aucun template actif -> seede DEVIS et FACTURE")
    void run_noActiveTemplate_seedsBothTypes() {
        Organization org = org(42L);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, times(2)).save(captor.capture());
        List<DocumentType> seededTypes = captor.getAllValues().stream()
                .map(DocumentTemplate::getDocumentType).toList();
        assertThat(seededTypes).containsExactlyInAnyOrder(DocumentType.DEVIS, DocumentType.FACTURE);
        assertThat(captor.getAllValues()).allSatisfy(t -> {
            assertThat(t.getOrganizationId()).isEqualTo(42L);
            assertThat(t.isActive()).isTrue();
            assertThat(t.getCreatedBy()).isEqualTo("system-seed");
            assertThat(t.getFileContent()).isNotEmpty();
        });
        verify(tagRepository, times(2)).saveAll(anyList());
    }

    @Test
    @DisplayName("run: metadata du DEVIS seede (nom, fichier, type, actif)")
    void run_devisSeed_hasCorrectMetadata() {
        Organization org = org(7L);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(false);
        stubTypeAsNoOp(DocumentType.FACTURE); // isole le DEVIS
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        DocumentTemplateTag tag = new DocumentTemplateTag();
        when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of(tag));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository).save(captor.capture());
        DocumentTemplate saved = captor.getValue();
        assertThat(saved.getDocumentType()).isEqualTo(DocumentType.DEVIS);
        assertThat(saved.getName()).isEqualTo("Devis Clenzy");
        assertThat(saved.getOriginalFilename()).isEqualTo("Devis Clenzy.odt");
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getFileContent()).isNotEmpty();
        verify(tagRepository).saveAll(anyList());
        assertThat(tag.getTemplate()).isSameAs(saved);
    }

    @Test
    @DisplayName("run: organisation Clenzy introuvable -> aucun insert")
    void run_orgMissing_skips() {
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.empty());

        seeder.run(null);

        verify(templateRepository, never()).save(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: templates seed actifs au contenu different -> mis a jour (re-seed checksum), DEVIS + FACTURE")
    void run_seededTemplatesChanged_updateBoth() {
        DocumentTemplate devis = active(DocumentType.DEVIS, "system-seed", "ancien-devis");
        DocumentTemplate facture = active(DocumentType.FACTURE, "system-seed", "ancienne-facture");
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(Optional.of(devis));
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(Optional.of(facture));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(t -> {
            assertThat(t.getFileContent()).isNotEmpty();
            assertThat(t.getVersion()).isEqualTo(2);
        });
        assertThat(new String(devis.getFileContent())).isNotEqualTo("ancien-devis");
        assertThat(new String(facture.getFileContent())).isNotEqualTo("ancienne-facture");
        // Mise a jour de lignes existantes -> pas de nouvel insert (org/tags).
        verify(organizationRepository, never()).findByName(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: templates personnalises par un admin -> jamais ecrases")
    void run_customizedTemplates_notOverwritten() {
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS))
                .thenReturn(Optional.of(active(DocumentType.DEVIS, "admin-user", "perso-devis")));
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                .thenReturn(Optional.of(active(DocumentType.FACTURE, "admin-user", "perso-facture")));

        seeder.run(null);

        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("run: une erreur sur un type est isolee -> l'autre type est seede quand meme")
    void run_oneTypeFails_otherStillSeeded() {
        Organization org = org(99L);
        // DEVIS leve une exception, FACTURE doit quand meme etre seedee.
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.DEVIS))
                .thenThrow(new RuntimeException("DB down"));
        when(templateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getDocumentType()).isEqualTo(DocumentType.FACTURE);
    }

    private static DocumentTemplate active(DocumentType type, String createdBy, String content) {
        DocumentTemplate t = new DocumentTemplate();
        t.setDocumentType(type);
        t.setActive(true);
        t.setCreatedBy(createdBy);
        t.setFileContent(content.getBytes());
        t.setVersion(1);
        return t;
    }

    private static Organization org(Long id) {
        Organization org = new Organization();
        ReflectionTestUtils.setField(org, "id", id);
        return org;
    }
}
