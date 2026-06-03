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
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link DefaultDocumentTemplateSeeder} (8 templates systeme).
 *
 * <p>On mocke les repositories, le parser et le PlatformTransactionManager.
 * Le {@code TransactionTemplate} construit dans le constructeur execute le
 * callback de maniere synchrone avec un manager mocke.</p>
 *
 * <p>Les ressources ODT reelles (src/main/resources) sont sur le classpath de
 * test : le chemin heureux valide donc aussi que les fichiers embarques sont
 * lisibles.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("DefaultDocumentTemplateSeeder")
class DefaultDocumentTemplateSeederTest {

    private static final DocumentType[] ALL_TYPES = {
            DocumentType.DEVIS, DocumentType.FACTURE, DocumentType.AUTORISATION_TRAVAUX,
            DocumentType.BON_INTERVENTION, DocumentType.JUSTIFICATIF_PAIEMENT,
            DocumentType.JUSTIFICATIF_REMBOURSEMENT, DocumentType.MANDAT_GESTION,
            DocumentType.VALIDATION_FIN_MISSION
    };

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

    @Test
    @DisplayName("run: feature flag desactive -> aucune interaction")
    void run_disabled_doesNothing() {
        ReflectionTestUtils.setField(seeder, "enabled", false);

        seeder.run(null);

        verifyNoInteractions(templateRepository, organizationRepository,
                tagRepository, templateParserService, transactionManager);
    }

    @Test
    @DisplayName("run: aucun template actif -> seede les 8 types configures, org Clenzy, actifs")
    void run_noActiveTemplate_seedsAllConfiguredTypes() {
        Organization org = org(42L);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues()).map(DocumentTemplate::getDocumentType)
                .containsExactlyInAnyOrder(ALL_TYPES);
        assertThat(captor.getAllValues()).allSatisfy(t -> {
            assertThat(t.getOrganizationId()).isEqualTo(42L);
            assertThat(t.isActive()).isTrue();
            assertThat(t.getCreatedBy()).isEqualTo("system-seed");
            assertThat(t.getFileContent()).isNotEmpty();
        });
        verify(tagRepository, times(ALL_TYPES.length)).saveAll(anyList());
    }

    @Test
    @DisplayName("run: metadata du DEVIS seede (nom, fichier, type, actif)")
    void run_devisSeed_hasCorrectMetadata() {
        Organization org = org(7L);
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(false);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, atLeastOnce()).save(captor.capture());
        DocumentTemplate devis = captor.getAllValues().stream()
                .filter(t -> t.getDocumentType() == DocumentType.DEVIS).findFirst().orElseThrow();
        assertThat(devis.getName()).isEqualTo("Devis Clenzy");
        assertThat(devis.getOriginalFilename()).isEqualTo("Devis Clenzy.odt");
        assertThat(devis.isActive()).isTrue();
        assertThat(devis.getFileContent()).isNotEmpty();
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
    @DisplayName("run: contenu different -> rendu MAJ + tags re-parses (DEVIS + FACTURE)")
    void run_seededTemplatesChanged_updateBoth() {
        DocumentTemplate devis = active(DocumentType.DEVIS, "system-seed", "ancien-devis");
        DocumentTemplate facture = active(DocumentType.FACTURE, "system-seed", "ancienne-facture");
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS)).thenReturn(Optional.of(devis));
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(Optional.of(facture));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class))).thenAnswer(inv -> {
            DocumentTemplateTag t = new DocumentTemplateTag();
            t.setTagName("intervention.lignes");
            return List.of(t);
        });

        seeder.run(null);

        // Contenu remplace + version bumpee.
        assertThat(new String(devis.getFileContent())).isNotEqualTo("ancien-devis");
        assertThat(devis.getVersion()).isEqualTo(2);
        assertThat(new String(facture.getFileContent())).isNotEqualTo("ancienne-facture");
        assertThat(facture.getVersion()).isEqualTo(2);
        // Tags re-parses sur les 2 templates (corrige les tags incomplets du seed 0163).
        verify(templateParserService, times(2)).parseTemplate(any(byte[].class));
        assertThat(devis.getTags()).extracting(DocumentTemplateTag::getTagName).containsExactly("intervention.lignes");
        assertThat(facture.getTags()).extracting(DocumentTemplateTag::getTagName).containsExactly("intervention.lignes");
        // Les autres types n'ont pas de template actif stubbe -> Optional.empty -> aucun insert.
        verify(organizationRepository, never()).findByName(any());
    }

    @Test
    @DisplayName("run: meme contenu mais tags obsoletes -> re-parse quand meme (auto-reparation)")
    void run_sameContentStaleTags_reparses() throws Exception {
        byte[] bundled;
        try (java.io.InputStream is = new org.springframework.core.io.ClassPathResource(
                "seed/document-templates/facture-clenzy.odt").getInputStream()) {
            bundled = is.readAllBytes();
        }
        DocumentTemplate facture = new DocumentTemplate();
        facture.setDocumentType(DocumentType.FACTURE);
        facture.setActive(true);
        facture.setCreatedBy("system-seed");
        facture.setFileContent(bundled); // MEME contenu -> checksum identique
        facture.setVersion(1);
        DocumentTemplateTag stale = new DocumentTemplateTag();
        stale.setTagName("client.email"); // tags d'origine incomplets : manque intervention.lignes
        facture.setTags(new java.util.ArrayList<>(List.of(stale)));

        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(true);
        when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(Optional.of(facture));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        DocumentTemplateTag t1 = new DocumentTemplateTag();
        t1.setTagName("client.email");
        DocumentTemplateTag t2 = new DocumentTemplateTag();
        t2.setTagName("intervention.lignes");
        when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of(t1, t2));

        seeder.run(null);

        // Contenu inchange -> pas de bump version, mais tags re-synchronises (intervention.lignes ajoute).
        assertThat(facture.getVersion()).isEqualTo(1);
        assertThat(facture.getTags()).extracting(DocumentTemplateTag::getTagName)
                .containsExactlyInAnyOrder("client.email", "intervention.lignes");
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
    @DisplayName("run: une erreur sur un type est isolee -> les autres types restent traites")
    void run_oneTypeFails_othersStillProcessed() {
        Organization org = org(99L);
        // Defaut : tous "existent" -> no-op (findBy vide). On force DEVIS a lever, FACTURE a seeder.
        when(templateRepository.existsByDocumentTypeAndActiveTrue(any())).thenReturn(true);
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
