package com.clenzy.service.access;

import com.clenzy.config.GuideConfig;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.SmartLockService;
import com.clenzy.service.smartlock.SmartLockBrand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Ouverture de la porte depuis le livret d'accueil guest (token public).
 *
 * <p>Réservé aux serrures pilotables à distance ({@link #REMOTE_UNLOCK_BRANDS} —
 * Netatmo exclu : Bluetooth/NFC local, pas d'API cloud). Garde-fous : token de
 * livret valide (fenêtre du séjour, non révoqué, résa non annulée), opt-in par
 * logement ({@code guest_unlock_enabled}), pas avant l'heure de check-in (même
 * règle que le masquage du code), rate-limit Redis par token (fail-open), et
 * notification de l'hôte à chaque ouverture (audit).</p>
 */
@Service
public class GuestUnlockService {

    private static final Logger log = LoggerFactory.getLogger(GuestUnlockService.class);

    /** Marques dont l'API cloud permet le déverrouillage à distance. */
    private static final Set<SmartLockBrand> REMOTE_UNLOCK_BRANDS =
            Set.of(SmartLockBrand.TUYA, SmartLockBrand.NUKI);

    public enum Status { OK, INVALID, DISABLED, LOCKED, RATE_LIMITED, FAILED }

    private final WelcomeGuideTokenRepository tokenRepository;
    private final CheckInInstructionsRepository instructionsRepository;
    private final SmartLockDeviceRepository smartLockDeviceRepository;
    private final SmartLockService smartLockService;
    private final NotificationService notificationService;
    private final GuideConfig guideConfig;
    private final StringRedisTemplate redisTemplate;

    public GuestUnlockService(WelcomeGuideTokenRepository tokenRepository,
                              CheckInInstructionsRepository instructionsRepository,
                              SmartLockDeviceRepository smartLockDeviceRepository,
                              SmartLockService smartLockService,
                              NotificationService notificationService,
                              GuideConfig guideConfig,
                              StringRedisTemplate redisTemplate) {
        this.tokenRepository = tokenRepository;
        this.instructionsRepository = instructionsRepository;
        this.smartLockDeviceRepository = smartLockDeviceRepository;
        this.smartLockService = smartLockService;
        this.notificationService = notificationService;
        this.guideConfig = guideConfig;
        this.redisTemplate = redisTemplate;
    }

    /** Vrai si le logement a au moins une serrure active pilotable à distance. */
    public boolean hasRemoteUnlockableLock(Long propertyId) {
        if (propertyId == null) return false;
        return smartLockDeviceRepository
                .findByPropertyIdAndStatus(propertyId, SmartLockDevice.DeviceStatus.ACTIVE)
                .stream()
                .anyMatch(GuestUnlockService::isRemoteUnlockable);
    }

    /**
     * Déverrouille la/les serrure(s) du logement pour un token de livret valide.
     * Toutes les règles sont revalidées côté serveur (ne jamais se fier au front).
     */
    @Transactional
    public Status guestUnlock(UUID token) {
        WelcomeGuideToken guideToken = tokenRepository.findByToken(token)
                .filter(WelcomeGuideToken::isCurrentlyValid)
                .orElse(null);
        if (guideToken == null) return Status.INVALID;

        WelcomeGuide guide = guideToken.getGuide();
        if (guide == null || !guide.isPublished() || guide.getProperty() == null) return Status.INVALID;
        Property property = guide.getProperty();

        CheckInInstructions instructions = instructionsRepository
                .findByPropertyId(property.getId()).orElse(null);
        if (instructions == null || !instructions.isGuestUnlockEnabled()) return Status.DISABLED;

        // L'ouverture exige une réservation : un token sans séjour (aperçu hôte, partage manuel,
        // livret orphelin — TTL 60 j) ne doit JAMAIS commander la porte.
        Reservation reservation = guideToken.getReservation() != null
                ? guideToken.getReservation() : guide.getReservation();
        if (reservation == null) return Status.DISABLED;

        // Fenêtre stricte du séjour : pas avant l'heure de check-in (même règle que le masquage
        // du code), et pas après l'heure de check-out (un token reste techniquement valide
        // jusqu'à checkout+grace, et un token d'avis jusqu'à +14 j — la porte, elle, se ferme).
        if (!StayTimes.isDuringStay(reservation, property)) return Status.LOCKED;

        if (isRateLimited(token)) return Status.RATE_LIMITED;

        List<SmartLockDevice> locks = smartLockDeviceRepository
                .findByPropertyIdAndStatus(property.getId(), SmartLockDevice.DeviceStatus.ACTIVE)
                .stream()
                .filter(GuestUnlockService::isRemoteUnlockable)
                .toList();
        if (locks.isEmpty()) return Status.DISABLED;

        int unlocked = 0;
        for (SmartLockDevice lock : locks) {
            try {
                smartLockService.performLockCommand(lock, false);
                unlocked++;
            } catch (Exception e) {
                log.error("Ouverture guest echouee pour device={} (property={}): {}",
                        lock.getId(), property.getId(), e.getMessage());
            }
        }
        if (unlocked == 0) return Status.FAILED;

        notifyHost(guide, property, reservation);
        log.info("Porte ouverte depuis le livret: property={}, reservation={}, serrures={}",
                property.getId(), reservation != null ? reservation.getId() : null, unlocked);
        return Status.OK;
    }

    private static boolean isRemoteUnlockable(SmartLockDevice device) {
        SmartLockBrand brand = device.getBrand() != null ? device.getBrand() : SmartLockBrand.TUYA;
        return REMOTE_UNLOCK_BRANDS.contains(brand)
                && device.getExternalDeviceId() != null && !device.getExternalDeviceId().isBlank()
                // Hors ligne avéré → exclu (null = jamais synchronisé, on tente quand même).
                && !Boolean.FALSE.equals(device.getOnline());
    }

    /** Rate-limit Redis par token (fail-open si Redis indisponible — l'ouverture reste auditée). */
    private boolean isRateLimited(UUID token) {
        try {
            String key = "guide:unlock:" + token;
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, Duration.ofSeconds(guideConfig.getUnlockWindowSeconds()));
            }
            return current != null && current > guideConfig.getUnlockMaxPerWindow();
        } catch (Exception e) {
            log.warn("Rate-limit unlock indisponible (Redis): {}", e.getMessage());
            return false;
        }
    }

    private void notifyHost(WelcomeGuide guide, Property property, Reservation reservation) {
        try {
            String guestName = reservation != null && reservation.getGuestName() != null
                    ? reservation.getGuestName() : "Le voyageur";
            notificationService.notifyAdminsAndManagersByOrgId(
                    guide.getOrganizationId(),
                    NotificationKey.GUEST_DOOR_UNLOCKED,
                    "Porte ouverte depuis le livret — " + property.getName(),
                    guestName + " a ouvert la porte de « " + property.getName() + " » depuis le livret d'accueil.",
                    "/properties/" + property.getId());
        } catch (Exception e) {
            log.warn("Notification ouverture guest echouee: {}", e.getMessage());
        }
    }
}
