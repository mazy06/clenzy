package com.clenzy.service.compliance;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyLicense;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.PropertyLicenseRepository;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.AreaBreak;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.AreaBreakType;
import com.itextpdf.layout.properties.UnitValue;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fiche individuelle de police (France, CESEDA R814-1 a R814-3) au format PDF.
 *
 * <p>En France la fiche n'est PAS teletransmise : l'exploitant la conserve six mois et la
 * remet aux services de police ou de gendarmerie qui la demandent. Ce service produit
 * cette piece : une page par voyageur etranger (principal ou accompagnant adulte), les
 * enfants de moins de 15 ans figurant sur la fiche de l'adulte (R814-1), et le registre
 * d'un logement sur une periode pour repondre a une requisition.</p>
 *
 * <p>Chaque generation est tracee au journal d'audit (export de donnees personnelles).
 * Les ressortissants dispenses n'y figurent pas.</p>
 */
@Service
public class PoliceFormPdfService {

    private static final DateTimeFormatter FR_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FR_DATETIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    /** Une requisition porte sur une periode ; au-dela d'un an on refuse l'export de masse. */
    static final int MAX_REGISTER_DAYS = 366;

    private final GuestDeclarationRepository declarationRepository;
    private final PropertyLicenseRepository licenseRepository;
    private final OrganizationAccessGuard accessGuard;
    private final TenantContext tenantContext;
    private final AuditLogService auditLogService;

    public PoliceFormPdfService(GuestDeclarationRepository declarationRepository,
                                PropertyLicenseRepository licenseRepository,
                                OrganizationAccessGuard accessGuard,
                                TenantContext tenantContext,
                                AuditLogService auditLogService) {
        this.declarationRepository = declarationRepository;
        this.licenseRepository = licenseRepository;
        this.accessGuard = accessGuard;
        this.tenantContext = tenantContext;
        this.auditLogService = auditLogService;
    }

    /** Fiches d'une reservation (organisation verifiee fiche par fiche). */
    @Transactional(readOnly = true)
    public byte[] forReservation(Long reservationId) {
        List<GuestDeclaration> declarations = declarationRepository.findByReservationIdOrderByIdAsc(reservationId);
        declarations.forEach(d -> accessGuard.requireSameOrganization(
                d.getOrganizationId(), "Déclaration hors de votre organisation"));
        byte[] pdf = render(declarations);
        audit("reservation " + reservationId, declarations.size());
        return pdf;
    }

