package com.clenzy.service.report.render;

import com.clenzy.dto.report.ReportMeta;
import com.clenzy.dto.report.ReportNarrative;
import com.clenzy.dto.report.ReportSnapshot;
import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import com.itextpdf.kernel.pdf.canvas.parser.listener.SimpleTextExtractionStrategy;
import com.itextpdf.layout.Canvas;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.svg.converter.SvgConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Convertit le rapport en PDF.
 *
 * <p>Passe par le HTML plutot que par l'API de mise en page d'iText : c'est le
 * MEME gabarit qui sert l'apercu et le document imprime. Construire le PDF
 * imperativement obligerait a tenir deux mises en page en parallele, et elles
 * divergeraient des la premiere retouche.</p>
 *
 * <p>Aucun navigateur n'intervient : les graphiques sont du SVG produit cote
 * serveur, rendu par le module SVG d'iText. C'est ce qui permet au planificateur
 * mensuel et a l'agent de produire un releve sans session ouverte.</p>
 */
@Service
public class ReportPdfService {

    private static final Logger log = LoggerFactory.getLogger(ReportPdfService.class);

    /** Marge laterale de la feuille (17 mm), en points. */
    private static final float MARGIN_PT = 48.2f;
    /** Ligne de base du pied, dans la marge basse de 22 mm. */
    private static final float FOOTER_BASELINE_PT = 30f;
    /** Nombre de rendus au plus : le sommaire converge en deux, le troisieme est un filet. */
    private static final int MAX_PASSES = 3;

    private final ReportHtmlRenderer htmlRenderer;

    public ReportPdfService(ReportHtmlRenderer htmlRenderer) {
        this.htmlRenderer = htmlRenderer;
    }

    /**
     * Rend le document.
     *
     * @param draft appose la mention « Brouillon » ; un rapport non relu ne doit
     *              jamais pouvoir etre confondu avec un document arrete
     */
    public byte[] toPdf(ReportSnapshot snapshot, ReportNarrative narrative, boolean draft) {
        return paginate(withContents(snapshot, narrative, draft), snapshot.meta(), draft);
    }

    public String toHtml(ReportSnapshot snapshot, ReportNarrative narrative, boolean draft) {
        return htmlRenderer.render(snapshot, narrative, draft);
    }

    /**
     * Rend le document jusqu'a ce que le sommaire dise vrai.
     *
     * <p>Un sommaire ne peut pas connaitre ses numeros de page avant que la
     * pagination existe, et la pagination depend du sommaire — la seule sortie
     * est de rendre, lire ou tombent les chapitres, puis rendre a nouveau. On
     * s'arrete des que deux passes donnent la meme table, ce qui arrive
     * normalement au deuxieme rendu : la colonne des numeros a une largeur
     * fixe, ajouter les chiffres ne fait donc pas bouger la mise en page.</p>
     *
     * <p>Un sommaire faux serait pire que pas de sommaire : on tolere de rendre
     * deux fois, on ne tolere pas d'envoyer un renvoi qui ne tombe pas juste.</p>
     */
    private byte[] withContents(ReportSnapshot snapshot, ReportNarrative narrative, boolean draft) {
        final List<String> chapters = htmlRenderer.chapterIds(snapshot);
        Map<String, Integer> pages = Map.of();
        byte[] pdf = null;

        for (int pass = 0; pass < MAX_PASSES; pass++) {
            pdf = fromHtml(htmlRenderer.render(snapshot, narrative, draft, pages));
            final Map<String, Integer> found = locateChapters(pdf, chapters);
            if (found.isEmpty() || found.equals(pages)) {
                return pdf;
            }
            pages = found;
        }
        // Trois passes sans point fixe : la mise en page oscille. On rend le
        // dernier etat plutot que de boucler — il est complet, au pire un renvoi
        // pointe une page a cote.
        log.warn("Sommaire non stabilise apres {} rendus", MAX_PASSES);
        return pdf;
    }

