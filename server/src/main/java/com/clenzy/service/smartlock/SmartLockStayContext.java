package com.clenzy.service.smartlock;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.StayTimes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Le logement d'une serrure, et qui s'y trouve.
 *
 * <p>Un code de serrure se decide dans le temps du LOGEMENT — sa fenetre de
 * validite se calcule dans son fuseau, sa rotation manuelle peut couper un
 * sejour en cours, et sa notification se nomme par lui. Trois lectures qui ne
 * sont pas le cycle de vie du code, et qui trainaient deux repositories dans
 * {@code SmartLockAccessCodeService}.</p>
 *
 * <p><b>Best-effort partout</b> : ces lectures servent a mieux se comporter,
 * jamais a empecher un geste demande. Une absence se rend en {@code null} ou en
 * repli documente, jamais en exception.</p>
 */
@Service
public class SmartLockStayContext {

    private static final Logger log = LoggerFactory.getLogger(SmartLockStayContext.class);

    /** Fuseau par defaut si le logement n'en definit pas (ou invalide). */
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");

    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;

    public SmartLockStayContext(PropertyRepository propertyRepository,
                                ReservationRepository reservationRepository) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
    }

    /** Fuseau du logement (repli {@link #DEFAULT_ZONE} si absent/invalide). */
    public ZoneId zoneOf(Long propertyId) {
        String tz = propertyId == null ? null
                : propertyRepository.findById(propertyId).map(Property::getTimezone).orElse(null);
        if (tz == null || tz.isBlank()) {
            return DEFAULT_ZONE;
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            log.warn("Fuseau invalide '{}' pour property={}, repli Europe/Paris", tz, propertyId);
            return DEFAULT_ZONE;
        }
    }

    /** Nom d'un logement, ou {@code null}. */
    public String nameOf(Long propertyId) {
        if (propertyId == null) return null;
        try {
            return propertyRepository.findById(propertyId).map(Property::getName).orElse(null);
        } catch (Exception e) {
            log.warn("Lecture du nom du logement echouee (property={}): {}", propertyId, e.getMessage());
            return null;
        }
    }

    /**
     * Sejour en cours sur le logement de cette serrure, ou {@code null}.
     *
     * <p>« En cours » se tranche a l'heure pres et dans le fuseau du LOGEMENT
     * ({@link StayTimes#isDuringStay}) : entre l'heure de depart et minuit, la
     * date de depart est encore aujourd'hui alors que le voyageur est parti. Les
     * bornes de la requete sont donc larges, et l'heure exacte tranchee ici.</p>
     */
    public Reservation ongoingStayOf(SmartLockDevice device) {
        Long propertyId = device.getPropertyId();
        if (propertyId == null) return null;
        try {
            Property property = propertyRepository.findById(propertyId).orElse(null);
            if (property == null) return null;
            LocalDate today = LocalDate.now(StayTimes.zoneOf(property));
            return reservationRepository
                    .findStaysOverlapping(propertyId, today.minusDays(1), today.plusDays(1),
                            device.getOrganizationId())
                    .stream()
                    .filter(r -> StayTimes.isDuringStay(r, property))
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Lecture du sejour en cours echouee (device={}): {}", device.getId(), e.getMessage());
            return null;
        }
    }
}