    /** Registre d'un logement : fiches des sejours chevauchant {@code [from, to]}. */
    @Transactional(readOnly = true)
    public byte[] register(Long propertyId, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)
                || ChronoUnit.DAYS.between(from, to) > MAX_REGISTER_DAYS) {
            throw new IllegalArgumentException("Période invalide : au plus " + MAX_REGISTER_DAYS + " jours.");
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<GuestDeclaration> declarations = declarationRepository.findForRegister(orgId, propertyId, from, to);
        byte[] pdf = render(declarations);
        audit("logement " + propertyId + " du " + from + " au " + to, declarations.size());
        return pdf;
    }

    /** Une page par adulte non dispense ; ses mineurs accompagnants y sont rattaches. */
    byte[] render(List<GuestDeclaration> declarations) {
        Map<Long, List<GuestDeclaration>> byReservation = new LinkedHashMap<>();
        for (GuestDeclaration d : declarations) {
            if (d.isExempt() || d.getReservation() == null) {
                continue;
            }
            byReservation.computeIfAbsent(d.getReservation().getId(), k -> new ArrayList<>()).add(d);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(out));
             Document doc = new Document(pdf, PageSize.A4)) {
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            doc.setFont(regular).setFontSize(10);
            boolean first = true;
            if (byReservation.isEmpty()) {
                doc.add(new Paragraph("Aucune fiche individuelle de police sur cette période "
                        + "(voyageurs dispensés ou aucune déclaration).").setFont(bold));
            }
            for (List<GuestDeclaration> stay : byReservation.values()) {
                Reservation reservation = stay.get(0).getReservation();
                List<GuestDeclaration> minors = new ArrayList<>();
                List<GuestDeclaration> adults = new ArrayList<>();
                DeclarationRules rules = DeclarationRules.forCountry(stay.get(0).getCountryCode(),
                        reservation.getCheckIn());
                for (GuestDeclaration d : stay) {
                    (!d.isPrimary() && rules.isMinor(d.getBirthDate()) ? minors : adults).add(d);
                }
                for (int i = 0; i < adults.size(); i++) {
                    if (!first) {
                        doc.add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                    }
                    first = false;
                    // Les mineurs vont sur la fiche du voyageur principal (ou du premier adulte).
                    renderForm(doc, bold, reservation, adults.get(i), i == 0 ? minors : List.of());
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Génération de la fiche de police impossible", e);
        }
        return out.toByteArray();
    }

    private void renderForm(Document doc, PdfFont bold, Reservation reservation,
                            GuestDeclaration d, List<GuestDeclaration> minors) {
        doc.add(new Paragraph("FICHE INDIVIDUELLE DE POLICE").setFont(bold).setFontSize(15).setMarginBottom(0));
        doc.add(new Paragraph("Individual police registration form — CESEDA, art. R814-1 à R814-3")
                .setFontSize(8).setMarginTop(0).setMarginBottom(12));

        Property property = reservation.getProperty();
        Table establishment = table();
        row(establishment, bold, "Établissement / Accommodation", property != null ? property.getName() : null);
        row(establishment, bold, "Adresse / Address",
                property != null && property.getAddress() != null ? property.getFullAddress() : null);
        row(establishment, bold, "N° d'enregistrement / Registration no.", registrationOf(reservation));
        doc.add(establishment.setMarginBottom(12));

        Table traveller = table();
        row(traveller, bold, "Nom / Surname", d.getLastName());
        row(traveller, bold, "Nom de naissance / Birth name", d.getMaidenName());
        row(traveller, bold, "Prénoms / Given names", d.getFirstName());
        row(traveller, bold, "Date de naissance / Date of birth", isoToFr(d.getBirthDate()));
        row(traveller, bold, "Lieu de naissance / Place of birth", d.getBirthPlace());
        row(traveller, bold, "Nationalité / Nationality", d.getNationality());
        row(traveller, bold, "Domicile habituel / Usual address",
                join(d.getResidenceAddress(), d.getResidenceCountry()));
        row(traveller, bold, "Téléphone mobile / Mobile phone", d.getPhone());
        row(traveller, bold, "Courriel / Email", d.getEmail());
        row(traveller, bold, "Date d'arrivée / Arrival", fmt(reservation.getCheckIn()));
        row(traveller, bold, "Départ prévu / Expected departure", fmt(reservation.getCheckOut()));
        doc.add(traveller.setMarginBottom(12));

        if (!minors.isEmpty()) {
            doc.add(new Paragraph("Enfants de moins de 15 ans accompagnant le voyageur / Children under 15")
                    .setFont(bold));
            Table children = new Table(UnitValue.createPercentArray(new float[]{2, 2, 1, 1}))
                    .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(12);
            for (GuestDeclaration m : minors) {
                children.addCell(cell(m.getLastName()));
                children.addCell(cell(m.getFirstName()));
                children.addCell(cell(isoToFr(m.getBirthDate())));
                children.addCell(cell(m.getNationality()));
            }
            doc.add(children);
        }

        doc.add(new Paragraph(d.getSignedAt() != null
                ? "Fiche remplie et certifiée exacte par le voyageur le " + d.getSignedAt().format(FR_DATETIME)
                        + " (signature électronique simple, livret d'accueil)."
                : "Signature du voyageur / Traveller's signature :").setMarginTop(8));
        doc.add(new Paragraph("Conservée six mois par l'exploitant et remise sur demande aux services de police "
                + "et unités de gendarmerie (CESEDA R814-3).").setFontSize(8).setMarginTop(16));
    }

    private String registrationOf(Reservation reservation) {
        if (reservation.getProperty() == null) {
            return null;
        }
        return licenseRepository.findFirstByPropertyIdAndOrganizationIdAndLicenseType(
                        reservation.getProperty().getId(), reservation.getOrganizationId(),
                        PropertyLicense.LicenseType.TOURISM_REGISTRATION)
                .map(PropertyLicense::getLicenseNumber)
                .orElse(null);
    }

    private void audit(String scope, int count) {
        auditLogService.logAction(AuditAction.EXPORT, "GuestDeclaration", null, null, null,
                "Export PDF des fiches de police (" + scope + ", " + count + " fiche(s))", AuditSource.WEB);
    }

    private static Table table() {
        return new Table(UnitValue.createPercentArray(new float[]{2, 3})).setWidth(UnitValue.createPercentValue(100));
    }

    private static void row(Table table, PdfFont bold, String label, String value) {
        table.addCell(new Cell().add(new Paragraph(label).setFont(bold).setFontSize(9)));
        table.addCell(cell(value));
    }

    private static Cell cell(String value) {
        return new Cell().add(new Paragraph(value == null || value.isBlank() ? "—" : value));
    }

    private static String fmt(LocalDate date) {
        return date == null ? null : date.format(FR_DATE);
    }

    private static String isoToFr(String iso) {
        if (iso == null || iso.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(iso.trim()).format(FR_DATE);
        } catch (Exception e) {
            return iso;
        }
    }

    private static String join(String a, String b) {
        if (a == null || a.isBlank()) {
            return b;
        }
        return b == null || b.isBlank() ? a : a + " (" + b + ")";
    }
}
