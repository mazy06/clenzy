package com.clenzy.service.regulatory;

import com.clenzy.integration.dgfip.DeltaTouristTaxClient;
import com.clenzy.integration.dgfip.DeltaTouristTaxClient.DeltaRow;
import com.clenzy.model.FrTouristTaxRate;
import com.clenzy.model.FrTouristTaxRate.Category;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.FrTouristTaxRateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Referentiel officiel des tarifs de taxe de sejour, indexe sur la commune du logement
 * (code INSEE) — source DGFiP DELTA (deliberations des collectivites).
 *
 * <p><b>Pre-remplir, jamais imposer.</b> Le referentiel propose un bareme ; l'operateur le
 * valide dans le dialogue de bareme. Il n'est pas « temps reel » : la DGFiP le publie
 * plusieurs fois par an, et une deliberation reste en vigueur tant qu'une nouvelle ne la
 * remplace pas — d'ou le choix de la DERNIERE annee d'effet non echue a la date visee.</p>
 *
 * <p><b>Surtaxes legales absentes du jeu.</b> En Ile-de-France, la taxe additionnelle
 * regionale de 15 % (CGCT L2531-17) et celle de 200 % au profit d'Ile-de-France Mobilites
 * (L2531-18, depuis 2025) s'appliquent de plein droit sans deliberation communale : le jeu
 * DELTA ne les porte pas pour Paris. Elles sont ajoutees ici, une seule fois, quand la
 * ligne ne les renseigne pas deja.</p>
 *
 * <p>Copie locale ({@code fr_tourist_tax_rates}) rafraichie apres {@link #FRESHNESS} : un
 * referentiel injoignable ne bloque rien, on sert la derniere copie connue.</p>
 */
@Service
public class FrTouristTaxReferenceService {

    private static final Logger log = LoggerFactory.getLogger(FrTouristTaxReferenceService.class);
    static final Duration FRESHNESS = Duration.ofDays(30);
    static final Set<String> ILE_DE_FRANCE = Set.of("75", "77", "78", "91", "92", "93", "94", "95");
    static final BigDecimal IDF_REGIONAL_L2531_17 = new BigDecimal("15");
    static final BigDecimal IDF_MOBILITES_L2531_18 = new BigDecimal("200");
    private static final Pattern STARS = Pattern.compile("meubles de tourisme (\\d) etoile");

    private final DeltaTouristTaxClient client;
    private final FrTouristTaxRateRepository repository;
    private final Clock clock;

    public FrTouristTaxReferenceService(DeltaTouristTaxClient client, FrTouristTaxRateRepository repository,
                                        Clock clock) {
        this.client = client;
        this.repository = repository;
        this.clock = clock;
    }

    /** Bareme propose pour une commune, une categorie et une annee. */
    public record Suggestion(
            String inseeCode,
            String communeName,
            String category,
            int sourceYear,
            String accommodationLabel,
            TaxCalculationMode calculationMode,
            /** Montant par personne et par nuit (mode forfaitaire), avant surtaxes. */
            BigDecimal ratePerPerson,
            /** Fraction du prix par personne et par nuit (mode « au reel »), ex. 0.05. */
            BigDecimal percentageRate,
            /** Plafond par personne et par nuit du mode au reel : le plus haut tarif vote. */
            BigDecimal capPerPersonNight,
            BigDecimal departmentalSurchargePct,
            /** Surtaxes regionales cumulees (DELTA + surtaxes legales d'Ile-de-France). */
            BigDecimal regionalSurchargePct,
            String source,
            LocalDateTime fetchedAt
    ) {
    }

    /**
     * @param category categorie du logement ({@link Category}) ; meuble classe N etoiles,
     *                 non classe, chambre d'hotes
     * @return vide si la commune n'a pas institue la taxe ou n'a pas de tarif pour la categorie
     */
    @Transactional
    public Optional<Suggestion> suggest(String inseeCode, Category category, int year) {
        String insee = inseeCode == null ? null : inseeCode.trim().toUpperCase(Locale.ROOT);
        List<FrTouristTaxRate> rates = ratesFor(insee);
        LocalDate yearStart = LocalDate.of(year, 1, 1);
        // Deliberation en vigueur : derniere annee d'effet <= annee visee, non echue.
        Optional<Integer> applicableYear = rates.stream()
                .filter(r -> r.getEffectiveYear() <= year)
                .filter(r -> r.getEffectiveTo() == null || !r.getEffectiveTo().isBefore(yearStart))
                .map(FrTouristTaxRate::getEffectiveYear)
                .max(Comparator.naturalOrder());
        if (applicableYear.isEmpty()) {
            return Optional.empty();
        }
        List<FrTouristTaxRate> inForce = rates.stream()
                .filter(r -> r.getEffectiveYear() == applicableYear.get())
                .toList();
        Optional<FrTouristTaxRate> match = inForce.stream().filter(r -> r.getCategory() == category).findFirst();
        if (match.isEmpty()) {
            return Optional.empty();
        }
        FrTouristTaxRate rate = match.get();
        boolean percentage = "PCT".equals(rate.getRateUnit());
        BigDecimal cap = inForce.stream()
                .filter(r -> "EUR".equals(r.getRateUnit()) && r.getRate() != null)
                .map(FrTouristTaxRate::getRate)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return Optional.of(new Suggestion(
                insee,
                rate.getCommuneName(),
                category.name(),
                rate.getEffectiveYear(),
                rate.getAccommodationLabel(),
                percentage ? TaxCalculationMode.PERCENTAGE_OF_RATE : TaxCalculationMode.PER_PERSON_PER_NIGHT,
                percentage ? null : rate.getRate(),
                percentage && rate.getRate() != null
                        ? rate.getRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) : null,
                percentage ? cap : null,
                nz(rate.getDepartmentalPct()),
                regionalPct(insee, rate),
                "DGFiP — délibérations taxe de séjour (DELTA), data.economie.gouv.fr",
                rate.getFetchedAt()));
    }

    /** Surtaxes regionales : celles du jeu, plus les surtaxes legales d'Ile-de-France si absentes. */
    static BigDecimal regionalPct(String insee, FrTouristTaxRate rate) {
        BigDecimal other = nz(rate.getOtherAdditionalPct());
        if (insee != null && ILE_DE_FRANCE.contains(insee.substring(0, 2)) && other.signum() == 0) {
            return IDF_REGIONAL_L2531_17.add(IDF_MOBILITES_L2531_18);
        }
        return other;
    }

    /** Copie locale fraiche, sinon rechargement ; referentiel injoignable → derniere copie. */
    List<FrTouristTaxRate> ratesFor(String insee) {
        List<FrTouristTaxRate> cached = repository.findByInseeCodeOrderByEffectiveYearDesc(insee);
        LocalDateTime now = LocalDateTime.now(clock);
        boolean fresh = !cached.isEmpty()
                && cached.get(0).getFetchedAt().isAfter(now.minus(FRESHNESS));
        if (fresh) {
            return cached;
        }
        try {
            List<DeltaRow> rows = client.fetchCommune(insee);
            repository.deleteByInseeCode(insee);
            List<FrTouristTaxRate> entities = rows.stream()
                    .filter(r -> r.effectiveYear() > 0 && r.hebergement() != null)
                    .map(r -> toEntity(insee, r, now))
                    .toList();
            return repository.saveAll(entities);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("Referentiel taxe de sejour injoignable pour {} : {} — copie locale servie ({} ligne(s))",
                    insee, e.getMessage(), cached.size());
            return cached;
        }
    }

    static FrTouristTaxRate toEntity(String insee, DeltaRow row, LocalDateTime now) {
        FrTouristTaxRate r = new FrTouristTaxRate();
        r.setInseeCode(insee);
        r.setCommuneName(row.libelleCommune());
        r.setEffectiveYear(row.effectiveYear());
        r.setEffectiveTo(row.effectiveTo());
        r.setAccommodationLabel(truncate(row.hebergement(), 300));
        r.setCategory(categoryOf(row.hebergement()));
        r.setRegime(row.regime());
        r.setRate(row.tarif());
        r.setRateUnit(row.unite() != null && row.unite().contains("%") ? "PCT" : "EUR");
        r.setDepartmentalPct(pct(row.taxeAddDep()));
        r.setOtherAdditionalPct(pct(row.addL253117()).add(pct(row.addL253118())).add(pct(row.addL43324()))
                .add(pct(row.addL43325())).add(pct(row.addL43326())));
        r.setCollectorSiren(row.siren());
        r.setFetchedAt(now);
        return r;
    }

    /** Libelle DGFiP → categorie utile a la location courte duree. */
    static Category categoryOf(String label) {
        String l = Normalizer.normalize(label == null ? "" : label, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('’', '\'');
        Matcher m = STARS.matcher(l);
        if (m.find()) {
            return Category.valueOf("MEUBLE_" + m.group(1));
        }
        if (l.startsWith("hebergements sans classement") || l.startsWith("hebergement sans classement")) {
            return Category.UNCLASSIFIED;
        }
        if (l.startsWith("chambres d'hotes") || l.startsWith("chambre d'hotes")) {
            return Category.CHAMBRE_HOTES;
        }
        if (l.startsWith("palace")) {
            return Category.PALACE;
        }
        return Category.OTHER;
    }

    /** {@code "10,00"} → 10.00 ; vide ou illisible → 0. */
    static BigDecimal pct(String value) {
        if (value == null || value.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
