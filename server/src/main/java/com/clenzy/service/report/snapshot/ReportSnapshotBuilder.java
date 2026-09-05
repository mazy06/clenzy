package com.clenzy.service.report.snapshot;

import com.clenzy.dto.ReportResultDto;
import com.clenzy.dto.ReportResultRowDto;
import com.clenzy.dto.report.*;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionType;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.GuestReview;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.dto.PaceMonthDto;
import com.clenzy.dto.PaceSummaryDto;
import com.clenzy.service.PaceAnalyticsService;
import com.clenzy.service.report.ReportExecutionService;
import com.clenzy.service.report.ReportFormats;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

import static com.clenzy.service.report.ReportFormats.*;

/**
 * Assemble le snapshot chiffre d'un rapport.
 *
 * <p>Tout est calcule ICI, une fois, et fige. Les trois rendus — ecran, PDF,
 * commentaire — ne font ensuite que traduire. Aucun d'eux ne requete la base :
 * c'est ce qui garantit qu'ils racontent la meme chose, et qu'un rapport
 * regenere dans six mois redonne exactement le meme document.</p>
 *
 * <p><b>Le double comparatif est systematique.</b> Chaque chiffre cle est
 * calcule trois fois : sur la periode, sur la periode precedente de meme
 * duree, et sur la meme periode l'an dernier. Un chiffre seul ne dit rien —
 * « 30,7 % d'occupation » ne prend de sens que face aux 26 % de l'an dernier.</p>
 */
@Service
public class ReportSnapshotBuilder {

    /** Sections du profil proprietaire, dans l'ordre de lecture du document. */
    public static final String S_EMPTY = "empty";
    public static final String S_PERFORMANCE = "performance";
    public static final String S_OCCUPANCY = "occupancy";
    public static final String S_STAYS = "stays";
    public static final String S_DISTRIBUTION = "distribution";
    public static final String S_PNL = "pnl";
    public static final String S_PROPERTIES = "properties";
    public static final String S_OPERATIONS = "operations";
    /** Horizon de projection : au-dela, l'on-the-books est trop mince pour informer. */
    private static final int OUTLOOK_MONTHS = 6;

    /** Cible d'occupation au-dela de laquelle un bien est considere bien rempli. */
    private static final int OCCUPANCY_TARGET = 60;
    /** Part des revenus prelevee par les canaux au-dela de laquelle on alerte. */
    private static final int COMMISSION_ALERT_PCT = 12;
    /** Part du volume qu'un basculement vers le direct peut viser, prudemment. */
    private static final int DIRECT_SHIFT_PCT = 20;
    /** Part des revenus absorbee par les charges au-dela de laquelle on alerte. */
    private static final int COST_ALERT_PCT = 25;
    /** Retard de pace au-dela duquel un mois a venir demande une action. */
    private static final int PACE_ALERT_PCT = -10;
    /** Note a partir de laquelle un avis pese negativement sur le classement. */
    private static final int NEGATIVE_RATING = 3;
    /** Ecart-type d'occupation au-dela duquel le portefeuille n'est plus homogene. */
    private static final int HETEROGENEOUS_SPREAD = 15;
    /** Au-dela, le digest cesse d'etre un digest. */
    private static final int MAX_HIGHLIGHTS = 5;
    /** Recul du motif saisonnier, borne par le plafond de periode du moteur. */
    private static final int SEASONALITY_MONTHS = 23;
    /** Sans une annee pleine, parler de saisonnalite serait une invention. */
    private static final int FULL_YEAR = 12;
    /** Sous ce nombre de sejours, la distribution des delais ne veut rien dire. */
    private static final int MIN_LEADTIME_SAMPLE = 12;
    /**
     * Seuils de lecture tarifaire.
     *
     * <p>Les MEMES que {@code BusinessAnalyticsScanner}, qui les emploie pour ses
     * suggestions de rendement. En retenir d'autres ferait qu'un rapport et
     * l'assistant conseilleraient l'inverse l'un de l'autre sur les memes
     * chiffres.</p>
     */
    private static final double OCCUPANCY_LOW_PCT = 55.0;
    private static final double OCCUPANCY_HIGH_PCT = 85.0;

    public static final String S_OUTLOOK = "outlook";
    public static final String S_DECISIONS = "decisions";
    public static final String S_CANCELLATIONS = "cancellations";
    public static final String S_REPUTATION = "reputation";
    public static final String S_HIGHLIGHTS = "highlights";
    public static final String S_SEASONALITY = "seasonality";
    public static final String S_LEADTIME = "leadtime";
    public static final String S_SETTLEMENT = "settlement";
    public static final String S_UPSELLS = "upsells";
    public static final String S_NUISANCES = "nuisances";
    public static final String S_PRICING = "pricing";
    public static final String S_EXPENSES = "expenses";
    public static final String S_BENCHMARK = "benchmark";
    public static final String S_GLOSSARY = "glossary";
    public static final String S_NOTICE = "notice";

    private final ReportExecutionService executionService;
    private final PropertyRepository propertyRepository;
    private final OwnerPayoutRepository payoutRepository;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final GuestReviewRepository reviewRepository;
    private final PaceAnalyticsService paceService;
    private final com.clenzy.repository.UpsellOrderRepository upsellOrderRepository;
    private final com.clenzy.repository.NoiseAlertRepository noiseAlertRepository;

    public ReportSnapshotBuilder(ReportExecutionService executionService,
                                 PropertyRepository propertyRepository,
                                 OwnerPayoutRepository payoutRepository,
                                 InterventionRepository interventionRepository,
                                 UserRepository userRepository,
                                 ReservationRepository reservationRepository,
                                 CalendarDayRepository calendarDayRepository,
                                 GuestReviewRepository reviewRepository,
                                 PaceAnalyticsService paceService,
                                 com.clenzy.repository.UpsellOrderRepository upsellOrderRepository,
                                 com.clenzy.repository.NoiseAlertRepository noiseAlertRepository) {
        this.executionService = executionService;
        this.propertyRepository = propertyRepository;
        this.payoutRepository = payoutRepository;
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.reviewRepository = reviewRepository;
        this.paceService = paceService;
        this.upsellOrderRepository = upsellOrderRepository;
        this.noiseAlertRepository = noiseAlertRepository;
    }

    /**
     * Construit le snapshot d'un perimetre.
     *
     * @param scope le perimetre resolu (un proprietaire, un bien, ou tout)
     */
    @Transactional(readOnly = true)
    public ReportSnapshot build(ReportRequest request, ReportScope scope, Long orgId,
                                String issuerName, String issuerLogoUrl) {
        final LocalDate from = request.from();
        final LocalDate to = request.to();
        final long days = ChronoUnit.DAYS.between(from, to) + 1;
        final LocalDate previousTo = from.minusDays(1);
        final LocalDate previousFrom = previousTo.minusDays(days - 1);
        final LocalDate lastYearFrom = from.minusYears(1);
        final LocalDate lastYearTo = to.minusYears(1);

        final Set<Long> propertyIds = scope.propertyIds();
        final int activeProperties = activeCount(scope);
        final Totals current = totals(from, to, orgId, propertyIds, activeProperties);
        final Totals previous = totals(previousFrom, previousTo, orgId, propertyIds, activeProperties);
        final Totals lastYear = totals(lastYearFrom, lastYearTo, orgId, propertyIds, activeProperties);

        final String currency = current.currency();
        final List<ReportSection> sections = new ArrayList<>();

        final List<Reservation> stays = staysOf(from, to, orgId, propertyIds);

        // Un rapport vide doit DIRE pourquoi il l'est. Aligner des zeros et des
        // « aucune donnee » laisse le lecteur croire a une panne, alors que la
        // periode est simplement sans sejour — l'information utile est ailleurs.
        if (stays.isEmpty()) {
            sections.add(emptyExplanation(scope, orgId, from, to));
        }

        if (request.wants(S_PERFORMANCE)) {
            sections.add(performance(from, to, orgId, propertyIds, currency, current, lastYear));
        }
        if (request.wants(S_DISTRIBUTION)) {
            sections.add(distribution(from, to, orgId, propertyIds, currency));
        }
        if (request.wants(S_PNL)) {
            sections.add(profitAndLoss(from, to, orgId, scope, current, currency, stays));
        }
        if (request.wants(S_OCCUPANCY) && !stays.isEmpty()) {
            sections.add(occupancy(from, to, orgId, scope, current));
        }
        if (request.wants(S_CANCELLATIONS)) {
            addIfPresent(sections, cancellations(from, to, orgId, propertyIds, currency));
        }
        if (request.wants(S_OUTLOOK)) {
            addIfPresent(sections, outlook(scope, orgId, currency));
        }
        if (request.wants(S_DECISIONS)) {
            sections.add(decisions(current, lastYear, scope, from, to, orgId, currency));
        }
        if (request.wants(S_REPUTATION)) {
            addIfPresent(sections, reputation(from, to, orgId, propertyIds));
        }
        if (request.wants(S_PROPERTIES) && scope.properties().size() > 1) {
            sections.add(byProperty(from, to, orgId, propertyIds, currency));
        }
        if (request.wants(S_OPERATIONS)) {
            sections.add(operations(from, to, orgId, scope, currency));
        }
        if (request.wants(S_BENCHMARK) && scope.properties().size() > 1) {
            addIfPresent(sections, benchmark(from, to, orgId, propertyIds, currency));
        }
        if (request.wants(S_STAYS) && !stays.isEmpty()) {
            sections.add(staysSection(stays, from, to, currency));
        }
        if (request.wants(S_GLOSSARY) && request.profile() == ReportProfile.OWNER) {
            sections.add(glossary());
        }
        if (request.wants(S_SETTLEMENT) && !stays.isEmpty()) {
            addIfPresent(sections, settlement(stays, currency));
        }
        if (request.wants(S_UPSELLS)) {
            addIfPresent(sections, upsells(from, to, orgId, stays, currency));
        }
        if (request.wants(S_NUISANCES)) {
            addIfPresent(sections, nuisances(from, to, orgId, propertyIds));
        }
        if (request.wants(S_PRICING)) {
            addIfPresent(sections, pricing(from, to, orgId, propertyIds, currency));
        }
        if (request.wants(S_EXPENSES)) {
            addIfPresent(sections, expenses(from, to, orgId, scope, currency));
        }
        if (request.wants(S_SEASONALITY)) {
            addIfPresent(sections, seasonality(to, orgId, propertyIds, currency));
        }
        if (request.wants(S_LEADTIME) && !stays.isEmpty()) {
            addIfPresent(sections, leadTime(stays));
        }
        if (request.wants(S_NOTICE)) {
            sections.add(notice(scope, from, to, currency, stays));
        }

        // Le digest se compose des sections DEJA construites, et se place en
        // tete : il n'ajoute aucun calcul, il hierarchise ce qui existe.
        if (request.wants(S_HIGHLIGHTS)) {
            final ReportSection digest = highlights(sections);
            if (digest != null) {
                sections.add(0, digest);
            }
        }

        final ReportMeta meta = new ReportMeta(
                null, 1, request.profile(),
                title(request),
                issuerName, issuerLogoUrl,
                scope.recipientName(),
                from, to, previousFrom, previousTo, lastYearFrom, lastYearTo,
                Instant.now(), currency,
                scope.properties().stream().map(Property::getName).sorted().toList(),
                scopeNote(scope, days));

        // Le profil prospect s'anonymise EN SORTIE, jamais section par section :
        // un seul point de passage garantit qu'aucune section future n'echappe
        // au traitement en etant simplement oubliee.
        return ReportAnonymiser.anonymise(
                new ReportSnapshot(meta, headlineKpis(current, previous, lastYear, currency), sections));
    }

    // ── Chiffres cles ───────────────────────────────────────────────────────

