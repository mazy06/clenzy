package com.clenzy.service;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.dto.TouristTaxConfigRequest;
import com.clenzy.dto.TouristTaxReportDto;
import com.clenzy.dto.TouristTaxReportLineDto;
import com.clenzy.model.Reservation;
import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TouristTaxConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Taxe de séjour Baitly (v1) : barèmes saisis par l'organisation, calcul par
 * réservation, rapport/export par période.
 *
 * <p><b>Résolution du barème</b> : override par bien ({@code propertyId} de la
 * config) &gt; barème par défaut de l'org ({@code propertyId} null) &gt; absent.</p>
 *
 * <p><b>Formule v1</b> (volontairement simple, documentée) :</p>
 * <ul>
 *   <li>nuits = checkOut - checkIn ; personnes taxables = adultes seuls quand la
 *       ventilation est connue ({@code adultsCount} non nul) et {@code exemptMinors}
 *       actif, sinon repli sur {@code guestCount} (total) — voir
 *       {@link com.clenzy.model.Reservation#taxablePersons(boolean)} ;</li>
 *   <li>prix de la nuitée = {@code totalPrice} / nuits (HALF_UP, 2 déc.) ;</li>
 *   <li>PER_PERSON_PER_NIGHT : {@code ratePerPerson} × personnes × nuits ;</li>
 *   <li>PERCENTAGE_OF_RATE : min(prixNuitée / personnes × {@code percentageRate},
 *       {@code capPerPersonNight}) × personnes × nuits ({@code percentageRate}
 *       est une fraction : 0.05 = 5 %) ;</li>
 *   <li>FLAT_PER_NIGHT : {@code ratePerPerson} × nuits ;</li>
 *   <li>surtaxes : base × (1 + (départementale % + régionale %) / 100) ;</li>
 *   <li>arrondi final HALF_UP à 2 décimales ; {@code maxNights} plafonne les
 *       nuits taxées.</li>
 * </ul>
 *
 * <p><b>Dates</b> : {@code checkIn}/{@code checkOut} sont des {@code LocalDate}
 * en convention locale de la propriété (pas de composante horaire) — le filtre
 * de période par date de check-out les compare telles quelles, sans conversion
 * de timezone.</p>
 */
@Service
@Transactional(readOnly = true)
public class TouristTaxService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final String DEFAULT_CURRENCY = "EUR";

    private final TouristTaxConfigRepository configRepository;
    private final ReservationRepository reservationRepository;

    public TouristTaxService(TouristTaxConfigRepository configRepository,
                             ReservationRepository reservationRepository) {
        this.configRepository = configRepository;
        this.reservationRepository = reservationRepository;
    }

    public List<TouristTaxConfig> getAllConfigs(Long orgId) {
        return configRepository.findByOrgId(orgId);
    }

    public Optional<TouristTaxConfig> getConfigForProperty(Long propertyId, Long orgId) {
        return configRepository.findByPropertyId(propertyId, orgId);
    }

    /**
     * Upsert d'une config de taxe de séjour à partir d'un payload client.
     *
     * <p>Clé naturelle : {@code (propertyId, orgId)} — une config par propriété
     * et par organisation, {@code propertyId} null = barème PAR DÉFAUT de l'org
     * (un seul par org). On charge la config existante de l'org (jamais par
     * {@code id} fourni par le client : fermeture du mass assignment / IDOR),
     * sinon on en crée une nouvelle. L'{@code organizationId} est imposé par le
     * {@code TenantContext} (jamais celui du client). Les index uniques partiels
     * (changeset 0311) garantissent l'unicité en cas d'upserts concurrents.</p>
     */
    @Transactional
    public TouristTaxConfig upsertConfig(TouristTaxConfigRequest request, Long orgId) {
        TouristTaxConfig config = (request.propertyId() == null
                ? configRepository.findDefaultForOrg(orgId)
                : configRepository.findByPropertyId(request.propertyId(), orgId))
            .orElseGet(TouristTaxConfig::new);

        config.setOrganizationId(orgId);
        config.setPropertyId(request.propertyId());
        config.setCommuneName(request.communeName());
        config.setCommuneCode(request.communeCode());
        if (request.calculationMode() != null) {
            config.setCalculationMode(request.calculationMode());
        }
        config.setRatePerPerson(request.ratePerPerson());
        config.setPercentageRate(request.percentageRate());
        config.setCapPerPersonNight(request.capPerPersonNight());
        config.setDepartmentalSurchargePct(request.departmentalSurchargePct());
        config.setRegionalSurchargePct(request.regionalSurchargePct());
        if (request.exemptMinors() != null) {
            config.setExemptMinors(request.exemptMinors());
        }
        config.setMaxNights(request.maxNights());
        if (request.childrenExemptUnder() != null) {
            config.setChildrenExemptUnder(request.childrenExemptUnder());
        }
        if (request.enabled() != null) {
            config.setEnabled(request.enabled());
        }

        return configRepository.save(config);
    }

    /** Suppression org-scopée (jamais de deleteById nu). */
    @Transactional
    public void deleteConfig(Long id, Long orgId) {
        TouristTaxConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Barème introuvable: " + id));
        configRepository.delete(config);
    }

    /**
     * Barème applicable à une propriété : override par bien, sinon défaut org,
     * sinon absent. Un override DÉSACTIVÉ vaut « pas de taxe pour ce bien »
     * (exonération explicite) — on ne retombe pas sur le défaut org.
     */
    public Optional<TouristTaxConfig> resolveConfig(Long propertyId, Long orgId) {
        if (propertyId != null) {
            Optional<TouristTaxConfig> override = configRepository.findByPropertyId(propertyId, orgId);
            if (override.isPresent()) {
                return override.filter(c -> Boolean.TRUE.equals(c.getEnabled()));
            }
        }
        return configRepository.findDefaultForOrg(orgId)
            .filter(c -> Boolean.TRUE.equals(c.getEnabled()));
    }

    /**
     * Calcule la taxe de séjour d'une réservation (formule v1, cf. Javadoc de
     * classe). {@code Optional.empty()} si aucun barème applicable ou séjour
     * sans nuit taxable.
     */
    public Optional<TouristTaxReportLineDto> computeForReservation(Reservation reservation) {
        if (reservation == null || reservation.getCheckIn() == null || reservation.getCheckOut() == null) {
            return Optional.empty();
        }
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        Optional<TouristTaxConfig> configOpt = resolveConfig(propertyId, reservation.getOrganizationId());
        if (configOpt.isEmpty()) {
            return Optional.empty();
        }

        long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
        if (nights <= 0) {
            return Optional.empty();
        }

        TouristTaxConfig config = configOpt.get();
        // Personnes taxables : adultes seuls si la ventilation est connue et
        // l'exoneration des mineurs active (0314), sinon repli sur le total.
        boolean exemptMinors = Boolean.TRUE.equals(config.getExemptMinors());
        int taxablePersons = reservation.taxablePersons(exemptMinors);
        long taxedNights = config.getMaxNights() != null
            ? Math.min(nights, config.getMaxNights()) : nights;

        BigDecimal base = computeBase(config, reservation, nights, taxedNights, taxablePersons);
        BigDecimal surchargePct = nvl(config.getDepartmentalSurchargePct())
            .add(nvl(config.getRegionalSurchargePct()));
        BigDecimal surcharge = base.multiply(surchargePct)
            .divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal total = base.add(surcharge).setScale(2, RoundingMode.HALF_UP);

        String currency = reservation.getCurrency() != null ? reservation.getCurrency() : DEFAULT_CURRENCY;
        return Optional.of(new TouristTaxReportLineDto(
            reservation.getId(),
            propertyId,
            reservation.getProperty() != null ? reservation.getProperty().getName() : null,
            reservation.getGuestName(),
            reservation.getCheckIn(),
            reservation.getCheckOut(),
            (int) nights,
            taxablePersons,
            config.getCommuneName(),
            config.getCalculationMode(),
            base.setScale(2, RoundingMode.HALF_UP),
            surcharge,
            total,
            currency
        ));
    }

    /**
     * Rapport de période : réservations confirmées dont le check-out tombe dans
     * {@code [from, to]} (borne incluses), une ligne par réservation couverte
     * par un barème + total. Les réservations sans barème sont comptées dans
     * {@code missingConfigCount}.
     */
    public TouristTaxReportDto computeForPeriod(Long orgId, LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("Période invalide: from doit précéder to");
        }
        List<Reservation> reservations = reservationRepository.findConfirmedByCheckOutRange(from, to, orgId);

        List<TouristTaxReportLineDto> lines = new ArrayList<>();
        int missing = 0;
        for (Reservation reservation : reservations) {
            Optional<TouristTaxReportLineDto> line = computeForReservation(reservation);
            if (line.isPresent()) {
                lines.add(line.get());
            } else {
                missing++;
            }
        }
        BigDecimal total = lines.stream()
            .map(TouristTaxReportLineDto::taxAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);

        return new TouristTaxReportDto(from, to, lines, total, lines.size(), missing);
    }

    /**
     * Calcul pour une réservation par id, borné à l'org (fail-closed : une
     * réservation d'une autre org est traitée comme introuvable). Utilisé par
     * le tool assistant {@code compute_tourist_tax}.
     */
    public Optional<TouristTaxReportLineDto> computeForReservationId(Long reservationId, Long orgId) {
        return reservationRepository.findById(reservationId)
            .filter(r -> r.getOrganizationId() != null && r.getOrganizationId().equals(orgId))
            .flatMap(this::computeForReservation);
    }

    /**
     * Export CSV d'un rapport (séparateur {@code ;}, en-têtes FR, montants à
     * 2 décimales). Champs texte quotés + neutralisation des formules (=+-@)
     * contre l'injection CSV.
     */
    public String toCsv(TouristTaxReportDto report) {
        StringBuilder sb = new StringBuilder();
        sb.append("Reservation;Logement;Voyageur;Arrivee;Depart;Nuits;Personnes;Commune;Base;Surtaxes;Taxe totale;Devise\n");
        for (TouristTaxReportLineDto line : report.lines()) {
            sb.append(line.reservationId()).append(';')
              .append(csvText(line.propertyName())).append(';')
              .append(csvText(line.guestName())).append(';')
              .append(line.checkIn()).append(';')
              .append(line.checkOut()).append(';')
              .append(line.nights()).append(';')
              .append(line.taxablePersons()).append(';')
              .append(csvText(line.communeName())).append(';')
              .append(line.baseAmount().toPlainString()).append(';')
              .append(line.surchargeAmount().toPlainString()).append(';')
              .append(line.taxAmount().toPlainString()).append(';')
              .append(csvText(line.currency())).append('\n');
        }
        sb.append("TOTAL;;;;;;;;;;").append(report.totalTax().toPlainString()).append(";\n");
        return sb.toString();
    }

    // ─── Calcul de base par mode ─────────────────────────────────────────────

    private BigDecimal computeBase(TouristTaxConfig config, Reservation reservation,
                                   long nights, long taxedNights, int taxablePersons) {
        return switch (config.getCalculationMode()) {
            case PER_PERSON_PER_NIGHT -> nvl(config.getRatePerPerson())
                .multiply(BigDecimal.valueOf(taxablePersons))
                .multiply(BigDecimal.valueOf(taxedNights));
            case PERCENTAGE_OF_RATE -> percentageBase(config, reservation, nights, taxedNights, taxablePersons);
            case FLAT_PER_NIGHT -> nvl(config.getRatePerPerson())
                .multiply(BigDecimal.valueOf(taxedNights));
        };
    }

    /**
     * Mode « au réel » : % du prix de la nuitée PAR PERSONNE, plafonné par
     * {@code capPerPersonNight}. Prix de la nuitée = totalPrice / nuits
     * (formule v1 simple — pas de décomposition héberg./ménage).
     */
    private BigDecimal percentageBase(TouristTaxConfig config, Reservation reservation,
                                      long nights, long taxedNights, int taxablePersons) {
        BigDecimal totalPrice = nvl(reservation.getTotalPrice());
        BigDecimal nightlyPrice = totalPrice.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP);
        BigDecimal perPersonNight = nightlyPrice
            .divide(BigDecimal.valueOf(taxablePersons), 4, RoundingMode.HALF_UP)
            .multiply(nvl(config.getPercentageRate()));
        BigDecimal cap = config.getCapPerPersonNight();
        if (cap != null && perPersonNight.compareTo(cap) > 0) {
            perPersonNight = cap;
        }
        return perPersonNight
            .multiply(BigDecimal.valueOf(taxablePersons))
            .multiply(BigDecimal.valueOf(taxedNights));
    }

    private static BigDecimal nvl(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    /** Quote CSV + neutralise les préfixes de formule (injection CSV Excel). */
    private static String csvText(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        String value = raw;
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@') {
            value = "'" + value;
        }
        return '"' + value.replace("\"", "\"\"") + '"';
    }

    // ─── Calcul « devis » historique (booking engine) ────────────────────────

    /**
     * Calcule la taxe de séjour pour un devis (booking engine) à partir de
     * paramètres bruts — conservé tel quel pour ne pas modifier les totaux du
     * checkout public ({@code PublicBookingService}). Le calcul par réservation
     * ({@link #computeForReservation}) est la référence pour le reporting.
     *
     * @param propertyId ID de la propriete
     * @param orgId ID de l'organisation
     * @param nights nombre de nuits
     * @param guests nombre de personnes
     * @param nightlyRate tarif par nuit (pour mode PERCENTAGE)
     * @return calcul de la taxe ou null si pas de config
     */
    public TouristTaxCalculationDto calculate(Long propertyId, Long orgId,
                                               int nights, int guests, BigDecimal nightlyRate) {
        Optional<TouristTaxConfig> configOpt = configRepository.findByPropertyId(propertyId, orgId);
        if (configOpt.isEmpty() || !configOpt.get().getEnabled()) {
            return null;
        }

        TouristTaxConfig config = configOpt.get();
        int effectiveNights = config.getMaxNights() != null
            ? Math.min(nights, config.getMaxNights()) : nights;

        BigDecimal taxPerNight;
        BigDecimal totalTax;
        String details;

        switch (config.getCalculationMode()) {
            case PER_PERSON_PER_NIGHT:
                taxPerNight = config.getRatePerPerson() != null
                    ? config.getRatePerPerson().multiply(BigDecimal.valueOf(guests))
                    : BigDecimal.ZERO;
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%s x %d personnes x %d nuits = %s EUR",
                    config.getRatePerPerson(), guests, effectiveNights, totalTax);
                break;

            case PERCENTAGE_OF_RATE:
                BigDecimal rate = config.getPercentageRate() != null
                    ? config.getPercentageRate() : BigDecimal.ZERO;
                taxPerNight = nightlyRate.multiply(rate).setScale(2, RoundingMode.HALF_UP);
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%.2f%% de %s EUR/nuit x %d nuits = %s EUR",
                    rate.multiply(BigDecimal.valueOf(100)), nightlyRate, effectiveNights, totalTax);
                break;

            case FLAT_PER_NIGHT:
                taxPerNight = config.getRatePerPerson() != null
                    ? config.getRatePerPerson() : BigDecimal.ZERO;
                totalTax = taxPerNight.multiply(BigDecimal.valueOf(effectiveNights))
                    .setScale(2, RoundingMode.HALF_UP);
                details = String.format("%s EUR/nuit x %d nuits = %s EUR",
                    taxPerNight, effectiveNights, totalTax);
                break;

            default:
                taxPerNight = BigDecimal.ZERO;
                totalTax = BigDecimal.ZERO;
                details = "Unknown calculation mode";
        }

        return new TouristTaxCalculationDto(
            propertyId, config.getCommuneName(), config.getCalculationMode(),
            effectiveNights, guests, taxPerNight, totalTax, details
        );
    }
}
