package com.clenzy.service.compliance;

import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Reservation;
import com.clenzy.service.BaitlyDocumentHtml;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Contenu de la fiche, rendu par le moteur HTML commun. Les règles d'éligibilité restent dans le service. */
final class BaitlyPoliceFormHtml {
    private BaitlyPoliceFormHtml() {}
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    static String render(Reservation stay, GuestDeclaration d, List<GuestDeclaration> minors, String registration) {
        var property = stay.getProperty();
        var b = new StringBuilder("<h1>FICHE INDIVIDUELLE DE POLICE</h1>")
                .append(BaitlyDocumentHtml.paragraph("Individual police registration form · CESEDA, art. R814-1 à R814-3"))
                .append("<table>")
                .append(row("Établissement / Accommodation", property == null ? null : property.getName()))
                .append(row("Adresse / Address", property == null || property.getAddress() == null ? null : property.getFullAddress()))
                .append(row("N° d'enregistrement / Registration no.", registration)).append("</table><table>")
                .append(row("Nom / Surname", d.getLastName()))
                .append(row("Nom de naissance / Birth name", d.getMaidenName()))
                .append(row("Prénoms / Given names", d.getFirstName()))
                .append(row("Date de naissance / Date of birth", birth(d.getBirthDate())))
                .append(row("Lieu de naissance / Place of birth", d.getBirthPlace()))
                .append(row("Nationalité / Nationality", d.getNationality()))
                .append(row("Domicile habituel / Usual address", join(d.getResidenceAddress(), d.getResidenceCountry())))
                .append(row("Téléphone mobile / Mobile phone", d.getPhone()))
                .append(row("Courriel / Email", d.getEmail()))
                .append(row("Date d'arrivée / Arrival", date(stay.getCheckIn())))
                .append(row("Départ prévu / Expected departure", date(stay.getCheckOut()))).append("</table>");
        if (!minors.isEmpty()) {
            b.append("<h2>Enfants de moins de 15 ans accompagnant le voyageur / Children under 15</h2><table>");
            for (GuestDeclaration m : minors) b.append("<tr>").append(cell(m.getLastName())).append(cell(m.getFirstName()))
                    .append(cell(birth(m.getBirthDate()))).append(cell(m.getNationality())).append("</tr>");
            b.append("</table>");
        }
        b.append(BaitlyDocumentHtml.paragraph(d.getSignedAt() == null ? "Signature du voyageur / Traveller's signature :"
                : "Fiche remplie et certifiée exacte par le voyageur le " + d.getSignedAt().format(TIME) + " (signature électronique simple, livret d'accueil)."));
        b.append(BaitlyDocumentHtml.paragraph("Conservée six mois par l'exploitant et remise sur demande aux services de police et unités de gendarmerie (CESEDA R814-3)."));
        return b.toString();
    }
    private static String row(String label, String value) { return BaitlyDocumentHtml.row(label, value == null || value.isBlank() ? "—" : value); }
    private static String cell(String value) { return "<td>" + BaitlyDocumentHtml.escape(value == null ? "—" : value) + "</td>"; }
    private static String date(LocalDate value) { return value == null ? null : value.format(DATE); }
    private static String birth(String value) { try { return date(LocalDate.parse(value)); } catch (Exception e) { return value; } }
    private static String join(String a, String b) { return a == null || a.isBlank() ? b : b == null || b.isBlank() ? a : a + " (" + b + ")"; }
}