    /**
     * Les chiffres de la synthese executive.
     *
     * <p>C'est la seule page que la plupart des destinataires liront. Cinq
     * chiffres, chacun avec ses deux ecarts — au-dela, on ne retient plus rien.</p>
     */
    private List<ReportKpi> headlineKpis(Totals current, Totals previous, Totals lastYear, String currency) {
        return List.of(
                new ReportKpi("revenue", "Revenus", money(current.revenue, currency), current.revenue,
                        growth(current.revenue, previous.revenue), growth(current.revenue, lastYear.revenue),
                        true, "Loyers perçus sur la période, commissions incluses"),
                new ReportKpi("nights", "Nuits vendues", count(current.nights), BigDecimal.valueOf(current.nights),
                        growth(BigDecimal.valueOf(current.nights), BigDecimal.valueOf(previous.nights)),
                        growth(BigDecimal.valueOf(current.nights), BigDecimal.valueOf(lastYear.nights)),
                        true, null),
                new ReportKpi("occupancy", "Occupation", percent(current.occupancy()), current.occupancy(),
                        growth(current.occupancy(), previous.occupancy()),
                        growth(current.occupancy(), lastYear.occupancy()),
                        true, "Part des nuits disponibles effectivement vendues"),
                new ReportKpi("adr", "Prix moyen par nuit", money(current.adr(), currency), current.adr(),
                        growth(current.adr(), previous.adr()), growth(current.adr(), lastYear.adr()),
                        true, "ADR — revenus divisés par les nuits vendues"),
                new ReportKpi("net", "Net propriétaire", money(current.net(), currency), current.net(),
                        growth(current.net(), previous.net()), growth(current.net(), lastYear.net()),
                        true, "Après commissions et charges"));
    }

    // ── Sections ────────────────────────────────────────────────────────────

