package com.clenzy.service;

import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import com.clenzy.model.Prospect.ProspectCategory;
import com.clenzy.model.Prospect.ProspectStatus;
import com.clenzy.repository.ProspectRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests pour {@link ProspectService}.
 *
 * <p>Couvre les operations CRUD (read, update, delete), l'import CSV (parsing
 * avec quotes, headers flexibles, lignes sans nom skipees), la validation
 * d'ownership (cross-org access refuse), ainsi que les conversions de statut
 * et categorie.</p>
 */
@ExtendWith(MockitoExtension.class)
class ProspectServiceTest {

    @Mock private ProspectRepository prospectRepository;

    private TenantContext tenantContext;
    private ProspectService service;

    private static final Long ORG_ID = 100L;
    private static final Long OTHER_ORG_ID = 200L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new ProspectService(prospectRepository, tenantContext);
    }

    private Prospect buildProspect(Long id, String name, ProspectCategory cat) {
        Prospect p = new Prospect();
        p.setId(id);
        p.setName(name);
        p.setEmail(name.toLowerCase() + "@test.com");
        p.setCategory(cat);
        p.setStatus(ProspectStatus.TO_CONTACT);
        p.setOrganizationId(ORG_ID);
        p.setCity("Paris");
        p.setPhone("+33611111111");
        return p;
    }

    // ─── Read ───────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAll")
    class GetAll {

        @Test
        @DisplayName("returns all prospects for current tenant org")
        void returnsAllForCurrentOrg() {
            Prospect p1 = buildProspect(1L, "Acme", ProspectCategory.CONCIERGERIES);
            Prospect p2 = buildProspect(2L, "Beta", ProspectCategory.MENAGE);
            when(prospectRepository.findByOrganizationId(ORG_ID))
                    .thenReturn(List.of(p1, p2));

            List<ProspectDto> result = service.getAll();

            assertThat(result).hasSize(2);
            assertThat(result.get(0).name()).isEqualTo("Acme");
            assertThat(result.get(0).category()).isEqualTo("CONCIERGERIES");
            assertThat(result.get(1).name()).isEqualTo("Beta");
            assertThat(result.get(1).category()).isEqualTo("MENAGE");
        }

        @Test
        @DisplayName("returns empty list when no prospects")
        void returnsEmptyWhenNone() {
            when(prospectRepository.findByOrganizationId(ORG_ID))
                    .thenReturn(List.of());

            List<ProspectDto> result = service.getAll();

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when no org in context then throws IllegalStateException")
        void whenNoOrgInContext_thenThrows() {
            tenantContext.clear();

            assertThatThrownBy(() -> service.getAll())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("organisation");
        }
    }

    @Nested
    @DisplayName("getByCategory")
    class GetByCategory {

        @Test
        @DisplayName("returns prospects filtered by category")
        void returnsFilteredByCategory() {
            Prospect p1 = buildProspect(1L, "Acme", ProspectCategory.CONCIERGERIES);
            when(prospectRepository.findByOrganizationIdAndCategory(ORG_ID, ProspectCategory.CONCIERGERIES))
                    .thenReturn(List.of(p1));

            List<ProspectDto> result = service.getByCategory(ProspectCategory.CONCIERGERIES);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).category()).isEqualTo("CONCIERGERIES");
        }

        @Test
        @DisplayName("returns empty list when no prospects in category")
        void returnsEmptyForUnknownCategory() {
            when(prospectRepository.findByOrganizationIdAndCategory(ORG_ID, ProspectCategory.ARTISANS))
                    .thenReturn(List.of());

            List<ProspectDto> result = service.getByCategory(ProspectCategory.ARTISANS);

            assertThat(result).isEmpty();
        }
    }

    // ─── Update ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("updates all fields when provided")
        void updatesAllFields() {
            Prospect existing = buildProspect(1L, "Old Name", ProspectCategory.CONCIERGERIES);
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(prospectRepository.save(any(Prospect.class))).thenAnswer(inv -> inv.getArgument(0));

            ProspectDto dto = new ProspectDto(
                    1L, "New Name", "new@test.com", "+33622222222",
                    "Lyon", "Premium specialty", null, "IN_DISCUSSION",
                    "New notes", "https://newsite.com", "https://linkedin.com/new",
                    "5M-10M", "100-500");

            ProspectDto result = service.update(1L, dto);

            assertThat(result.name()).isEqualTo("New Name");
            assertThat(result.email()).isEqualTo("new@test.com");
            assertThat(result.phone()).isEqualTo("+33622222222");
            assertThat(result.city()).isEqualTo("Lyon");
            assertThat(result.specialty()).isEqualTo("Premium specialty");
            assertThat(result.status()).isEqualTo("IN_DISCUSSION");
            assertThat(result.notes()).isEqualTo("New notes");
            assertThat(result.website()).isEqualTo("https://newsite.com");
            assertThat(result.linkedIn()).isEqualTo("https://linkedin.com/new");
            assertThat(result.revenue()).isEqualTo("5M-10M");
            assertThat(result.employees()).isEqualTo("100-500");
        }

        @Test
        @DisplayName("preserves existing fields when dto fields are null")
        void preservesUnchangedFields() {
            Prospect existing = buildProspect(1L, "Keep Name", ProspectCategory.MENAGE);
            existing.setEmail("keep@test.com");
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(prospectRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // All nulls
            ProspectDto dto = new ProspectDto(
                    null, null, null, null, null, null, null,
                    null, null, null, null, null, null);

            ProspectDto result = service.update(1L, dto);

            assertThat(result.name()).isEqualTo("Keep Name");
            assertThat(result.email()).isEqualTo("keep@test.com");
            assertThat(result.status()).isEqualTo("TO_CONTACT");
        }

        @Test
        @DisplayName("converts status string to enum")
        void convertsStatusString() {
            Prospect existing = buildProspect(1L, "X", ProspectCategory.MENAGE);
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(prospectRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ProspectDto dto = new ProspectDto(
                    1L, null, null, null, null, null, null,
                    "PARTNER", null, null, null, null, null);

            ProspectDto result = service.update(1L, dto);

            assertThat(result.status()).isEqualTo("PARTNER");
        }

        @Test
        @DisplayName("when invalid status string then throws IllegalArgumentException")
        void whenInvalidStatus_thenThrows() {
            Prospect existing = buildProspect(1L, "X", ProspectCategory.MENAGE);
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(existing));

            ProspectDto dto = new ProspectDto(
                    1L, null, null, null, null, null, null,
                    "INVALID_STATUS", null, null, null, null, null);

            assertThatThrownBy(() -> service.update(1L, dto))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when prospect not found then throws IllegalArgumentException")
        void whenNotFound_thenThrows() {
            when(prospectRepository.findById(999L)).thenReturn(Optional.empty());

            ProspectDto dto = new ProspectDto(
                    999L, "X", null, null, null, null, null,
                    null, null, null, null, null, null);

            assertThatThrownBy(() -> service.update(999L, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Prospect introuvable");
        }

        @Test
        @DisplayName("when prospect from different org then throws SecurityException (cross-tenant)")
        void whenCrossOrg_thenThrowsSecurity() {
            Prospect foreign = buildProspect(1L, "Foreign", ProspectCategory.ARTISANS);
            foreign.setOrganizationId(OTHER_ORG_ID);  // belongs to another tenant
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(foreign));

            ProspectDto dto = new ProspectDto(
                    1L, "Hijack", null, null, null, null, null,
                    null, null, null, null, null, null);

            assertThatThrownBy(() -> service.update(1L, dto))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Acces refuse");

            verify(prospectRepository, never()).save(any());
        }
    }

    // ─── Delete ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("deletes prospect when ownership valid")
        void deletesValid() {
            Prospect p = buildProspect(1L, "X", ProspectCategory.MENAGE);
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(p));

            service.delete(1L);

            // Cast required: JpaSpecificationExecutor adds a delete(Specification) overload
            // making verify(repo).delete(p) ambiguous on Prospect.
            verify(prospectRepository).delete((Prospect) p);
        }

        @Test
        @DisplayName("when prospect not found then throws IllegalArgumentException")
        void whenNotFound_thenThrows() {
            when(prospectRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Prospect introuvable");
        }

        @Test
        @DisplayName("when prospect from different org then throws SecurityException")
        void whenCrossOrg_thenThrowsSecurity() {
            Prospect foreign = buildProspect(1L, "X", ProspectCategory.MENAGE);
            foreign.setOrganizationId(OTHER_ORG_ID);
            when(prospectRepository.findById(1L)).thenReturn(Optional.of(foreign));

            assertThatThrownBy(() -> service.delete(1L))
                    .isInstanceOf(SecurityException.class);

            verify(prospectRepository, never()).delete(any(Prospect.class));
        }
    }

    // ─── CSV Import ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("importFromCsv")
    class ImportFromCsv {

        @Test
        @DisplayName("imports prospects with standard headers")
        void importsStandardHeaders() throws IOException {
            String csv =
                    "business_name,email,phone,city,linkedin_categories,domain,linkedin_url,revenue_range,number_of_employees_range\n" +
                    "Acme Corp,contact@acme.com,+33612345678,Paris,Conciergerie premium,acme.com,https://linkedin.com/company/acme,1M-5M,10-50\n" +
                    "Beta Cleaning,hello@beta.com,+33687654321,Lyon,Menage,https://beta.com,https://linkedin.com/in/beta,500K-1M,5-10\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.CONCIERGERIES);

            assertThat(imported).isEqualTo(2);
            List<Prospect> saved = captor.getValue();
            assertThat(saved).hasSize(2);

            Prospect p1 = saved.get(0);
            assertThat(p1.getName()).isEqualTo("Acme Corp");
            assertThat(p1.getEmail()).isEqualTo("contact@acme.com");
            assertThat(p1.getPhone()).isEqualTo("+33612345678");
            assertThat(p1.getCity()).isEqualTo("Paris");
            assertThat(p1.getSpecialty()).isEqualTo("Conciergerie premium");
            assertThat(p1.getCategory()).isEqualTo(ProspectCategory.CONCIERGERIES);
            assertThat(p1.getStatus()).isEqualTo(ProspectStatus.TO_CONTACT);
            assertThat(p1.getOrganizationId()).isEqualTo(ORG_ID);
            // domain "acme.com" not http → should be prefixed
            assertThat(p1.getWebsite()).isEqualTo("https://acme.com");
            assertThat(p1.getLinkedIn()).isEqualTo("https://linkedin.com/company/acme");
            assertThat(p1.getRevenue()).isEqualTo("1M-5M");
            assertThat(p1.getEmployees()).isEqualTo("10-50");

            // Second row: domain already starts with https
            assertThat(saved.get(1).getWebsite()).isEqualTo("https://beta.com");
        }

        @Test
        @DisplayName("supports alternate header names (name, company_email, contact_email)")
        void supportsAlternateHeaders() throws IOException {
            String csv =
                    "name,contact_email,phone_number,headquarters_city,industry,website,linkedin,annual_revenue,employee_count\n" +
                    "Gamma SARL,info@gamma.com,0102030405,Marseille,Maintenance,gamma.com,linkedin.com/gamma,2M,20-100\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.ARTISANS);

            assertThat(imported).isEqualTo(1);
            Prospect p = captor.getValue().get(0);
            assertThat(p.getName()).isEqualTo("Gamma SARL");
            assertThat(p.getEmail()).isEqualTo("info@gamma.com");
            assertThat(p.getPhone()).isEqualTo("0102030405");
            assertThat(p.getCity()).isEqualTo("Marseille");
            assertThat(p.getSpecialty()).isEqualTo("Maintenance");
            assertThat(p.getWebsite()).isEqualTo("https://gamma.com");
            assertThat(p.getLinkedIn()).isEqualTo("linkedin.com/gamma");
            assertThat(p.getEmployees()).isEqualTo("20-100");
        }

        @Test
        @DisplayName("skips rows without business name")
        void skipsRowsWithoutName() throws IOException {
            String csv =
                    "business_name,email\n" +
                    "Acme,a@a.com\n" +
                    ",noname@x.com\n" +              // empty name → skip
                    "Beta,b@b.com\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(imported).isEqualTo(2);
            assertThat(captor.getValue()).extracting(Prospect::getName)
                    .containsExactly("Acme", "Beta");
        }

        @Test
        @DisplayName("skips blank lines")
        void skipsBlankLines() throws IOException {
            String csv =
                    "business_name,email\n" +
                    "Acme,a@a.com\n" +
                    "\n" +                            // blank line → skip
                    "Beta,b@b.com\n" +
                    "   \n" +                         // whitespace-only → skip
                    "Gamma,g@g.com\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(imported).isEqualTo(3);
        }

        @Test
        @DisplayName("handles values inside quotes (preserves commas)")
        void handlesQuotedValues() throws IOException {
            String csv =
                    "business_name,linkedin_categories\n" +
                    "\"Acme, Inc.\",\"Cleaning, Maintenance, Garden\"\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(imported).isEqualTo(1);
            Prospect p = captor.getValue().get(0);
            assertThat(p.getName()).isEqualTo("Acme, Inc.");
            assertThat(p.getSpecialty()).isEqualTo("Cleaning, Maintenance, Garden");
        }

        @Test
        @DisplayName("treats 'null' string value as empty")
        void treatsNullStringAsEmpty() throws IOException {
            String csv =
                    "business_name,email,city\n" +
                    "Acme,null,Paris\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            int imported = service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(imported).isEqualTo(1);
            Prospect p = captor.getValue().get(0);
            // "null" literal should be treated as null
            assertThat(p.getEmail()).isNull();
            assertThat(p.getCity()).isEqualTo("Paris");
        }

        @Test
        @DisplayName("when empty CSV then throws IllegalArgumentException")
        void whenEmptyCsv_thenThrows() throws IOException {
            MultipartFile file = csvFile("");

            assertThatThrownBy(() -> service.importFromCsv(file, ProspectCategory.MENAGE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }

        @Test
        @DisplayName("when only header then imports 0 (no rows saved)")
        void whenOnlyHeader_then0Imported() throws IOException {
            MultipartFile file = csvFile("business_name,email\n");

            int imported = service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(imported).isEqualTo(0);
            // No save invocation since nothing to insert
            verify(prospectRepository, never()).saveAll(anyList());
        }

        @Test
        @DisplayName("when file IO fails then wraps in RuntimeException")
        void whenIOError_thenWrapsInRuntime() throws IOException {
            MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
            when(file.getInputStream()).thenThrow(new IOException("Disk read error"));

            assertThatThrownBy(() -> service.importFromCsv(file, ProspectCategory.MENAGE))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("lecture du fichier CSV");
        }

        @Test
        @DisplayName("uses default category for all rows")
        void usesProvidedCategory() throws IOException {
            String csv = "business_name,email\nAcme,a@a.com\nBeta,b@b.com\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.importFromCsv(file, ProspectCategory.BLANCHISSERIES);

            assertThat(captor.getValue()).allMatch(p -> p.getCategory() == ProspectCategory.BLANCHISSERIES);
        }

        @Test
        @DisplayName("rows have status TO_CONTACT by default")
        void allRowsHaveDefaultStatus() throws IOException {
            String csv = "business_name\nAcme\n";

            MultipartFile file = csvFile(csv);
            ArgumentCaptor<List<Prospect>> captor = listCaptor();
            when(prospectRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.importFromCsv(file, ProspectCategory.MENAGE);

            assertThat(captor.getValue().get(0).getStatus()).isEqualTo(ProspectStatus.TO_CONTACT);
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private MultipartFile csvFile(String content) throws IOException {
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        InputStream stream = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
        when(file.getInputStream()).thenReturn(stream);
        return file;
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<Prospect>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
