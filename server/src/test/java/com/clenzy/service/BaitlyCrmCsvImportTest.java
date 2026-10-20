package com.clenzy.service;
import com.clenzy.model.Prospect;
import com.clenzy.repository.ProspectRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
class BaitlyCrmCsvImportTest {
    private final List<Prospect> rows=new ArrayList<>();
    ProspectRepository repository;TenantContext tenant;BaitlyCrmCsvImport importer;
    @BeforeEach void setup() {
        repository=mock(ProspectRepository.class);tenant=new TenantContext();tenant.setOrganizationId(10L);
        when(repository.findIdentityMatches(anyLong(),any(),any())).thenAnswer(call->rows.stream()
            .filter(p->Objects.equals(p.getOrganizationId(),call.getArgument(0)))
            .filter(p->(p.getNormalizedEmail()!=null && Objects.equals(p.getNormalizedEmail(),call.getArgument(1)))
                || (p.getNormalizedPhone()!=null && Objects.equals(p.getNormalizedPhone(),call.getArgument(2)))).toList());
        when(repository.saveAndFlush(any())).thenAnswer(call->{ Prospect p=call.getArgument(0);p.setId((long)rows.size()+1);rows.add(p);return p; });
        importer=new BaitlyCrmCsvImport(repository,new ProspectService(repository,tenant));
    }
    @AfterEach void cleanup() { tenant.clear(); }
    @Test void replayAndWithinFileDuplicatesDoNotOverwriteRecords() {
        var report=run("name,email,phone\nAlice, ALICE@example.com ,+33612345678\nAutre nom,alice@example.com,+33699999999\n");
        assertThat(report.imported()).isEqualTo(1);assertThat(report.duplicates()).isEqualTo(1);
        assertThat(run("name,email\nAlice,alice@example.com\n").duplicates()).isEqualTo(1);
        assertThat(rows.get(0).getName()).isEqualTo("Alice");
        assertThat(rows.get(0).getContactNature()).isEqualTo("UNKNOWN");
        assertThat(rows.get(0).getSourceType()).isEqualTo("CSV");
    }
    @Test void readsBomSemicolonsEscapedQuotesAndMultilineFields() {
        var report=run("\uFEFFname;email;notes\n\"Alice \"\"Lyon\"\"\";alice@example.com;\"Première ligne\nDeuxième ligne\"\n");
        assertThat(report.imported()).isEqualTo(1);
        assertThat(rows.get(0).getName()).isEqualTo("Alice \"Lyon\"");
        assertThat(rows.get(0).getNotes()).contains("Deuxième ligne");
    }
    @Test void reportsInvalidContactsWithoutTheirCoordinates() {
        var report=run("business_name,email\n,absent@example.com\nAlice,invalide\nBob,bob@example.com\n");
        assertThat(report.imported()).isEqualTo(1);assertThat(report.invalid()).isEqualTo(2);
        assertThat(report.issues()).extracting(BaitlyCrmCsvImport.Issue::reason).containsOnly("INVALID_CONTACT");
    }
    @Test void sameContactMayExistIndependentlyInAnotherOrganization() {
        var foreign=ProspectServiceTest.contact(99,20,"alice@example.com");rows.add(foreign);
        assertThat(run("name,email\nAlice,alice@example.com\n").imported()).isEqualTo(1);
    }
    private BaitlyCrmCsvImport.Report run(String csv) {
        return importer.run(new MockMultipartFile("file","contacts.csv","text/csv",csv.getBytes(StandardCharsets.UTF_8)),
            Prospect.ProspectCategory.OWNERS,10,"Recommandations volontaires");
    }
}
