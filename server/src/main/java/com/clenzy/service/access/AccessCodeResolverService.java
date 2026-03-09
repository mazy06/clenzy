package com.clenzy.service.access;

import com.clenzy.dto.keyexchange.CreateKeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.KeyExchangeCodeDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.*;
import com.clenzy.model.KeyExchangePoint.PointStatus;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.KeyExchangeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Determine la methode d'acces pour une propriete et genere le code
 * approprie pour la reservation donnee.
 *
 * Priorite :
 * 1. Serrure connectee Tuya → code temporaire 6 chiffres
 * 2. Point d'echange de cles (KeyNest / Clenzy KeyVault) → code + infos commerce
 * 3. Manuel → aucun code dynamique (le code statique de CheckInInstructions est utilise)
 *
 * Les variables retournees sont injectees dans le template via extraVars.
 * La cle "accessCode" ecrase la valeur statique de CheckInInstructions.
 */
@Service
public class AccessCodeResolverService {

    private static final Logger log = LoggerFactory.getLogger(AccessCodeResolverService.class);

    private final SmartLockDeviceRepository smartLockRepository;
    private final KeyExchangePointRepository keyExchangePointRepository;
    private final TuyaApiService tuyaApiService;
    private final KeyExchangeService keyExchangeService;

    public AccessCodeResolverService(
            SmartLockDeviceRepository smartLockRepository,
            KeyExchangePointRepository keyExchangePointRepository,
            TuyaApiService tuyaApiService,
            KeyExchangeService keyExchangeService
    ) {
        this.smartLockRepository = smartLockRepository;
        this.keyExchangePointRepository = keyExchangePointRepository;
        this.tuyaApiService = tuyaApiService;
        this.keyExchangeService = keyExchangeService;
    }

    /**
     * Resout le code d'acces dynamique pour une reservation.
     *
     * @param property     la propriete de la reservation
     * @param reservation  la reservation pour laquelle generer le code
     * @param instructions les instructions de check-in (pour le fallback statique)
     * @return le resultat avec la methode d'acces et les variables de template
     */
    public AccessCodeResult resolveForReservation(
            Property property,
            Reservation reservation,
            CheckInInstructions instructions
    ) {
        Long propertyId = property.getId();

        // ─── Tier 1 : Serrure connectee ─────────────────────────────
        List<SmartLockDevice> activeLocks =
                smartLockRepository.findByPropertyIdAndStatus(propertyId, DeviceStatus.ACTIVE);

        if (!activeLocks.isEmpty()) {
            return resolveSmartLock(activeLocks.get(0), reservation, instructions);
        }

        // ─── Tier 2 : Point d'echange de cles ──────────────────────
        List<KeyExchangePoint> activePoints =
                keyExchangePointRepository.findByPropertyIdAndStatus(propertyId, PointStatus.ACTIVE);

        if (!activePoints.isEmpty()) {
            return resolveKeyExchange(activePoints.get(0), reservation);
        }

        // ─── Tier 3 : Manuel ────────────────────────────────────────
        log.debug("Aucun systeme d'acces automatise pour property={}", propertyId);
        return AccessCodeResult.manual();
    }

    // ═══════════════════════════════════════════════════════════════
    // Tier 1 — Serrure connectee Tuya
    // ═══════════════════════════════════════════════════════════════

