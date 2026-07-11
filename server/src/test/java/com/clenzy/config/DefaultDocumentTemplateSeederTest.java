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
import java.util.Set;

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
 * Tests unitaires pour {@link DefaultDocumentTemplateSeeder} (9 templates systeme).
 *
 * <p>On mocke les repositories, le parser et le PlatformTransactionManager.
 * Le {@code TransactionTemplate} construit dans le constructeur execute le
 * callback de maniere synchrone avec un manager mocke.</p>
 *
 * <p>Z1-BUGS-07 : le seeder est desormais org-scope — il resout d'abord
 * l'organisation Clenzy puis ne considere que SES templates actifs (via
 * {@code findByDocumentTypeOrderByVersionDesc} filtre par org), sans etre
 * perturbe par les templates actifs des autres organisations.</p>
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
            DocumentType.DEVIS, DocumentType.DEVIS_MENAGE, DocumentType.FACTURE,
            DocumentType.AUTORISATION_TRAVAUX, DocumentType.BON_INTERVENTION,
            DocumentType.JUSTIFICATIF_PAIEMENT, DocumentType.JUSTIFICATIF_REMBOURSEMENT,
            DocumentType.MANDAT_GESTION, DocumentType.VALIDATION_FIN_MISSION
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
    @DisplayName("run: aucun template actif -> seede les 9 types configures, org Clenzy, actifs")
    void run_noActiveTemplate_seedsAllConfiguredTypes() {
        Organization org = org(42L);
        stubNoTemplates();
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
        stubNoTemplates();
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
        stubNoTemplates();
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.empty());

        seeder.run(null);

        verify(templateRepository, never()).save(any());
        verify(tagRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("run: un actif du meme type dans une AUTRE org -> seed Clenzy quand meme (Z1-BUGS-07)")
    void run_activeTemplateInOtherOrg_doesNotSuppressClenzySeed() {
        Organization org = org(42L);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        // Toutes les recherches par type retournent un actif d'une autre org (id 777) :
        // l'ancien exists/find global aurait saute le seed (voire leve
        // IncorrectResultSizeDataAccessException avec 2 actifs).
        for (DocumentType type : ALL_TYPES) {
            when(templateRepository.findByDocumentTypeOrderByVersionDesc(type))
                    .thenReturn(List.of(active(type, "system-seed", "other-org", 777L)));
        }
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, times(ALL_TYPES.length)).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(t ->
                assertThat(t.getOrganizationId()).isEqualTo(42L));
    }

    @Test
    @DisplayName("run: contenu different -> rendu MAJ + tags re-parses (DEVIS + FACTURE)")
    void run_seededTemplatesChanged_updateBoth() {
        Organization org = org(42L);
        DocumentTemplate devis = active(DocumentType.DEVIS, "system-seed", "ancien-devis", 42L);
        DocumentTemplate facture = active(DocumentType.FACTURE, "system-seed", "ancienne-facture", 42L);
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(DocumentType.DEVIS))
                .thenReturn(List.of(devis));
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(DocumentType.FACTURE))
                .thenReturn(List.of(facture));
        // Les autres types ont un actif PERSONNALISE (jamais re-parse ni ecrase).
        stubTypesAsCustomActive(42L, Set.of(DocumentType.DEVIS, DocumentType.FACTURE));
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
        // Tags re-parses sur les 2 templates seedes uniquement (pas les personnalises).
        verify(templateParserService, times(2)).parseTemplate(any(byte[].class));
        assertThat(devis.getTags()).extracting(DocumentTemplateTag::getTagName).containsExactly("intervention.lignes");
        assertThat(facture.getTags()).extracting(DocumentTemplateTag::getTagName).containsExactly("intervention.lignes");
        // Aucun nouvel insert (persistTags n'est appele que sur le chemin seed).
        verify(tagRepository, never()).saveAll(anyList());
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
        facture.setOrganizationId(42L);
        facture.setFileContent(bundled); // MEME contenu -> checksum identique
        facture.setVersion(1);
        DocumentTemplateTag stale = new DocumentTemplateTag();
        stale.setTagName("client.email"); // tags d'origine incomplets : manque intervention.lignes
        facture.setTags(new java.util.ArrayList<>(List.of(stale)));

        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org(42L)));
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(DocumentType.FACTURE))
                .thenReturn(List.of(facture));
        stubTypesAsCustomActive(42L, Set.of(DocumentType.FACTURE));
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
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org(42L)));
        stubTypesAsCustomActive(42L, Set.of());

        seeder.run(null);

        verify(templateRepository, never()).save(any());
    }

    @Test
    @DisplayName("run: une erreur sur un type est isolee -> les autres types restent traites")
    void run_oneTypeFails_othersStillProcessed() {
        Organization org = org(99L);
        // DEVIS leve, FACTURE n'a aucun actif -> seede, les autres ont un actif
        // personnalise -> no-op.
        when(organizationRepository.findByName("Clenzy")).thenReturn(Optional.of(org));
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(DocumentType.DEVIS))
                .thenThrow(new RuntimeException("DB down"));
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(DocumentType.FACTURE))
                .thenReturn(List.of());
        stubTypesAsCustomActive(99L, Set.of(DocumentType.DEVIS, DocumentType.FACTURE));
        when(templateRepository.save(any(DocumentTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(templateParserService.parseTemplate(any(byte[].class)))
                .thenAnswer(inv -> List.of(new DocumentTemplateTag()));

        seeder.run(null);

        ArgumentCaptor<DocumentTemplate> captor = ArgumentCaptor.forClass(DocumentTemplate.class);
        verify(templateRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getDocumentType()).isEqualTo(DocumentType.FACTURE);
    }

    /** Aucun template existant, quel que soit le type. */
    private void stubNoTemplates() {
        when(templateRepository.findByDocumentTypeOrderByVersionDesc(any())).thenReturn(List.of());
    }

    /** Tous les types hors {@code except} ont un actif PERSONNALISE dans l'org donnee. */
    private void stubTypesAsCustomActive(Long organizationId, Set<DocumentType> except) {
        for (DocumentType type : ALL_TYPES) {
            if (!except.contains(type)) {
                when(templateRepository.findByDocumentTypeOrderByVersionDesc(type))
                        .thenReturn(List.of(active(type, "admin-user", "custom-" + type, organizationId)));
            }
        }
    }

    private static DocumentTemplate active(DocumentType type, String createdBy, String content, Long organizationId) {
        DocumentTemplate t = new DocumentTemplate();
        t.setDocumentType(type);
        t.setActive(true);
        t.setCreatedBy(createdBy);
        t.setOrganizationId(organizationId);
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