    /** Revenus et occupation mois par mois, face a l'an dernier. */
    private ReportSection performance(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds,
                                      String currency, Totals current, Totals lastYear) {
        final ReportResultDto months = executionService.execute(
                List.of("PERIOD"), List.of("REVENUE", "OCCUPANCY", "ADR"), "MONTH", from, to, orgId, propertyIds);
        final ReportResultDto lastYearMonths = executionService.execute(
                List.of("PERIOD"), List.of("REVENUE"), "MONTH",
                from.minusYears(1), to.minusYears(1), orgId, propertyIds);

        final List<String> categories = months.rows().stream()
                .map(r -> monthLabel(r.dimensionValues().get(0))).toList();
        final List<BigDecimal> revenues = months.rows().stream().map(r -> metric(r, "REVENUE")).toList();
        final List<BigDecimal> lastYearRevenues = lastYearMonths.rows().stream()
                .map(r -> metric(r, "REVENUE")).toList();

        final ReportChart chart = new ReportChart(ReportChartType.BARS, categories,
                List.of(ReportSeries.of("revenue", "Cette période", revenues),
                        ReportSeries.of("lastYear", "An dernier", pad(lastYearRevenues, categories.size()))
                                .withTone("neutral").dashedLine()),
                "money");

        final List<List<String>> rows = new ArrayList<>();
        for (ReportResultRowDto row : months.rows()) {
            rows.add(List.of(monthLabel(row.dimensionValues().get(0)),
                    money(metric(row, "REVENUE"), currency),
                    percent(metric(row, "OCCUPANCY")),
                    money(metric(row, "ADR"), currency)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        final BigDecimal yoy = growth(current.revenue, lastYear.revenue);
        if (yoy != null) {
            notes.add((yoy.signum() >= 0
                    ? ReportNote.positive("Revenus en hausse sur un an", signedPercent(yoy) + " face à la même période l'an dernier")
                    : ReportNote.warning("Revenus en retrait sur un an", signedPercent(yoy) + " face à la même période l'an dernier"))
                    .withImpact(money(current.revenue.subtract(lastYear.revenue), currency)));
        }
        bestAndWorst(months, currency).forEach(notes::add);

        return new ReportSection(S_PERFORMANCE, "Performance commerciale",
                "Revenus, occupation et prix moyen, mois par mois",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Mois", "Revenus", "Occupation", "Prix moyen"),
                        ReportTable.numericAligns(4), rows,
                        List.of("Total", money(current.revenue, currency),
                                percent(current.occupancy()), money(current.adr(), currency))),
                chart, notes, null, null);
    }

    /**
     * D'ou vient la demande, et ce qu'elle coute.
     *
     * <p>La colonne « commission » est l'interet de la section : elle chiffre ce
     * que la distribution preleve, canal par canal. C'est l'argument qui fait
     * basculer un proprietaire vers la reservation directe, et presque aucun
     * releve ne le montre.</p>
     */
    private ReportSection distribution(LocalDate from, LocalDate to, Long orgId,
                                       Set<Long> propertyIds, String currency) {
        final ReportResultDto byChannel = executionService.execute(
                List.of("CHANNEL"), List.of("REVENUE", "FEES"), "MONTH", from, to, orgId, propertyIds);

        final List<ReportResultRowDto> sorted = byChannel.rows().stream()
                .sorted(Comparator.comparing((ReportResultRowDto r) -> metric(r, "REVENUE")).reversed())
                .toList();

        final List<String> categories = sorted.stream()
                .map(r -> channelDisplay(r.dimensionValues().get(0))).toList();
        final List<BigDecimal> revenues = sorted.stream().map(r -> metric(r, "REVENUE")).toList();

        final BigDecimal totalRevenue = revenues.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        final BigDecimal totalFees = sorted.stream().map(r -> metric(r, "FEES"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        final List<List<String>> rows = new ArrayList<>();
        for (ReportResultRowDto row : sorted) {
            final BigDecimal revenue = metric(row, "REVENUE");
            final BigDecimal fees = metric(row, "FEES");
            rows.add(List.of(channelDisplay(row.dimensionValues().get(0)),
                    money(revenue, currency),
                    share(revenue, totalRevenue),
                    money(fees, currency),
                    share(fees, revenue)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        if (totalFees.signum() > 0) {
            notes.add(ReportNote.neutral("Commissions de distribution",
                    "Part des revenus prélevée par les canaux sur la période")
                    .withImpact(money(totalFees, currency)));
        }
        sorted.stream()
                .filter(r -> r.dimensionValues().get(0).toLowerCase(Locale.ROOT).contains("direct"))
                .findFirst()
                .ifPresent(direct -> notes.add(ReportNote.positive("Réservation directe",
                        "Part du chiffre d'affaires sans commission de canal")
                        .withImpact(share(metric(direct, "REVENUE"), totalRevenue))));

        return new ReportSection(S_DISTRIBUTION, "Mix de distribution",
                "Où arrive la demande, et ce qu'elle coûte",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Canal", "Revenus", "Part", "Commission", "Taux"),
                        ReportTable.numericAligns(5), rows,
                        List.of("Total", money(totalRevenue, currency), "100 %",
                                money(totalFees, currency), share(totalFees, totalRevenue))),
                new ReportChart(ReportChartType.DONUT, categories,
                        List.of(ReportSeries.of("revenue", "Revenus", revenues)), "money"),
                notes, null, null);
    }

    /**
     * Le compte de resultat, en cascade jusqu'au net proprietaire.
     *
     * <p>C'est LE tableau qu'un proprietaire cherche. Il est lu en priorite du
     * reversement REEL ({@link OwnerPayout}) quand il existe : ce montant a ete
     * reconcilie et souvent deja verse, il fait foi. A defaut, la cascade est
     * reconstituee depuis les agregats — et le document le DIT. Presenter une
     * estimation comme un montant arrete est la faute la plus couteuse d'un
     * rapport financier.</p>
     */
    private ReportSection profitAndLoss(LocalDate from, LocalDate to, Long orgId,
                                        ReportScope scope, Totals current, String currency,
                                        List<Reservation> stays) {
        final List<OwnerPayout> payouts = scope.ownerId() == null ? List.of()
                : payoutRepository.findByOwnerId(scope.ownerId(), orgId).stream()
                        .filter(p -> p.getPeriodStart() != null && p.getPeriodEnd() != null)
                        .filter(p -> !p.getPeriodEnd().isBefore(from) && !p.getPeriodStart().isAfter(to))
                        .toList();

        final boolean reconciled = !payouts.isEmpty();
        final BigDecimal gross = reconciled ? sum(payouts, OwnerPayout::getGrossRevenue) : current.revenue;
        final BigDecimal otaFees = reconciled ? sum(payouts, OwnerPayout::getOtaFees) : current.fees;
        final BigDecimal management = reconciled ? sum(payouts, OwnerPayout::getCommissionAmount) : BigDecimal.ZERO;
        final BigDecimal expenses = reconciled ? sum(payouts, OwnerPayout::getExpenses) : current.costs;
        // La taxe de sejour est ENCAISSEE avec le sejour (elle entre dans le
        // total de la reservation) mais elle n'appartient pas au proprietaire :
        // elle est reversee a la commune. Sans cette ligne, le net affiche
        // integrait de l'argent qui n'est pas le sien.
        //
        // Elle n'est retranchee que de la cascade RECONSTITUEE : un reversement
        // reconcilie porte deja son propre net, ou la taxe a ete traitee en
        // amont — la soustraire une seconde fois la compterait deux fois.
        final BigDecimal touristTax = touristTaxOf(stays, from, to);
        final BigDecimal net = reconciled ? sum(payouts, OwnerPayout::getNetAmount)
                : gross.subtract(touristTax).subtract(otaFees).subtract(expenses);

        final List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Revenus bruts", money(gross, currency), ""));
        // La ligne n'apparait QUE si elle participe au net affiche. Sur une
        // cascade reconciliee, le net vient du reversement : montrer une
        // deduction qui n'y entre pas donnerait un tableau qui ne s'additionne
        // pas — pire qu'une ligne absente.
        if (!reconciled && touristTax.signum() > 0) {
            rows.add(List.of("Taxe de séjour (reversée)", "-" + money(touristTax, currency),
                    share(touristTax, gross)));
        }
        rows.add(List.of("Commissions des canaux", "-" + money(otaFees, currency), share(otaFees, gross)));
        if (management.signum() != 0) {
            rows.add(List.of("Frais de gestion", "-" + money(management, currency), share(management, gross)));
        }
        rows.add(List.of("Charges d'exploitation", "-" + money(expenses, currency), share(expenses, gross)));

        final List<ReportNote> notes = new ArrayList<>();
        if (touristTax.signum() > 0) {
            notes.add(ReportNote.neutral("Taxe de séjour",
                    reconciled
                            ? "Encaissée avec le séjour et reversée à la commune. Elle est déjà "
                              + "traitée dans le reversement, et n'apparaît donc pas en déduction"
                            : "Encaissée avec le séjour et reversée à la commune : elle ne fait "
                              + "pas partie de vos revenus. Seuls les séjours qui la portent "
                              + "explicitement sont comptés")
                    .withImpact(money(touristTax, currency)));
        }
        notes.add(reconciled
                ? ReportNote.neutral("Montants arrêtés",
                        "Cascade issue des reversements réconciliés de la période")
                : ReportNote.warning("Montants estimés",
                        "Aucun reversement enregistré sur la période : la cascade est reconstituée "
                        + "depuis les réservations et les interventions"));

        return new ReportSection(S_PNL, "Compte de résultat",
                reconciled ? "Des revenus bruts au net propriétaire" : "Reconstitué — en attente de reversement",
                ReportSectionKind.PNL,
                new ReportTable(List.of("Poste", "Montant", "Part des revenus"),
                        List.of(ReportAlign.START, ReportAlign.END, ReportAlign.END), rows,
                        List.of("Net propriétaire", money(net, currency), share(net, gross))),
                null, notes, null, null);
    }

    /** Le detail bien par bien — seulement quand il y en a plusieurs. */
    private ReportSection byProperty(LocalDate from, LocalDate to, Long orgId,
                                     Set<Long> propertyIds, String currency) {
        final ReportResultDto result = executionService.execute(
                List.of("PROPERTY"), List.of("REVENUE", "OCCUPANCY", "ADR", "FEES"),
                "MONTH", from, to, orgId, propertyIds);

        final List<ReportResultRowDto> sorted = result.rows().stream()
                .sorted(Comparator.comparing((ReportResultRowDto r) -> metric(r, "REVENUE")).reversed())
                .toList();

        final List<List<String>> rows = sorted.stream()
                .map(r -> List.of(r.dimensionValues().get(0),
                        money(metric(r, "REVENUE"), currency),
                        percent(metric(r, "OCCUPANCY")),
                        money(metric(r, "ADR"), currency)))
                .collect(Collectors.toList());

        final ReportChart chart = new ReportChart(ReportChartType.HORIZONTAL_BARS,
                sorted.stream().map(r -> r.dimensionValues().get(0)).toList(),
                List.of(ReportSeries.of("revenue", "Revenus",
                        sorted.stream().map(r -> metric(r, "REVENUE")).toList())),
                "money");

        final List<ReportNote> notes = new ArrayList<>();
        if (!sorted.isEmpty()) {
            final ReportResultRowDto best = sorted.get(0);
            notes.add(ReportNote.positive("Meilleure contribution",
                    best.dimensionValues().get(0))
                    .withImpact(money(metric(best, "REVENUE"), currency)));
            final ReportResultRowDto worst = sorted.get(sorted.size() - 1);
            if (sorted.size() > 1) {
                notes.add(ReportNote.warning("Contribution la plus faible",
                        worst.dimensionValues().get(0) + " — "
                        + percent(metric(worst, "OCCUPANCY")) + " d'occupation")
                        .withImpact(money(metric(worst, "REVENUE"), currency)));
            }
        }

        return new ReportSection(S_PROPERTIES, "Détail par bien",
                "Contribution de chaque logement au résultat",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Bien", "Revenus", "Occupation", "Prix moyen"),
                        ReportTable.numericAligns(4), rows, List.of()),
                chart, notes, null, null);
    }

    /**
     * Ce qui a ete fait sur le terrain.
     *
     * <p>Presque aucun releve ne porte cette section, et c'est pourtant elle qui
     * justifie la commission de gestion aux yeux d'un proprietaire : le nombre
     * d'interventions menees, et ce qu'elles ont coute.</p>
     */
    private ReportSection operations(LocalDate from, LocalDate to, Long orgId,
                                     ReportScope scope, String currency) {
        final Set<Long> ids = scope.propertyIds();
        final List<Intervention> interventions = interventionRepository
                .findAllByDateRange(from.atStartOfDay(), to.atTime(LocalTime.MAX), orgId).stream()
                .filter(i -> i.getProperty() != null)
                .filter(i -> ids.isEmpty() || ids.contains(i.getProperty().getId()))
                .toList();

        // Regroupe sur le LIBELLE et non sur le code : deux codes distincts qui
        // portent le meme intitule doivent se compter ensemble aux yeux du lecteur.
        final Map<String, List<Intervention>> byType = interventions.stream()
                .collect(Collectors.groupingBy(i -> interventionTypeLabel(i.getType()),
                        LinkedHashMap::new, Collectors.toList()));

        final List<List<String>> rows = new ArrayList<>();
        BigDecimal totalCost = BigDecimal.ZERO;
        for (Map.Entry<String, List<Intervention>> entry : byType.entrySet()) {
            final BigDecimal cost = entry.getValue().stream()
                    .map(this::costOf).reduce(BigDecimal.ZERO, BigDecimal::add);
            totalCost = totalCost.add(cost);
            rows.add(List.of(entry.getKey(), count(entry.getValue().size()), money(cost, currency)));
        }

        final long completed = interventions.stream()
                .filter(i -> i.getStatus() != null && "COMPLETED".equalsIgnoreCase(i.getStatus().toString()))
                .count();

        final List<ReportNote> notes = new ArrayList<>();
        notes.add(ReportNote.neutral("Interventions menées",
                count(interventions.size()) + " sur la période, dont " + count(completed) + " terminées")
                .withImpact(money(totalCost, currency)));

        return new ReportSection(S_OPERATIONS, "Ce que nous avons fait",
                "Interventions réalisées sur vos biens et leur coût",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Nature", "Nombre", "Coût"),
                        ReportTable.numericAligns(3), rows,
                        List.of("Total", count(interventions.size()), money(totalCost, currency))),
                null, notes, null, null);
    }

    /**
     * Ce qui est déjà dans les livres pour les mois à venir.
     *
     * <p>Le reste du document regarde derrière ; cette section est la seule qui
     * regarde devant. Et elle ne PRÉDIT rien : elle compte des nuits réellement
     * réservées, comparées à l'an dernier au même recul. Un propriétaire peut
     * discuter un modèle statistique ; il ne discute pas une réservation
     * enregistrée.</p>
     *
     * <p>Le « même recul » est ce qui rend la comparaison honnête : à la
     * mi-septembre, novembre n'est jamais rempli — la question est de savoir
     * s'il l'est plus ou moins qu'à la mi-septembre l'an dernier.</p>
     */
    private ReportSection outlook(ReportScope scope, Long orgId, String currency) {
        final PaceSummaryDto pace = paceService.getSummary(orgId, scope.ownerKeycloakId(),
                OUTLOOK_MONTHS, scope.properties().size() == 1
                        ? scope.properties().get(0).getId() : null);
        final List<PaceMonthDto> months = pace.months();
        if (months.isEmpty()) {
            return null;
        }

        final List<String> categories = months.stream().map(m -> monthLabel(m.month())).toList();
        final List<List<String>> rows = new ArrayList<>();
        long totalOtb = 0;
        long totalStly = 0;
        long totalPickup = 0;
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (PaceMonthDto month : months) {
            totalOtb += month.otbNights();
            totalStly += month.stlyNights();
            totalPickup += month.pickup7Nights();
            totalRevenue = totalRevenue.add(nz(month.otbRevenue()));
            rows.add(List.of(
                    monthLabel(month.month()),
                    count(month.otbNights()),
                    count(month.stlyNights()),
                    month.paceVsStlyPct() == null ? "—"
                            : signedPercent(BigDecimal.valueOf(month.paceVsStlyPct())),
                    "+" + count(month.pickup7Nights()),
                    month.occupancyOtbPct() == null ? "—"
                            : percent(BigDecimal.valueOf(month.occupancyOtbPct())),
                    money(nz(month.otbRevenue()), currency)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        final List<PaceMonthDto> behind = months.stream()
                .filter(m -> m.paceVsStlyPct() != null && m.paceVsStlyPct() < 0).toList();
        if (behind.isEmpty()) {
            notes.add(ReportNote.positive("Aucun mois en retard",
                    "Chaque mois à venir est au moins au niveau de l'an dernier au même recul"));
        } else {
            final PaceMonthDto worst = behind.stream()
                    .min(Comparator.comparingDouble(PaceMonthDto::paceVsStlyPct)).orElseThrow();
            notes.add(ReportNote.warning("Mois en retard sur l'an dernier",
                    behind.size() + " mois concerné(s), le plus en retard étant " + monthLabel(worst.month()))
                    .withImpact(signedPercent(BigDecimal.valueOf(worst.paceVsStlyPct()))));
        }
        notes.add(ReportNote.neutral("Réservations prises cette semaine",
                "Nuits gagnées sur les sept derniers jours, tous mois à venir confondus")
                .withImpact("+" + count(totalPickup)));
        notes.add(ReportNote.neutral("Revenu déjà sécurisé",
                "Montant des nuits déjà réservées sur les " + OUTLOOK_MONTHS + " prochains mois")
                .withImpact(money(totalRevenue, currency)));

        return new ReportSection(S_OUTLOOK, "Perspectives",
                "Nuits déjà réservées pour les mois à venir, face à l'an dernier au même recul",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(
                        List.of("Mois", "Nuits réservées", "An dernier", "Écart", "Cette semaine",
                                "Occupation", "Revenu acquis"),
                        ReportTable.numericAligns(7), rows,
                        List.of("Total", count(totalOtb), count(totalStly),
                                totalStly > 0 ? signedPercent(growth(BigDecimal.valueOf(totalOtb),
                                        BigDecimal.valueOf(totalStly))) : "—",
                                "+" + count(totalPickup), "", money(totalRevenue, currency))),
                new ReportChart(ReportChartType.BARS, categories,
                        List.of(ReportSeries.of("otb", "Déjà réservé",
                                        months.stream().map(m -> BigDecimal.valueOf(m.otbNights())).toList()),
                                ReportSeries.of("stly", "An dernier",
                                        months.stream().map(m -> BigDecimal.valueOf(m.stlyNights())).toList())
                                        .withTone("neutral")),
                        "count"),
                notes, null, null);
    }

    /**
     * Ce qu'il faut décider.
     *
     * <p>Les recommandations sont DÉRIVÉES du document lui-même, jamais d'un
     * modèle opaque : chaque ligne s'explique par un calcul que le lecteur peut
     * refaire. « 236 nuits invendues à 137,81 € l'ADR » se discute ; « notre
     * modèle suggère de baisser les prix » ne se discute pas, et c'est
     * précisément ce qui fait qu'on ne l'applique jamais.</p>
     *
     * <p>Chaque action porte un impact chiffré et un horizon. Sans montant, une
     * recommandation n'est qu'un avis ; c'est le montant qui la fait arbitrer
     * face aux autres.</p>
     */
    private ReportSection decisions(Totals current, Totals lastYear, ReportScope scope,
                                    LocalDate from, LocalDate to, Long orgId, String currency) {
        final List<List<String>> rows = new ArrayList<>();
        final List<ReportNote> notes = new ArrayList<>();

        // 1. L'occupation sous la cible : le manque a gagner se chiffre exactement.
        final BigDecimal occupancy = current.occupancy();
        if (occupancy.compareTo(BigDecimal.valueOf(OCCUPANCY_TARGET)) < 0 && current.availableNights() > 0) {
            final long sellable = Math.round(current.availableNights()
                    * (OCCUPANCY_TARGET - occupancy.doubleValue()) / 100.0);
            final BigDecimal upside = current.adr().multiply(BigDecimal.valueOf(sellable));
            rows.add(List.of("Remplissage",
                    "Atteindre " + OCCUPANCY_TARGET + " % d'occupation : " + count(sellable)
                    + " nuits à vendre de plus, au prix moyen actuel",
                    money(upside, currency)));
        }

        // 2. Le poids des commissions : ce que la vente directe economiserait.
        if (current.revenue.signum() > 0 && current.fees.signum() > 0) {
            final BigDecimal feeRate = current.fees.multiply(BigDecimal.valueOf(100))
                    .divide(current.revenue, 1, RoundingMode.HALF_UP);
            if (feeRate.compareTo(BigDecimal.valueOf(COMMISSION_ALERT_PCT)) > 0) {
                final BigDecimal saved = current.fees.multiply(BigDecimal.valueOf(DIRECT_SHIFT_PCT))
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                rows.add(List.of("Distribution",
                        "Les canaux prélèvent " + percent(feeRate) + " du chiffre d'affaires. Basculer "
                        + DIRECT_SHIFT_PCT + " % du volume vers la réservation directe",
                        money(saved, currency)));
            }
        }

        // 3. Le poids des charges.
        if (current.revenue.signum() > 0 && current.costs.signum() > 0) {
            final BigDecimal costRate = current.costs.multiply(BigDecimal.valueOf(100))
                    .divide(current.revenue, 1, RoundingMode.HALF_UP);
            if (costRate.compareTo(BigDecimal.valueOf(COST_ALERT_PCT)) > 0) {
                rows.add(List.of("Charges",
                        "Les charges d'exploitation pèsent " + percent(costRate)
                        + " des revenus, au-delà du seuil de " + COST_ALERT_PCT + " % : revoir les postes "
                        + "les plus lourds du détail des interventions",
                        money(current.costs, currency)));
            }
        }

        // 4. Le recul sur un an.
        final BigDecimal yoy = growth(current.revenue, lastYear.revenue);
        if (yoy != null && yoy.signum() < 0) {
            rows.add(List.of("Tendance",
                    "Les revenus reculent de " + signedPercent(yoy) + " sur un an : comparer la grille "
                    + "tarifaire et la visibilité des annonces à celles de l'an dernier",
                    money(lastYear.revenue.subtract(current.revenue), currency)));
        }

        // 5. Le pace des mois a venir.
        final PaceSummaryDto pace = paceService.getSummary(orgId, scope.ownerKeycloakId(),
                OUTLOOK_MONTHS, scope.properties().size() == 1
                        ? scope.properties().get(0).getId() : null);
        final List<PaceMonthDto> behind = pace.months().stream()
                .filter(m -> m.paceVsStlyPct() != null && m.paceVsStlyPct() < PACE_ALERT_PCT)
                .toList();
        if (!behind.isEmpty()) {
            final long gap = behind.stream().mapToLong(m -> Math.max(0, m.stlyNights() - m.otbNights())).sum();
            rows.add(List.of("Anticipation",
                    behind.size() + " mois à venir sont en retard sur l'an dernier au même recul : "
                    + count(gap) + " nuits à rattraper, à traiter avant que la fenêtre ne se referme",
                    money(current.adr().multiply(BigDecimal.valueOf(gap)), currency)));
        }

        if (rows.isEmpty()) {
            notes.add(ReportNote.positive("Aucune action prioritaire",
                    "Occupation, commissions, charges et pace sont tous dans leurs seuils sur cette période"));
        } else {
            notes.add(ReportNote.neutral("Lecture des montants",
                    "Chaque montant est le gain — ou la perte évitée — que l'action représenterait sur une "
                    + "période équivalente, au prix moyen constaté. Ce sont des ordres de grandeur, pas des "
                    + "engagements"));
        }

        return new ReportSection(S_DECISIONS, "Ce qu'il faut décider",
                "Actions prioritaires, chiffrées à partir des données de ce document",
                ReportSectionKind.LIST,
                rows.isEmpty() ? null : new ReportTable(
                        List.of("Sujet", "Action", "Enjeu estimé"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.END),
                        rows, List.of()),
                null, notes, null, null);
    }

    /**
     * Ce qui ne s'est PAS produit.
     *
     * <p>Le moteur exclut les séjours annulés du chiffre d'affaires — c'est
     * juste — mais aucune section ne les COMPTAIT. Un propriétaire voyait donc
     * un mois moyen sans apprendre qu'il avait perdu quatre réservations. Une
     * annulation est une information de gestion, pas un non-événement.</p>
     */
    private ReportSection cancellations(LocalDate from, LocalDate to, Long orgId,
                                        Set<Long> propertyIds, String currency) {
        final List<Reservation> cancelled = reservationRepository
                .findOverlappingWindowForPace(from, to.plusDays(1), orgId, null, null).stream()
                .filter(r -> "cancelled".equalsIgnoreCase(String.valueOf(r.getStatus())))
                .filter(r -> r.getProperty() != null)
                .filter(r -> propertyIds.isEmpty() || propertyIds.contains(r.getProperty().getId()))
                .sorted(Comparator.comparing(Reservation::getCheckIn))
                .toList();

        if (cancelled.isEmpty()) {
            return null;
        }

        final List<List<String>> rows = new ArrayList<>();
        BigDecimal lost = BigDecimal.ZERO;
        long lostNights = 0;
        for (Reservation stay : cancelled) {
            final long nights = Math.max(1, ChronoUnit.DAYS.between(stay.getCheckIn(), stay.getCheckOut()));
            final BigDecimal price = nz(stay.getTotalPrice());
            lost = lost.add(price);
            lostNights += nights;
            rows.add(List.of(
                    SHORT_DATE.format(stay.getCheckIn()),
                    stay.getProperty().getName(),
                    channelLabel(stay),
                    count(nights),
                    money(price, currency)));
        }

        return new ReportSection(S_CANCELLATIONS, "Réservations annulées",
                "Séjours perdus sur la période, exclus des revenus",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Arrivée prévue", "Bien", "Canal", "Nuits", "Montant"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.START,
                                ReportAlign.END, ReportAlign.END),
                        rows,
                        List.of("Total", "", "", count(lostNights), money(lost, currency))),
                null,
                List.of(ReportNote.warning("Chiffre d'affaires non réalisé",
                        count(cancelled.size()) + " réservation(s) annulée(s), représentant "
                        + count(lostNights) + " nuits")
                        .withImpact(money(lost, currency))),
                null, null);
    }

    /**
     * Ce que dit la clientèle.
     *
     * <p>La note moyenne n'est pas un ornement : elle précède les revenus de
     * quelques mois. Une section qui la tait laisse croire qu'un mois faible est
     * conjoncturel alors qu'il est peut-être la conséquence de trois avis à deux
     * étoiles.</p>
     */
    private ReportSection reputation(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds) {
        final List<GuestReview> reviews = new ArrayList<>();
        for (Long propertyId : propertyIds) {
            reviews.addAll(reviewRepository.findByPropertyIdAndDateRange(propertyId, orgId, from, to));
        }
        if (reviews.isEmpty()) {
            return null;
        }

        final List<GuestReview> rated = reviews.stream().filter(r -> r.getRating() != null).toList();
        if (rated.isEmpty()) {
            return null;
        }
        final double average = rated.stream().mapToInt(GuestReview::getRating).average().orElse(0);
        final Map<Integer, Long> distribution = rated.stream()
                .collect(Collectors.groupingBy(GuestReview::getRating, TreeMap::new, Collectors.counting()));

        final List<String> categories = new ArrayList<>();
        final List<BigDecimal> counts = new ArrayList<>();
        distribution.forEach((rating, howMany) -> {
            categories.add(rating + "★");
            counts.add(BigDecimal.valueOf(howMany));
        });

        final long negative = rated.stream().filter(r -> r.getRating() <= NEGATIVE_RATING).count();
        final List<ReportNote> notes = new ArrayList<>();
        notes.add(ReportNote.neutral("Note moyenne",
                count(rated.size()) + " avis reçus sur la période")
                .withImpact(decimal(BigDecimal.valueOf(average), 1) + " / 5"));
        if (negative > 0) {
            notes.add(ReportNote.warning("Avis négatifs",
                    "Note inférieure ou égale à " + NEGATIVE_RATING + " — chacun pèse durablement sur le "
                    + "classement des annonces")
                    .withImpact(count(negative)));
        }

        return new ReportSection(S_REPUTATION, "Ce que disent les voyageurs",
                "Avis reçus sur la période et leur répartition",
                ReportSectionKind.CHART,
                null,
                new ReportChart(ReportChartType.HORIZONTAL_BARS, categories,
                        List.of(ReportSeries.of("count", "Avis", counts)), "count"),
                notes, null, null);
    }

    /**
     * Chaque bien face a la moyenne et au meilleur.
     *
     * <p>Un classement dit QUI est devant ; il ne dit pas de combien on peut
     * encore progresser. L'ecart au meilleur bien du meme portefeuille chiffre
     * ce qui reste a gagner sur un comparable — meme gestionnaire, meme marche,
     * meme saison. C'est le seul etalon defendable : comparer un studio parisien
     * a une moyenne nationale n'apprend rien.</p>
     */
    private ReportSection benchmark(LocalDate from, LocalDate to, Long orgId,
                                    Set<Long> propertyIds, String currency) {
        final ReportResultDto result = executionService.execute(
                List.of("PROPERTY"), List.of("REVENUE", "OCCUPANCY", "ADR", "MARGIN"),
                "MONTH", from, to, orgId, propertyIds);
        if (result.rows().size() < 2) {
            return null;
        }

        final List<ReportResultRowDto> rows = result.rows();
        final BigDecimal avgOccupancy = average(rows, "OCCUPANCY");
        final BigDecimal avgAdr = average(rows, "ADR");
        final BigDecimal avgRevenue = average(rows, "REVENUE");

        final ReportResultRowDto best = rows.stream()
                .max(Comparator.comparing(r -> metric(r, "REVENUE"))).orElseThrow();

        final List<List<String>> table = new ArrayList<>();
        for (ReportResultRowDto row : rows.stream()
                .sorted(Comparator.comparing((ReportResultRowDto r) -> metric(r, "REVENUE")).reversed())
                .toList()) {
            final BigDecimal revenue = metric(row, "REVENUE");
            table.add(List.of(
                    row.dimensionValues().get(0),
                    money(revenue, currency),
                    signedPercent(growth(revenue, avgRevenue)),
                    percent(metric(row, "OCCUPANCY")),
                    signedPercent(metric(row, "OCCUPANCY").subtract(avgOccupancy)),
                    money(metric(row, "MARGIN"), currency)));
        }

        // L'ecart-type dit si le portefeuille est homogene : une moyenne
        // flatteuse peut cacher un bien qui coule et un autre qui compense.
        final BigDecimal spread = standardDeviation(rows, avgOccupancy);

        final List<ReportNote> notes = List.of(
                ReportNote.neutral("Moyenne du portefeuille",
                        percent(avgOccupancy) + " d'occupation, " + money(avgAdr, currency) + " de prix moyen")
                        .withImpact(money(avgRevenue, currency)),
                ReportNote.positive("Reference", best.dimensionValues().get(0))
                        .withImpact(money(metric(best, "REVENUE"), currency)),
                (spread.compareTo(BigDecimal.valueOf(HETEROGENEOUS_SPREAD)) > 0
                        ? ReportNote.warning("Portefeuille heterogene",
                                "Les taux d'occupation s'ecartent fortement de la moyenne : "
                                + "la performance d'ensemble repose sur quelques biens")
                        : ReportNote.neutral("Portefeuille homogene",
                                "Les biens se tiennent autour de la moyenne"))
                        .withImpact(percent(spread) + " d'ecart-type"));

        return new ReportSection(S_BENCHMARK, "Comparaison entre biens",
                "Chaque logement face a la moyenne du portefeuille",
                ReportSectionKind.TABLE,
                new ReportTable(
                        List.of("Bien", "Revenus", "vs moyenne", "Occupation", "Ecart", "Marge"),
                        ReportTable.numericAligns(6), table, List.of()),
                null, notes, null, null);
    }

    /**
     * Les faits marquants.
     *
     * <p>Un digest, place avant tout le reste : il ne calcule rien, il
     * HIERARCHISE. Sur treize sections, le lecteur pressé doit savoir en dix
     * lignes ce qui a bouge et ce qui appelle une decision — sans quoi il lit la
     * premiere page et referme.</p>
     *
     * <p>Il repete donc volontairement des constats presentes plus loin. C'est
     * la seule repetition acceptee du document : ailleurs, dire deux fois la
     * meme chose est un defaut ; ici, la premiere occurrence est un sommaire et
     * la seconde son contexte.</p>
     *
     * <p>Ordre : ce qui alerte d'abord, ce qui rassure ensuite. Un rapport qui
     * ouvre sur ses bonnes nouvelles enterre ses mauvaises.</p>
     */
    private ReportSection highlights(List<ReportSection> sections) {
        final List<ReportNote> ranked = sections.stream()
                .flatMap(section -> section.notes().stream())
                .filter(note -> !"neutral".equals(note.tone()))
                .sorted(Comparator.comparingInt(ReportSnapshotBuilder::severity).reversed())
                .limit(MAX_HIGHLIGHTS)
                .toList();

        if (ranked.isEmpty()) {
            return null;
        }
        return new ReportSection(S_HIGHLIGHTS, "Faits marquants",
                "Ce qui a bougé sur la période, et ce qui appelle une décision",
                ReportSectionKind.LIST, null, null, ranked, null, null);
    }

    private static int severity(ReportNote note) {
        return switch (note.tone()) {
            case "critical" -> 3;
            case "warning" -> 2;
            case "positive" -> 1;
            default -> 0;
        };
    }

    /**
     * Le motif saisonnier du parc.
     *
     * <p>Deux ans de recul, regroupes par mois de l'annee : c'est ce qui separe
     * un creux STRUCTUREL d'un mauvais mois. Un fevrier faible n'appelle pas la
     * meme decision selon qu'il l'est tous les ans ou pour la premiere fois.</p>
     *
     * <p>Rendue seulement si l'historique couvre une annee pleine : moyenner
     * trois mois et appeler cela une saisonnalite serait une invention.</p>
     */
    private ReportSection seasonality(LocalDate to, Long orgId, Set<Long> propertyIds,
                                      String currency) {
        final LocalDate from = to.minusMonths(SEASONALITY_MONTHS).withDayOfMonth(1);
        final ReportResultDto result = executionService.execute(
                List.of("PERIOD"), List.of("REVENUE", "OCCUPANCY"), "MONTH", from, to,
                orgId, propertyIds);

        final Map<Integer, List<ReportResultRowDto>> byMonthOfYear = new TreeMap<>();
        for (ReportResultRowDto row : result.rows()) {
            try {
                byMonthOfYear.computeIfAbsent(
                        YearMonth.parse(row.dimensionValues().get(0)).getMonthValue(),
                        k -> new ArrayList<>()).add(row);
            } catch (RuntimeException ignored) {
                // Un libelle de bucket illisible ne doit pas faire tomber la section.
            }
        }
        if (byMonthOfYear.size() < FULL_YEAR) {
            return null;
        }

        final List<String> categories = new ArrayList<>();
        final List<BigDecimal> revenues = new ArrayList<>();
        final List<List<String>> rows = new ArrayList<>();
        for (Map.Entry<Integer, List<ReportResultRowDto>> entry : byMonthOfYear.entrySet()) {
            final BigDecimal revenue = average(entry.getValue(), "REVENUE");
            final BigDecimal occupancy = average(entry.getValue(), "OCCUPANCY");
            final String label = LocalDate.of(2000, entry.getKey(), 1)
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMMM", Locale.FRANCE));
            categories.add(label);
            revenues.add(revenue);
            rows.add(List.of(label, money(revenue, currency), percent(occupancy),
                    count(entry.getValue().size())));
        }

        final int bestIndex = revenues.indexOf(revenues.stream().max(BigDecimal::compareTo).orElseThrow());
        final int worstIndex = revenues.indexOf(revenues.stream().min(BigDecimal::compareTo).orElseThrow());

        return new ReportSection(S_SEASONALITY, "Saisonnalité",
                "Moyenne par mois de l'année, sur les " + SEASONALITY_MONTHS + " derniers mois",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Mois", "Revenus moyens", "Occupation moyenne", "Années observées"),
                        ReportTable.numericAligns(4), rows, List.of()),
                new ReportChart(ReportChartType.BARS, categories,
                        List.of(ReportSeries.of("revenue", "Revenus moyens", revenues)), "money"),
                List.of(ReportNote.positive("Mois le plus porteur", categories.get(bestIndex))
                                .withImpact(money(revenues.get(bestIndex), currency)),
                        ReportNote.warning("Creux structurel", categories.get(worstIndex)
                                + " — a traiter par le tarif ou la durée minimale, pas par l'effort commercial")
                                .withImpact(money(revenues.get(worstIndex), currency))),
                null, null);
    }

    /**
     * A quelle distance on reserve.
     *
     * <p>Cette distribution dit QUAND agir, ce qu'aucune autre section ne donne.
     * Un parc reserve majoritairement a moins de sept jours ne se pilote pas
     * comme un parc reserve trois mois a l'avance : dans le premier cas une
     * baisse de prix produit son effet en quelques jours, dans le second elle
     * arrive trop tard pour le mois en cours.</p>
     */
    private ReportSection leadTime(List<Reservation> stays) {
        final List<Long> leads = stays.stream()
                .filter(stay -> stay.getCreatedAt() != null)
                .map(stay -> ChronoUnit.DAYS.between(
                        stay.getCreatedAt().toLocalDate(), stay.getCheckIn()))
                .filter(days -> days >= 0)
                .sorted()
                .toList();
        if (leads.size() < MIN_LEADTIME_SAMPLE) {
            return null;
        }

        final int[] bounds = {7, 30, 60, 90};
        final String[] labels = {"Moins de 8 jours", "8 à 30 jours", "31 à 60 jours",
                "61 à 90 jours", "Plus de 90 jours"};
        final long[] buckets = new long[labels.length];
        for (Long lead : leads) {
            int index = bounds.length;
            for (int i = 0; i < bounds.length; i++) {
                if (lead <= bounds[i]) {
                    index = i;
                    break;
                }
            }
            buckets[index]++;
        }

        final List<String> categories = new ArrayList<>();
        final List<BigDecimal> counts = new ArrayList<>();
        final List<List<String>> rows = new ArrayList<>();
        for (int i = 0; i < labels.length; i++) {
            categories.add(labels[i]);
            counts.add(BigDecimal.valueOf(buckets[i]));
            rows.add(List.of(labels[i], count(buckets[i]),
                    percent(BigDecimal.valueOf(buckets[i] * 100.0 / leads.size()))));
        }

        // La MEDIANE et non la moyenne : une reservation faite un an a l'avance
        // tirerait la moyenne et donnerait a lire un parc qu'on ne pilote pas.
        final long median = leads.get(leads.size() / 2);

        return new ReportSection(S_LEADTIME, "Délai de réservation",
                "Combien de jours à l'avance les voyageurs réservent",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Délai", "Réservations", "Part"),
                        ReportTable.numericAligns(3), rows,
                        List.of("Total", count(leads.size()), "100 %")),
                new ReportChart(ReportChartType.HORIZONTAL_BARS, categories,
                        List.of(ReportSeries.of("count", "Réservations", counts)), "count"),
                List.of(ReportNote.neutral("Délai médian",
                        "La moitié des séjours sont réservés dans ce délai — c'est la fenêtre "
                        + "dans laquelle une action tarifaire produit encore un effet")
                        .withImpact(count(median) + " jours")),
                null, null);
    }

    /**
     * Le positionnement tarifaire, mois par mois.
     *
     * <p>Prix moyen et remplissage lus ENSEMBLE : separement, ni l'un ni l'autre
     * ne dit si le tarif est juste. Un mois plein a bas prix a laisse de
     * l'argent sur la table ; un mois vide a prix haut a rate des clients. Le
     * verdict tient dans le croisement.</p>
     *
     * <p>Les seuils sont ceux DEJA retenus par le produit pour ses suggestions
     * de rendement (55 % et 85 %, {@code BusinessAnalyticsScanner}). En choisir
     * d'autres ici ferait qu'un rapport et l'assistant conseilleraient l'inverse
     * l'un de l'autre sur les memes chiffres.</p>
     *
     * <p>Le document constate ; il ne fixe pas de prix. Annoncer « appliquez
     * 152 € » sans connaitre la concurrence ni les evenements locaux serait une
     * precision mensongere.</p>
     */
    private ReportSection pricing(LocalDate from, LocalDate to, Long orgId,
                                  Set<Long> propertyIds, String currency) {
        final ReportResultDto months = executionService.execute(
                List.of("PERIOD"), List.of("ADR", "OCCUPANCY", "REVENUE"), "MONTH", from, to,
                orgId, propertyIds);
        if (months.rows().isEmpty()) {
            return null;
        }

        final List<String> categories = new ArrayList<>();
        final List<BigDecimal> adr = new ArrayList<>();
        final List<List<String>> rows = new ArrayList<>();
        int tooLow = 0;
        int tooHigh = 0;

        for (ReportResultRowDto row : months.rows()) {
            final BigDecimal occupancy = metric(row, "OCCUPANCY");
            final BigDecimal price = metric(row, "ADR");
            final String label = monthLabel(row.dimensionValues().get(0));
            final String verdict;
            if (occupancy.doubleValue() > OCCUPANCY_HIGH_PCT) {
                verdict = "Rempli — le tarif pouvait monter";
                tooLow++;
            } else if (occupancy.doubleValue() < OCCUPANCY_LOW_PCT) {
                verdict = "Sous-rempli — tarif ou visibilité à revoir";
                tooHigh++;
            } else {
                verdict = "Équilibré";
            }
            categories.add(label);
            adr.add(price);
            rows.add(List.of(label, money(price, currency), percent(occupancy), verdict));
        }

        final List<ReportNote> notes = new ArrayList<>();
        if (tooLow > 0) {
            notes.add(ReportNote.warning("Mois remplis au-delà de " + (int) OCCUPANCY_HIGH_PCT + " %",
                    "Un parc complet signale un tarif en dessous du marché : la demande a été "
                    + "servie sans que le prix la filtre")
                    .withImpact(count(tooLow) + " mois"));
        }
        if (tooHigh > 0) {
            notes.add(ReportNote.warning("Mois sous " + (int) OCCUPANCY_LOW_PCT + " % de remplissage",
                    "Le tarif, la durée minimale ou la visibilité des annonces sont à revoir")
                    .withImpact(count(tooHigh) + " mois"));
        }
        if (notes.isEmpty()) {
            notes.add(ReportNote.positive("Positionnement cohérent",
                    "Chaque mois se situe entre " + (int) OCCUPANCY_LOW_PCT + " et "
                    + (int) OCCUPANCY_HIGH_PCT + " % de remplissage"));
        }

        return new ReportSection(S_PRICING, "Positionnement tarifaire",
                "Prix moyen et remplissage lus ensemble",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(List.of("Mois", "Prix moyen", "Occupation", "Lecture"),
                        List.of(ReportAlign.START, ReportAlign.END, ReportAlign.END, ReportAlign.START),
                        rows, List.of()),
                new ReportChart(ReportChartType.LINES, categories,
                        List.of(ReportSeries.of("adr", "Prix moyen", adr)), "money"),
                notes, null, null);
    }

    /**
     * Le detail des charges, intervention par intervention.
     *
     * <p>La section « Ce que nous avons fait » regroupe par nature : elle dit
     * COMBIEN. Celle-ci dit QUOI, quand et sur quel bien — c'est ce qu'un
     * proprietaire demande des qu'un montant l'etonne, et sans quoi il faut
     * decrocher son telephone.</p>
     */
    private ReportSection expenses(LocalDate from, LocalDate to, Long orgId,
                                   ReportScope scope, String currency) {
        final Set<Long> ids = scope.propertyIds();
        final List<Intervention> interventions = interventionRepository
                .findAllByDateRange(from.atStartOfDay(), to.atTime(LocalTime.MAX), orgId).stream()
                .filter(i -> i.getProperty() != null && i.getScheduledDate() != null)
                .filter(i -> ids.isEmpty() || ids.contains(i.getProperty().getId()))
                .filter(i -> costOf(i).signum() != 0)
                .sorted(Comparator.comparing(Intervention::getScheduledDate))
                .toList();
        if (interventions.isEmpty()) {
            return null;
        }

        final List<List<String>> rows = new ArrayList<>(interventions.size());
        BigDecimal total = BigDecimal.ZERO;
        int estimated = 0;
        for (Intervention intervention : interventions) {
            final BigDecimal cost = costOf(intervention);
            total = total.add(cost);
            // Un cout ESTIME et un cout constate ne s'additionnent pas sans le
            // dire : le total serait presente comme arrete alors qu'il bougera.
            final boolean isEstimate = intervention.getActualCost() == null;
            if (isEstimate) {
                estimated++;
            }
            rows.add(List.of(
                    SHORT_DATE.format(intervention.getScheduledDate().toLocalDate()),
                    intervention.getProperty().getName(),
                    interventionTypeLabel(intervention.getType()),
                    isEstimate ? "Estimé" : "Constaté",
                    money(cost, currency)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        if (estimated > 0) {
            notes.add(ReportNote.warning("Coûts encore estimés",
                    "Ces montants proviennent du devis et non de la facture : le total peut "
                    + "évoluer")
                    .withImpact(count(estimated) + " sur " + count(interventions.size())));
        }

        return new ReportSection(S_EXPENSES, "Détail des charges",
                "Chaque intervention facturée sur la période",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Date", "Bien", "Nature", "Montant", "Coût"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.START,
                                ReportAlign.START, ReportAlign.END),
                        rows,
                        List.of("Total", "", "", "", money(total, currency))),
                null, notes, null, null);
    }

    /**
     * Ce qui est encaisse, et ce qui ne l'est pas encore.
     *
     * <p>Un releve qui annonce un net proprietaire sans dire si l'argent est
     * ARRIVE laisse croire a une tresorerie qu'on n'a pas. Un sejour confirme et
     * non regle n'est pas un revenu acquis : c'est une creance.</p>
     */
    private ReportSection settlement(List<Reservation> stays, String currency) {
        final Map<String, List<Reservation>> byStatus = new LinkedHashMap<>();
        for (Reservation stay : stays) {
            byStatus.computeIfAbsent(paymentLabel(stay), k -> new ArrayList<>()).add(stay);
        }
        if (byStatus.isEmpty()) {
            return null;
        }

        final List<List<String>> rows = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal outstanding = BigDecimal.ZERO;
        for (Map.Entry<String, List<Reservation>> entry : byStatus.entrySet()) {
            final BigDecimal amount = entry.getValue().stream()
                    .map(r -> nz(r.getTotalPrice())).reduce(BigDecimal.ZERO, BigDecimal::add);
            total = total.add(amount);
            if (!"Réglé".equals(entry.getKey())) {
                outstanding = outstanding.add(amount);
            }
            rows.add(List.of(entry.getKey(), count(entry.getValue().size()), money(amount, currency)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        if (outstanding.signum() > 0) {
            notes.add(ReportNote.warning("Reste à encaisser",
                    "Séjours confirmés dont le règlement n'est pas constaté — une créance, "
                    + "pas un revenu acquis")
                    .withImpact(money(outstanding, currency)));
        } else {
            notes.add(ReportNote.positive("Tout est encaissé",
                    "Aucun séjour de la période n'attend son règlement"));
        }

        return new ReportSection(S_SETTLEMENT, "Encaissements",
                "Où en est le règlement des séjours de la période",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("État du règlement", "Séjours", "Montant"),
                        ReportTable.numericAligns(3), rows,
                        List.of("Total", count(stays.size()), money(total, currency))),
                null, notes, null, null);
    }

    /** Libelle lisible d'un etat de reglement — le statut brut ne se montre pas. */
    private static String paymentLabel(Reservation stay) {
        final Object status = stay.getPaymentStatus();
        if (status == null) {
            return "Non renseigné";
        }
        return switch (status.toString().toUpperCase(Locale.ROOT)) {
            case "PAID", "SUCCEEDED", "COMPLETED" -> "Réglé";
            case "PENDING", "REQUIRES_PAYMENT_METHOD", "PROCESSING" -> "En attente";
            case "PARTIALLY_PAID", "PARTIAL" -> "Acompte versé";
            case "FAILED", "CANCELED", "CANCELLED" -> "Échec de paiement";
            case "REFUNDED" -> "Remboursé";
            default -> "Non renseigné";
        };
    }

    /**
     * Les ventes additionnelles.
     *
     * <p>Elles n'entrent PAS dans les revenus locatifs — ce sont des prestations
     * vendues en marge du sejour. Les fondre dans le chiffre d'affaires
     * gonflerait l'ADR et fausserait toute lecture tarifaire ; elles ont donc
     * leur propre section, avec la part qui revient a l'hote.</p>
     */
    private ReportSection upsells(LocalDate from, LocalDate to, Long orgId,
                                  List<Reservation> stays, String currency) {
        final Set<Long> stayIds = stays.stream().map(Reservation::getId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (stayIds.isEmpty()) {
            return null;
        }

        final List<com.clenzy.model.UpsellOrder> orders = upsellOrderRepository
                .findByOrganizationIdOrderByCreatedAtDesc(orgId).stream()
                .filter(order -> order.getReservationId() != null
                        && stayIds.contains(order.getReservationId()))
                .filter(order -> order.getStatus() != null
                        && "PAID".equalsIgnoreCase(order.getStatus().name()))
                .toList();
        if (orders.isEmpty()) {
            return null;
        }

        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal host = BigDecimal.ZERO;
        for (com.clenzy.model.UpsellOrder order : orders) {
            gross = gross.add(nz(order.getAmount()));
            host = host.add(nz(order.getHostAmount()));
        }

        return new ReportSection(S_UPSELLS, "Ventes additionnelles",
                "Prestations vendues en marge des séjours",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Poste", "Nombre", "Montant"),
                        ReportTable.numericAligns(3),
                        List.of(List.of("Encaissé auprès des voyageurs", count(orders.size()),
                                        money(gross, currency)),
                                List.of("Dont part revenant à l'hôte", "", money(host, currency))),
                        List.of()),
                null,
                List.of(ReportNote.positive("Revenu hors location",
                        "Ces montants s'ajoutent au séjour et n'entrent pas dans le prix moyen "
                        + "par nuit")
                        .withImpact(money(host, currency))),
                null, null);
    }

    /**
     * Les nuisances signalees.
     *
     * <p>Une alerte de bruit n'est pas qu'un desagrement de voisinage : c'est le
     * signal avance d'un litige, d'un avis negatif ou d'une plainte en mairie.
     * La faire figurer permet au proprietaire de comprendre, trois mois plus
     * tard, pourquoi sa note a baisse.</p>
     */
    private ReportSection nuisances(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds) {
        final List<com.clenzy.model.NoiseAlert> alerts = noiseAlertRepository
                .findByOrganizationId(orgId, org.springframework.data.domain.PageRequest.of(0, 500))
                .getContent().stream()
                .filter(alert -> alert.getCreatedAt() != null)
                .filter(alert -> !alert.getCreatedAt().toLocalDate().isBefore(from)
                        && !alert.getCreatedAt().toLocalDate().isAfter(to))
                .filter(alert -> propertyIds.isEmpty()
                        || (alert.getPropertyId() != null && propertyIds.contains(alert.getPropertyId())))
                .toList();
        if (alerts.isEmpty()) {
            return null;
        }

        final Map<String, Long> byProperty = alerts.stream().collect(Collectors.groupingBy(
                alert -> alert.getProperty() != null && alert.getProperty().getName() != null
                        ? alert.getProperty().getName() : "Bien inconnu",
                LinkedHashMap::new, Collectors.counting()));

        final List<List<String>> rows = byProperty.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> List.of(entry.getKey(), count(entry.getValue())))
                .collect(Collectors.toList());

        return new ReportSection(S_NUISANCES, "Nuisances signalées",
                "Alertes de bruit relevées sur la période",
                ReportSectionKind.TABLE,
                new ReportTable(List.of("Bien", "Alertes"),
                        List.of(ReportAlign.START, ReportAlign.END), rows,
                        List.of("Total", count(alerts.size()))),
                null,
                List.of(ReportNote.warning("Signal avancé",
                        "Une alerte de bruit précède souvent un avis négatif ou une plainte : "
                        + "traitée tôt, elle coûte un message ; traitée tard, une note")
                        .withImpact(count(alerts.size()))),
                null, null);
    }

    /**
     * Les definitions.
     *
     * <p>Sans elles, « RevPAR » et « ADR » font decrocher un proprietaire non
     * professionnel : le document impressionne au lieu d'informer. Reserve au
     * profil proprietaire — l'equipe interne connait le vocabulaire.</p>
     */
    private ReportSection glossary() {
        final List<List<String>> rows = List.of(
                List.of("Revenus bruts", "Total des loyers perçus, avant toute déduction."),
                List.of("Nuits vendues", "Nombre de nuits effectivement occupées par un voyageur."),
                List.of("Occupation", "Part des nuits disponibles qui ont été vendues."),
                List.of("Prix moyen (ADR)", "Revenus divisés par le nombre de nuits vendues."),
                List.of("RevPAR", "Revenus rapportés à TOUTES les nuits disponibles, vendues ou "
                        + "non. Il réunit le prix et le remplissage en un seul chiffre."),
                List.of("Taux d'annulation", "Part des réservations annulées après confirmation."),
                List.of("Mix de distribution", "Répartition des revenus entre les canaux de "
                        + "réservation (Airbnb, Booking.com, direct…)."),
                List.of("Délai de réservation", "Nombre de jours entre la réservation et l'arrivée. "
                        + "Il dit combien de temps à l'avance on peut encore agir sur le prix."),
                List.of("Rythme de remplissage", "Comparaison du carnet à date avec celui de la "
                        + "même période l'an dernier, à la même distance de l'arrivée."),
                List.of("Commission de canal", "Part prélevée par la plateforme de réservation."),
                List.of("Commission de gestion", "Part revenant au gestionnaire au titre du mandat."),
                List.of("Taxe de séjour", "Taxe collectée pour le compte de la commune. Elle "
                        + "transite par le compte mais n'est jamais un revenu."),
                List.of("Charges d'exploitation", "Ménage, maintenance et interventions de la période."),
                List.of("Net propriétaire", "Ce qui vous revient après commissions et charges."));

        return new ReportSection(S_GLOSSARY, "Définitions",
                "Les indicateurs employés dans ce document",
                ReportSectionKind.GLOSSARY,
                new ReportTable(List.of("Terme", "Définition"),
                        List.of(ReportAlign.START, ReportAlign.START), rows, List.of()),
                null, List.of(), null, null);
    }

    /**
     * Perimetre et methode.
     *
     * <p>Sans cette page, un rapport n'est pas defendable : « 17 133 € » ne veut
     * rien dire si l'on ignore sur quels biens, quelles dates, et a quel moment
     * les chiffres ont ete arretes.</p>
     */
    private ReportSection notice(ReportScope scope, LocalDate from, LocalDate to, String currency,
                                 List<Reservation> stays) {
        final String body = """
                Ce document couvre %d bien(s) sur la période %s.

                Les revenus sont attribués NUIT PAR NUIT : un séjour à cheval sur deux mois \
                voit son prix réparti au prorata des nuits de chaque mois. Un séjour annulé \
                n'est jamais compté.

                Les comparaisons portent sur deux références : la période précédente de même \
                durée, et la même période l'an dernier.

                Les montants sont exprimés en %s. Ils sont sommés sans conversion : un \
                périmètre multi-devises additionnerait des unités différentes.
                """.formatted(scope.properties().size(), period(from, to), currency);

        // Le document ANNONCAIT que les montants sont sommes sans conversion,
        // mais rien ne verifiait que le perimetre etait bien mono-devise. Une
        // mention generale ne protege personne : ce qu'il faut, c'est savoir
        // QUAND le total additionne des unites differentes.
        final Set<String> currencies = stays.stream()
                .map(Reservation::getCurrency)
                .filter(code -> code != null && !code.isBlank())
                .map(code -> code.toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        final List<ReportNote> notes = currencies.size() > 1
                ? List.of(ReportNote.warning("Périmètre multi-devises",
                        "Des séjours de ce périmètre sont libellés en " + String.join(", ", currencies)
                        + ". Les montants sont additionnés SANS conversion : les totaux de ce "
                        + "document ne sont pas exploitables tels quels")
                        .withImpact(currencies.size() + " devises"))
                : List.<ReportNote>of();

        return new ReportSection(S_NOTICE, "Périmètre et méthode",
                "Ce que ce document couvre, et comment il est calculé",
                ReportSectionKind.NOTICE, null, null, notes, body, null);
    }

    /**
     * Pourquoi ce rapport est vide.
     *
     * <p>Un document qui n'aligne que des zeros et des « aucune donnee » se lit
     * comme une panne. Il ne l'est presque jamais : la periode demandee ne
     * contient simplement aucun sejour. On le dit, et on indique OU l'activite
     * se trouve — c'est la seule information utile a ce moment-la.</p>
     */
    private ReportSection emptyExplanation(ReportScope scope, Long orgId,
                                           LocalDate from, LocalDate to) {
        final List<String> months = activeMonths(scope.propertyIds(), orgId, from);

        final StringBuilder body = new StringBuilder();
        body.append("Aucun séjour n'a été enregistré sur ce périmètre entre le ")
                .append(SHORT_DATE.format(from)).append(" et le ").append(SHORT_DATE.format(to))
                .append(".\n\n");
        if (months.isEmpty()) {
            body.append("Ce périmètre ne porte aucune réservation, quelle que soit la période. "
                    + "Vérifiez que les biens attendus y sont bien rattachés.");
        } else {
            body.append("Les mois qui portent de l'activité sur ce périmètre sont : ")
                    .append(String.join(", ", months))
                    .append(". Choisissez l'un d'eux pour obtenir un rapport chiffré.");
        }

        final List<ReportNote> notes = List.of(
                ReportNote.warning("Période sans séjour",
                        "Les montants de ce document valent zéro parce qu'aucune nuit n'a été vendue, "
                        + "non parce qu'un calcul a échoué"));

        return new ReportSection(S_EMPTY, "Rien à rapporter sur cette période",
                "Ce que contient réellement le périmètre",
                ReportSectionKind.NOTICE, null, null, notes, body.toString(), null);
    }

    /**
     * Occupation mois par mois : ce qui a été vendu, et ce qui est resté vide.
     *
     * <p>La nuit vacante est la seule marchandise périssable du métier : une
     * barre haute et claire est du stock invendu, et c'est la lecture qui
     * déclenche une décision tarifaire.</p>
     */
    private ReportSection occupancy(LocalDate from, LocalDate to, Long orgId,
                                    ReportScope scope, Totals current) {
        final Set<Long> propertyIds = scope.propertyIds();
        final ReportResultDto months = executionService.execute(
                List.of("PERIOD"), List.of("OCCUPANCY"), "MONTH", from, to, orgId, propertyIds);

        // Le MEME compte que le moteur : les biens ACTIFS. Compter aussi les
        // inactifs gonflerait le stock disponible, et donc les nuits vides
        // affichees — un logement retire de la location n'est pas invendu.
        final int propertyCount = activeCount(scope);

        // Les nuits que le proprietaire a lui-meme bloquees ne sont pas du stock
        // invendu : les compter comme telles reprocherait silencieusement au
        // lecteur son propre sejour, ou des travaux qu'il a decides.
        final Map<String, Long> blockedByMonth = blockedNights(from, to, orgId, propertyIds);

        final List<String> categories = new ArrayList<>();
        final List<BigDecimal> occupied = new ArrayList<>();
        final List<BigDecimal> blocked = new ArrayList<>();
        final List<BigDecimal> vacant = new ArrayList<>();
        final List<List<String>> rows = new ArrayList<>();

        for (ReportResultRowDto row : months.rows()) {
            final String key = row.dimensionValues().get(0);
            final String label = monthLabel(key);
            final BigDecimal rate = metric(row, "OCCUPANCY");
            final long available = (long) propertyCount * daysInBucket(key, from, to);
            final long sold = rate.multiply(BigDecimal.valueOf(available))
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValue();
            final long blockedNights = Math.min(blockedByMonth.getOrDefault(key, 0L),
                    Math.max(0, available - sold));
            final long unsold = Math.max(0, available - sold - blockedNights);

            categories.add(label);
            occupied.add(BigDecimal.valueOf(sold));
            blocked.add(BigDecimal.valueOf(blockedNights));
            vacant.add(BigDecimal.valueOf(unsold));
            rows.add(List.of(label, count(sold), count(unsold), count(blockedNights), percent(rate)));
        }

        final List<ReportNote> notes = new ArrayList<>();
        final long totalVacant = vacant.stream().mapToLong(BigDecimal::longValue).sum();
        final long totalBlocked = blocked.stream().mapToLong(BigDecimal::longValue).sum();
        if (totalVacant > 0) {
            notes.add(ReportNote.warning("Nuits invendues",
                    "Nuits ouvertes à la vente qui n'ont pas trouvé preneur — un revenu "
                    + "définitivement perdu, la nuit ne se stocke pas")
                    .withImpact(count(totalVacant)));
        }
        if (totalBlocked > 0) {
            notes.add(ReportNote.neutral("Nuits indisponibles",
                    "Fermées volontairement : séjour du propriétaire, travaux, entretien. "
                    + "Elles ne comptent pas comme invendues")
                    .withImpact(count(totalBlocked)));
        }

        return new ReportSection(S_OCCUPANCY, "Occupation",
                "Nuits vendues, invendues et volontairement fermées, mois par mois",
                ReportSectionKind.CHART_TABLE,
                new ReportTable(
                        List.of("Mois", "Nuits vendues", "Invendues", "Indisponibles", "Occupation"),
                        ReportTable.numericAligns(5), rows,
                        List.of("Total", count(current.nights()), count(totalVacant),
                                count(totalBlocked), percent(current.occupancy()))),
                new ReportChart(ReportChartType.STACKED_BARS, categories,
                        List.of(ReportSeries.of("occupied", "Vendues", occupied).withTone("success"),
                                ReportSeries.of("vacant", "Invendues", vacant).withTone("warning"),
                                ReportSeries.of("blocked", "Indisponibles", blocked).withTone("neutral")),
                        "count"),
                notes, null, null);
    }

    /**
     * L'annexe séjour par séjour.
     *
     * <p>C'est la table qu'un propriétaire ouvre en second, juste après le net :
     * elle lui permet de RECONCILIER le total avec ce qu'il a vu passer. Sans
     * elle, il doit croire le chiffre sur parole.</p>
     */
    private ReportSection staysSection(List<Reservation> stays, LocalDate from,
                                       LocalDate to, String currency) {
        final List<Reservation> sorted = stays.stream()
                .sorted(Comparator.comparing(Reservation::getCheckIn))
                .toList();
        final LocalDate toExclusive = to.plusDays(1);

        final List<List<String>> rows = new ArrayList<>(sorted.size());
        BigDecimal total = BigDecimal.ZERO;
        long totalNights = 0;
        boolean straddles = false;

        for (Reservation stay : sorted) {
            final long stayNights = Math.max(1,
                    ChronoUnit.DAYS.between(stay.getCheckIn(), stay.getCheckOut()));

            // MEME attribution que le moteur : seules les nuits tombant dans la
            // periode comptent, et le prix suit au prorata. Lister le sejour
            // entier ferait diverger cette annexe de la synthese — un
            // proprietaire qui rapproche les deux y verrait un ecart de plusieurs
            // milliers d'euros, alors que l'annexe existe justement pour
            // rapprocher.
            final LocalDate first = stay.getCheckIn().isBefore(from) ? from : stay.getCheckIn();
            final LocalDate lastExclusive = stay.getCheckOut().isBefore(toExclusive)
                    ? stay.getCheckOut() : toExclusive;
            final long nightsInPeriod = Math.max(0, ChronoUnit.DAYS.between(first, lastExclusive));
            if (nightsInPeriod == 0) {
                continue;
            }
            if (nightsInPeriod < stayNights) {
                straddles = true;
            }

            // Quatre decimales pour le calcul, deux pour l'affichage : sommer
            // 129 valeurs deja arrondies au centime fait deriver le total d'un
            // centime face a la synthese. C'est la meme precaution que le
            // moteur prend sur ses prix par nuit — et l'annexe existe justement
            // pour rapprocher, donc l'ecart d'un centime la disqualifie.
            final BigDecimal share = nz(stay.getTotalPrice())
                    .multiply(BigDecimal.valueOf(nightsInPeriod))
                    .divide(BigDecimal.valueOf(stayNights), 4, RoundingMode.HALF_UP);

            total = total.add(share);
            totalNights += nightsInPeriod;
            rows.add(List.of(
                    SHORT_DATE.format(stay.getCheckIn()),
                    SHORT_DATE.format(stay.getCheckOut()),
                    stay.getProperty() == null ? "—" : stay.getProperty().getName(),
                    channelLabel(stay),
                    count(nightsInPeriod),
                    money(share.setScale(2, RoundingMode.HALF_UP), currency)));
        }

        final List<ReportNote> notes = straddles
                ? List.of(ReportNote.neutral("Séjours à cheval sur la période",
                        "Seules les nuits comprises dans la période sont comptées, et le prix est "
                        + "réparti au prorata — le total se rapproche donc de la synthèse"))
                : List.<ReportNote>of();

        return new ReportSection(S_STAYS, "Détail des séjours",
                "Chaque réservation de la période, pour rapprocher le total",
                ReportSectionKind.TABLE,
                new ReportTable(
                        List.of("Arrivée", "Départ", "Bien", "Canal", "Nuits", "Montant"),
                        List.of(ReportAlign.START, ReportAlign.START, ReportAlign.START,
                                ReportAlign.START, ReportAlign.END, ReportAlign.END),
                        rows,
                        List.of("Total", "", "", "", count(totalNights),
                                money(total.setScale(2, RoundingMode.HALF_UP), currency))),
                null, notes, null, null);
    }


    /**
     * Nuits volontairement fermees, par mois.
     *
     * <p>Le calendrier est la source de verite des disponibilites : une journee
     * en {@code BLOCKED} n'a jamais ete proposee a la vente.</p>
     */
    private Map<String, Long> blockedNights(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds) {
        if (propertyIds.isEmpty()) {
            return Map.of();
        }
        final Map<String, Long> byMonth = new HashMap<>();
        for (CalendarDay day : calendarDayRepository.findByPropertiesAndDateRange(
                propertyIds, from, to, orgId)) {
            if (day.getStatus() == CalendarDayStatus.BLOCKED) {
                byMonth.merge(YearMonth.from(day.getDate()).toString(), 1L, Long::sum);
            }
        }
        return byMonth;
    }

    /** Une section sans matiere ne s'ajoute pas : mieux vaut son absence qu'un cadre vide. */
    private static void addIfPresent(List<ReportSection> sections, ReportSection section) {
        if (section != null) {
            sections.add(section);
        }
    }

    // ── Agregats ────────────────────────────────────────────────────────────

    /** Les totaux d'une periode, sur un perimetre. */
    private record Totals(BigDecimal revenue, BigDecimal fees, BigDecimal costs,
                          long nights, long availableNights, String currency) {

        BigDecimal occupancy() {
            return availableNights <= 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(nights).multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(availableNights), 1, RoundingMode.HALF_UP);
        }

        BigDecimal adr() {
            return nights <= 0 ? BigDecimal.ZERO
                    : revenue.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP);
        }

        BigDecimal net() {
            return revenue.subtract(fees).subtract(costs);
        }
    }

    /** Biens ACTIFS du perimetre — le denominateur d'occupation du moteur. */
    private static int activeCount(ReportScope scope) {
        final long active = scope.properties().stream()
                .filter(p -> p.getStatus() == PropertyStatus.ACTIVE).count();
        return (int) Math.max(1, active);
    }

    private Totals totals(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds,
                          int activeProperties) {
        final ReportResultDto result = executionService.execute(
                List.of("PERIOD"), List.of("REVENUE", "FEES", "MARGIN", "OCCUPANCY"),
                "YEAR", from, to, orgId, propertyIds);

        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal fees = BigDecimal.ZERO;
        BigDecimal margin = BigDecimal.ZERO;
        for (ReportResultRowDto row : result.rows()) {
            revenue = revenue.add(metric(row, "REVENUE"));
            fees = fees.add(metric(row, "FEES"));
            margin = margin.add(metric(row, "MARGIN"));
        }

        final long periodDays = ChronoUnit.DAYS.between(from, to) + 1;
        final long availableNights = (long) activeProperties * periodDays;

        // Les nuits vendues se deduisent de l'occupation renvoyee par le moteur,
        // qui les compte a la source ; les recompter ici les ferait diverger.
        final BigDecimal occupancy = result.rows().stream()
                .map(r -> metric(r, "OCCUPANCY")).reduce(BigDecimal.ZERO, BigDecimal::add);
        final long nights = occupancy.multiply(BigDecimal.valueOf(availableNights))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValue();

        return new Totals(revenue, fees, revenue.subtract(fees).subtract(margin),
                nights, availableNights, result.currency());
    }

    // ── Utilitaires ─────────────────────────────────────────────────────────

    private List<ReportNote> bestAndWorst(ReportResultDto months, String currency) {
        if (months.rows().size() < 2) {
            return List.of();
        }
        final List<ReportResultRowDto> sorted = months.rows().stream()
                .sorted(Comparator.comparing((ReportResultRowDto r) -> metric(r, "REVENUE")))
                .toList();
        final ReportResultRowDto worst = sorted.get(0);
        final ReportResultRowDto best = sorted.get(sorted.size() - 1);
        return List.of(
                ReportNote.positive("Meilleur mois", monthLabel(best.dimensionValues().get(0)))
                        .withImpact(money(metric(best, "REVENUE"), currency)),
                ReportNote.neutral("Mois le plus faible", monthLabel(worst.dimensionValues().get(0)))
                        .withImpact(money(metric(worst, "REVENUE"), currency)));
    }

    /**
     * Taxe de sejour de la periode, proratisee a la nuit.
     *
     * <p>Meme attribution que les revenus : un sejour a cheval sur deux mois ne
     * verse pas toute sa taxe au premier. Seules les reservations qui portent
     * explicitement le montant sont comptees — les imports de canaux ne le
     * renseignent pas toujours, et l'estimer serait inventer une dette fiscale.</p>
     */
    private BigDecimal touristTaxOf(List<Reservation> stays, LocalDate from, LocalDate to) {
        final LocalDate toExclusive = to.plusDays(1);
        BigDecimal total = BigDecimal.ZERO;
        for (Reservation stay : stays) {
            final BigDecimal tax = stay.getTouristTaxAmount();
            if (tax == null || tax.signum() <= 0) {
                continue;
            }
            final long stayNights = Math.max(1,
                    ChronoUnit.DAYS.between(stay.getCheckIn(), stay.getCheckOut()));
            final LocalDate first = stay.getCheckIn().isBefore(from) ? from : stay.getCheckIn();
            final LocalDate lastExclusive = stay.getCheckOut().isBefore(toExclusive)
                    ? stay.getCheckOut() : toExclusive;
            final long nights = Math.max(0, ChronoUnit.DAYS.between(first, lastExclusive));
            if (nights > 0) {
                total = total.add(tax.multiply(BigDecimal.valueOf(nights))
                        .divide(BigDecimal.valueOf(stayNights), 4, RoundingMode.HALF_UP));
            }
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    /** Les sejours du perimetre qui touchent la periode. */
    private List<Reservation> staysOf(LocalDate from, LocalDate to, Long orgId, Set<Long> propertyIds) {
        return reservationRepository
                .findOverlappingWindowForPace(from, to.plusDays(1), orgId, null, null).stream()
                .filter(r -> !"cancelled".equalsIgnoreCase(String.valueOf(r.getStatus())))
                .filter(r -> r.getProperty() != null)
                .filter(r -> propertyIds.isEmpty() || propertyIds.contains(r.getProperty().getId()))
                .toList();
    }

    /**
     * Les mois qui portent de l'activite sur ce perimetre.
     *
     * <p>Regarde LARGE — deux ans autour de la periode demandee — parce que la
     * question posee est justement « ou sont mes donnees, si elles ne sont pas
     * ici ». Une fenetre etroite renverrait un second vide.</p>
     */
    private List<String> activeMonths(Set<Long> propertyIds, Long orgId, LocalDate around) {
        final LocalDate from = around.minusYears(1).withDayOfMonth(1);
        final LocalDate to = around.plusYears(1);
        return staysOf(from, to, orgId, propertyIds).stream()
                .map(r -> YearMonth.from(r.getCheckIn()))
                .distinct()
                .sorted()
                .limit(12)
                .map(month -> month.atDay(1).format(MONTH_LABEL))
                .toList();
    }

    /**
     * Le libelle de mois tel que le LECTEUR doit le lire.
     *
     * <p>Le moteur produit la cle ISO {@code 2026-08} — parfaite pour trier et
     * comparer, illisible dans un document adresse a un proprietaire. La cle
     * sert au calcul, ce libelle a l'affichage : confondre les deux affichait
     * « 2026-08 » sur l'axe d'un releve de gestion.</p>
     */
    private static String monthLabel(String isoMonth) {
        try {
            return YearMonth.parse(isoMonth).atDay(1).format(MONTH_LABEL);
        } catch (RuntimeException e) {
            return isoMonth;
        }
    }

    /**
     * Nombre de nuits que le mois apporte a la periode.
     *
     * <p>Borne aux extremites : un rapport du 15 au 15 ne compte pas un mois
     * plein a chaque bout, et compter 31 nuits disponibles pour une quinzaine
     * doublerait le stock invendu affiche.</p>
     */
    private long daysInBucket(String isoMonth, LocalDate from, LocalDate to) {
        final YearMonth month;
        try {
            month = YearMonth.parse(isoMonth);
        } catch (RuntimeException e) {
            return ChronoUnit.DAYS.between(from, to) + 1;
        }
        final LocalDate start = month.atDay(1).isBefore(from) ? from : month.atDay(1);
        final LocalDate end = month.atEndOfMonth().isAfter(to) ? to : month.atEndOfMonth();
        return end.isBefore(start) ? 0 : ChronoUnit.DAYS.between(start, end) + 1;
    }

    /**
     * L'intitule francais d'un type d'intervention.
     *
     * <p>{@code Intervention.type} est une CHAINE libre, pas l'enum : la colonne
     * porte donc des codes bruts ({@code HVAC_REPAIR}), qui se retrouvaient tels
     * quels dans la colonne « Nature » d'un releve adresse a un proprietaire.
     * {@link InterventionType} porte deja les libellés ; on s'y ramene, et on
     * retombe proprement sur le code quand il n'y correspond a rien plutot que
     * d'afficher un vide.</p>
     */
    private static String interventionTypeLabel(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "Autre";
        }
        // `InterventionType.fromString` retombe sur OTHER pour tout code inconnu :
        // s'en servir ici ferait disparaitre un type non repertorie dans un
        // « Autre » fourre-tout, sans que personne ne s'en apercoive. On resout
        // strictement, et un code inconnu s'affiche tel quel — visible, donc
        // corrigeable.
        for (InterventionType type : InterventionType.values()) {
            if (type.name().equalsIgnoreCase(rawType.trim())) {
                return type.getDisplayName();
            }
        }
        return rawType.trim();
    }

    /**
     * Le nom commercial d'un canal.
     *
     * <p>Le moteur normalise la source en MINUSCULES pour regrouper : c'est bon
     * pour l'agregation, illisible dans un document — « airbnb » n'est pas une
     * marque. Les canaux connus reprennent leur graphie officielle, les autres
     * une capitale.</p>
     */
    private static String channelDisplay(String rawChannel) {
        // « Autre » et non « Direct » : c'est ainsi que le moteur classe une
        // source absente. Deux sections du meme document ne peuvent pas donner
        // deux noms au meme sejour — un proprietaire qui rapproche les tableaux
        // y verrait un ecart inexistant.
        if (rawChannel == null || rawChannel.isBlank()) {
            return "Autre";
        }
        final String key = rawChannel.trim().toLowerCase(Locale.ROOT);
        return switch (key) {
            case "airbnb" -> "Airbnb";
            case "booking", "booking.com" -> "Booking.com";
            case "vrbo", "homeaway" -> "Vrbo";
            case "agoda" -> "Agoda";
            case "expedia" -> "Expedia";
            case "hometogo" -> "HomeToGo";
            case "direct", "website", "site" -> "Direct";
            case "autre", "other" -> "Autre";
            default -> Character.toUpperCase(key.charAt(0)) + key.substring(1);
        };
    }

    /** Le canal affiche : le nom commercial s'il existe, la source sinon. */
    private static String channelLabel(Reservation stay) {
        if (stay.getSourceName() != null && !stay.getSourceName().isBlank()) {
            return stay.getSourceName();
        }
        return channelDisplay(stay.getSource());
    }

    private static BigDecimal average(List<ReportResultRowDto> rows, String key) {
        if (rows.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return rows.stream().map(r -> metric(r, key)).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(rows.size()), 2, RoundingMode.HALF_UP);
    }

    /** Dispersion des taux d'occupation autour de leur moyenne. */
    private static BigDecimal standardDeviation(List<ReportResultRowDto> rows, BigDecimal mean) {
        if (rows.size() < 2) {
            return BigDecimal.ZERO;
        }
        final double variance = rows.stream()
                .mapToDouble(r -> Math.pow(metric(r, "OCCUPANCY").subtract(mean).doubleValue(), 2))
                .sum() / rows.size();
        return BigDecimal.valueOf(Math.sqrt(variance)).setScale(1, RoundingMode.HALF_UP);
    }

    private static BigDecimal metric(ReportResultRowDto row, String key) {
        final Object value = row.metrics().get(key);
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return value instanceof BigDecimal decimal ? decimal : new BigDecimal(value.toString());
    }

    private static String share(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0) {
            return "—";
        }
        return percent(nz(part).multiply(BigDecimal.valueOf(100))
                .divide(whole.abs(), 1, RoundingMode.HALF_UP));
    }

    private static BigDecimal sum(List<OwnerPayout> payouts,
                                  java.util.function.Function<OwnerPayout, BigDecimal> field) {
        return payouts.stream().map(field).map(ReportFormats::nz)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal costOf(Intervention intervention) {
        return intervention.getActualCost() != null
                ? intervention.getActualCost() : nz(intervention.getEstimatedCost());
    }

    /** Complete une serie plus courte : deux axes doivent avoir le meme nombre de points. */
    private static List<BigDecimal> pad(List<BigDecimal> values, int size) {
        if (values.size() >= size) {
            return values.subList(0, size);
        }
        final List<BigDecimal> padded = new ArrayList<>(values);
        while (padded.size() < size) {
            padded.add(null);
        }
        return padded;
    }

    /**
     * Le titre du document.
     *
     * <p>Il est ETABLI, jamais saisi : le nom d'un document dit ce qu'il
     * contient, et un champ libre laissait intituler « Relevé de gestion » un
     * dossier prospect anonymise. Le destinataire donne la nature, la periode
     * la distingue — sans quoi douze relevés d'un meme proprietaire portent le
     * meme nom dans la liste.</p>
     */
    private String title(ReportRequest request) {
        final String nature = switch (request.profile()) {
            case OWNER -> "Relevé de gestion";
            case INTERNAL -> "Revue de performance";
            case PROSPECT -> "Dossier de performance";
        };
        return nature + " — " + titlePeriod(request.from(), request.to());
    }

    /** Un mois plein se nomme par son mois, une annee pleine par son millesime. */
    private static String titlePeriod(LocalDate from, LocalDate to) {
        if (from.getDayOfMonth() == 1 && to.equals(from.withDayOfMonth(from.lengthOfMonth()))) {
            return from.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRANCE));
        }
        if (from.getDayOfYear() == 1 && to.equals(LocalDate.of(from.getYear(), 12, 31))) {
            return String.valueOf(from.getYear());
        }
        final DateTimeFormatter day = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRANCE);
        return from.format(day) + " – " + to.format(day);
    }

    private String scopeNote(ReportScope scope, long days) {
        return "Périmètre : " + scope.properties().size() + " bien(s), " + days + " jours. "
                + "Les séjours annulés sont exclus ; les revenus sont attribués à la nuit.";
    }

    /** Resout les biens d'un proprietaire. Utilise par le service d'orchestration. */
    @Transactional(readOnly = true)
    public List<Property> propertiesOf(Long ownerId) {
        return propertyRepository.findByOwnerId(ownerId);
    }

    @Transactional(readOnly = true)
    public Optional<User> user(Long userId) {
        return userRepository.findById(userId);
    }
}
