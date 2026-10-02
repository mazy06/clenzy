package com.clenzy.service.compliance;

import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class PoliceFormPdfServiceTest {

    @Mock private GuestDeclarationRepository declarationRepository;
    @Mock private PropertyLicenseRepository licenseRepository;
    @Mock private OrganizationAccessGuard accessGuard;
    @Mock private TenantContext tenantContext;
    @Mock private AuditLogService auditLogService;

    private PoliceFormPdfService service() {
        return new PoliceFormPdfService(declarationRepository, licenseRepository, accessGuard, tenantContext,
                auditLogService);
    }

    private GuestDeclaration declaration(Reservation r, boolean primary, String first, String birth,
                                         String nationality, boolean exempt) {
        GuestDeclaration d = new GuestDeclaration();
        d.setReservation(r);
        d.setPrimary(primary);
        d.setCountryCode("FR");
        d.setFirstName(first);
        d.setLastName("Smith");
        d.setBirthDate(birth);
        d.setNationality(nationality);
        d.setExempt(exempt);
        return d;
    }

    private static String text(byte[] pdf) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (PdfDocument doc = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf)))) {
            for (int i = 1; i <= doc.getNumberOfPages(); i++) {
                sb.append(PdfTextExtractor.getTextFromPage(doc.getPage(i)));
            }
        }
        return sb.toString();
    }

    @Test
    void render_onePagePerAdult_childOnParentForm_exemptExcluded() throws IOException {
        Property p = new Property();
        p.setId(1L);
        p.setName("Studio Marais");
        Reservation r = new Reservation();
        r.setId(5L);
        r.setOrganizationId(1L);
        r.setProperty(p);
        r.setCheckIn(LocalDate.of(2026, 7, 10));
        r.setCheckOut(LocalDate.of(2026, 7, 17));
        GuestDeclaration adult = declaration(r, true, "John", "1985-03-02", "GB", false);
        adult.setSignedAt(LocalDateTime.of(2026, 7, 9, 18, 30));
        GuestDeclaration child = declaration(r, false, "Lily", "2016-01-01", "GB", false);
        GuestDeclaration french = declaration(r, false, "Pierre", null, "FR", true);

        String text = text(service().render(List.of(adult, child, french)));

        assertThat(text).contains("FICHE INDIVIDUELLE DE POLICE").contains("John").contains("Lily")
                .contains("10/07/2026").contains("certifiée exacte");
        assertThat(text).doesNotContain("Pierre"); // ressortissant français : pas de fiche
    }

    @Test
    void register_rejectsPeriodsLongerThanAYear() {
        assertThatThrownBy(() -> service().register(1L, LocalDate.of(2025, 1, 1), LocalDate.of(2026, 6, 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