    /**
     * Retrouve la page de chaque chapitre en lisant le PDF deja rendu.
     *
     * <p>On cherche le numero de chapitre — « CHAPITRE 07 » — et non le titre :
     * un titre peut se couper en fin de ligne ou apparaitre aussi dans le
     * sommaire, le numero est unique et tient sur une ligne. Les espaces sont
     * retires avant comparaison parce que l'extraction reconstitue le texte
     * depuis la position des glyphes et intercale des blancs la ou le CSS a
     * ecarte les lettres.</p>
     */
    private Map<String, Integer> locateChapters(byte[] pdf, List<String> chapters) {
        final Map<String, Integer> pages = new HashMap<>();
        try (PdfDocument document = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf)))) {
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                final String text = PdfTextExtractor
                        .getTextFromPage(document.getPage(page), new SimpleTextExtractionStrategy())
                        .replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
                for (int index = 0; index < chapters.size(); index++) {
                    final String marker = String.format(Locale.ROOT, "CHAPITRE%02d", index + 1);
                    if (text.contains(marker)) {
                        pages.putIfAbsent(chapters.get(index), page);
                    }
                }
            }
        } catch (Exception e) {
            // Sans numeros, le sommaire reste lisible : il perd sa colonne de
            // droite, il ne devient pas faux.
            log.warn("Lecture des pages du sommaire impossible", e);
            return Map.of();
        }
        return pages;
    }

    /**
     * Numerote les pages et pose le pied de page courant.
     *
     * <p>Le total n'est connu qu'une fois le document ferme, et « page 3 » sans
     * « sur 16 » ne dit pas au lecteur s'il en manque : on repasse donc sur le
     * flux rendu. Un document de seize pages sans numero n'est pas diffusable —
     * une page detachee devient anonyme, et deux versions ne se distinguent
     * plus.</p>
     */
    private byte[] paginate(byte[] source, ReportMeta meta, boolean draft) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(source.length + 8_192);
             PdfDocument pdf = new PdfDocument(
                     new PdfReader(new ByteArrayInputStream(source)), new PdfWriter(out))) {

            coverBackground(pdf.getPage(1));

            final PdfFont font = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            final DeviceRgb muted = new DeviceRgb(0x5A, 0x6E, 0x7C);
            final int total = pdf.getNumberOfPages();

            final String left = draft
                    ? "BROUILLON — " + nullSafe(meta.issuerName())
                    : nullSafe(meta.issuerName())
                      + (meta.documentNumber() == null ? ""
                         : "  ·  " + meta.documentNumber() + " v" + meta.version());

            // La couverture ne porte pas de pied : elle est la page de titre.
            for (int page = 2; page <= total; page++) {
                final Rectangle size = pdf.getPage(page).getPageSize();
                final PdfCanvas pdfCanvas = new PdfCanvas(pdf.getPage(page));
                final Rectangle band = new Rectangle(
                        MARGIN_PT, FOOTER_BASELINE_PT, size.getWidth() - 2 * MARGIN_PT, 14);

                try (Canvas canvas = new Canvas(pdfCanvas, band)) {
                    canvas.add(new Paragraph(left)
                            .setFont(font).setFontSize(7.5f).setFontColor(muted)
                            .setTextAlignment(TextAlignment.LEFT).setMargin(0));
                }
                try (Canvas canvas = new Canvas(pdfCanvas, band)) {
                    canvas.add(new Paragraph(page + " / " + total)
                            .setFont(font).setFontSize(7.5f).setFontColor(muted)
                            .setTextAlignment(TextAlignment.RIGHT).setMargin(0));
                }
            }
            pdf.close();
            return out.toByteArray();
        } catch (Exception e) {
            // Une pagination ratee ne doit pas couter le document : on rend le
            // flux non numerote plutot que rien du tout.
            log.warn("Pagination du rapport impossible, document rendu sans numerotation", e);
            return source;
        }
    }

    /**
     * Peint l'aplat de couverture, a fond perdu, SOUS le contenu de la page.
     *
     * <p>iText n'honore pas {@code @page cover { margin: 0 }} : un bloc HTML
     * reste enferme dans la boite de contenu, et une couverture pleine page est
     * hors de portee du CSS seul. On peint donc le fond dans un flux insere
     * AVANT celui de la page — {@code newContentStreamBefore} —, faute de quoi
     * l'aplat recouvrirait le titre au lieu de le porter.</p>
     */
    private void coverBackground(PdfPage page) {
        final Rectangle size = page.getPageSize();
        final PdfCanvas canvas = new PdfCanvas(
                page.newContentStreamBefore(), page.getResources(), page.getDocument());
        canvas.saveState()
                .setFillColor(new DeviceRgb(0x14, 0x1F, 0x29))
                .rectangle(0, 0, size.getWidth(), size.getHeight())
                .fill()
                .restoreState();

        // Le mark, en tres grand et a peine plus clair que le fond, deborde du
        // coin. Il donne du relief a l'aplat sans rien disputer au titre : une
        // teinte voisine plutot qu'une transparence, que tous les lecteurs PDF
        // n'aplatissent pas de la meme facon.
        try {
            canvas.addXObjectAt(
                    SvgConverter.convertToXObject(BaitlyMark.svg("#1A2833", 360),
                            page.getDocument()),
                    size.getWidth() - 120, -190);
        } catch (Exception e) {
            log.debug("Filigrane de couverture non rendu", e);
        }
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private byte[] fromHtml(String html) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024)) {
            final ConverterProperties properties = new ConverterProperties();
            try (PdfDocument pdf = new PdfDocument(new PdfWriter(out))) {
                pdf.setDefaultPageSize(PageSize.A4);
                try (Document document = HtmlConverter.convertToDocument(html, pdf, properties)) {
                    document.flush();
                }
            }
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Rendu PDF du rapport impossible", e);
            throw new IllegalStateException("Impossible de generer le PDF du rapport", e);
        }
    }
}