    private AccessCodeResult resolveSmartLock(
            SmartLockDevice device,
            Reservation reservation,
            CheckInInstructions instructions
    ) {
        String externalDeviceId = device.getExternalDeviceId();
        if (externalDeviceId == null || externalDeviceId.isBlank()) {
            log.warn("Smart lock {} sans external device ID, fallback manuel", device.getId());
            return AccessCodeResult.manual();
        }

        try {
            long effectiveTime = toEpochSeconds(reservation.getCheckIn());
            long invalidTime = toEpochSeconds(reservation.getCheckOut().plusDays(1));
            String guestName = reservation.getGuestName() != null
                    ? reservation.getGuestName() : "Guest";

            Map<String, Object> result = tuyaApiService.createTemporaryPassword(
                    externalDeviceId, effectiveTime, invalidTime, "Clenzy-" + guestName
            );

            String tempCode = extractPasswordFromResult(result);
            if (tempCode != null && !tempCode.isBlank()) {
                log.info("Code temporaire Tuya genere pour reservation={}, device={}",
                        reservation.getId(), device.getId());

                Map<String, String> vars = new LinkedHashMap<>();
                vars.put("accessCode", tempCode);
                vars.put("accessMethod", "SMART_LOCK");
                return new AccessCodeResult(AccessCodeResult.AccessMethod.SMART_LOCK, vars);
            }

            log.warn("Tuya n'a pas retourne de code pour device={}, fallback statique", device.getId());

        } catch (Exception e) {
            log.error("Erreur generation code Tuya pour device={}: {}, fallback statique",
                    device.getId(), e.getMessage());
        }

        // Fallback : code statique de CheckInInstructions
        return fallbackToStaticCode(instructions);
    }

    // ═══════════════════════════════════════════════════════════════
    // Tier 2 — Point d'echange de cles
    // ═══════════════════════════════════════════════════════════════

    private AccessCodeResult resolveKeyExchange(
            KeyExchangePoint point,
            Reservation reservation
    ) {
        try {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(point.getId());
            dto.setReservationId(reservation.getId());
            dto.setGuestName(reservation.getGuestName());
            dto.setValidFrom(reservation.getCheckIn().atStartOfDay());
            dto.setValidUntil(reservation.getCheckOut().plusDays(1).atStartOfDay());

            // Utilise "system" comme userId car la generation est automatique (scheduler)
            KeyExchangeCodeDto codeDto = keyExchangeService.generateCode("system", dto);

            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("accessCode", codeDto.getCode());
            vars.put("accessMethod", "KEY_EXCHANGE");
            vars.put("keyExchangeStoreName", nullToEmpty(point.getStoreName()));
            vars.put("keyExchangeStoreAddress", nullToEmpty(point.getStoreAddress()));
            vars.put("keyExchangeStorePhone", nullToEmpty(point.getStorePhone()));
            vars.put("keyExchangeStoreHours", nullToEmpty(point.getStoreOpeningHours()));
            // Coordonnees GPS du point d'echange pour la carte Mapbox
            vars.put("keyExchangeStoreLat", point.getStoreLat() != null ? point.getStoreLat().toString() : "");
            vars.put("keyExchangeStoreLng", point.getStoreLng() != null ? point.getStoreLng().toString() : "");

            log.info("Code d'echange genere pour reservation={}, point={} ({})",
                    reservation.getId(), point.getId(), point.getStoreName());

            return new AccessCodeResult(AccessCodeResult.AccessMethod.KEY_EXCHANGE, vars);

        } catch (Exception e) {
            log.error("Erreur generation code d'echange pour point={}: {}",
                    point.getId(), e.getMessage());
            return AccessCodeResult.manual();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    private AccessCodeResult fallbackToStaticCode(CheckInInstructions instructions) {
        if (instructions != null && instructions.getAccessCode() != null
                && !instructions.getAccessCode().isBlank()) {
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("accessCode", instructions.getAccessCode());
            vars.put("accessMethod", "STATIC");
            return new AccessCodeResult(AccessCodeResult.AccessMethod.MANUAL, vars);
        }
        return AccessCodeResult.manual();
    }

    private long toEpochSeconds(LocalDate date) {
        return date.atStartOfDay(ZoneId.systemDefault()).toEpochSecond();
    }

    private String extractPasswordFromResult(Map<String, Object> result) {
        if (result == null) return null;
        // Le code est celui que nous avons genere et envoye a Tuya
        // Il est retourne dans le champ "password" par TuyaApiService.createTemporaryPassword()
        Object pwd = result.get("password");
        if (pwd != null) return pwd.toString();
        return null;
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }
}
