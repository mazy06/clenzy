package com.clenzy.service.smartlock;

import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.SmartLockDevice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

/**
 * Poser et retirer un code sur la serrure PHYSIQUE.
 *
 * <p>Le seul endroit qui parle aux fournisseurs. Deux chemins s'y separent, et
 * ils ne se ressemblent pas :</p>
 * <ul>
 *   <li><b>Tuya</b> — mot de passe temporaire, fenetre exprimee en secondes
 *       epoch dans le fuseau du LOGEMENT, et capable de generer le PIN lui-meme
 *       quand on ne lui en impose pas ;</li>
 *   <li><b>Web API</b> (Nuki…) — le code est toujours fourni par l'appelant, et
 *       le fournisseur repond par un succes ou un motif d'echec.</li>
 * </ul>
 *
 * <p>Cette classe ne persiste rien et ne journalise rien : elle pose, ou elle
 * jette. C'est l'appelant qui decide ce qu'on garde d'un succes et ce qu'on
 * ecrit d'un echec.</p>
 */
@Service
public class SmartLockCodeProvisioner {

    private static final Logger log = LoggerFactory.getLogger(SmartLockCodeProvisioner.class);

    /** Un code pose : sa valeur, et l'identifiant que le fournisseur lui donne. */
    public record PlacedCode(String pin, String externalCodeId) {}

    private final TuyaApiService tuyaApiService;
    private final SmartLockProviderRegistry providerRegistry;
    private final SmartLockPinPolicy pinPolicy;

    public SmartLockCodeProvisioner(TuyaApiService tuyaApiService,
                                    SmartLockProviderRegistry providerRegistry,
                                    SmartLockPinPolicy pinPolicy) {
        this.tuyaApiService = tuyaApiService;
        this.providerRegistry = providerRegistry;
        this.pinPolicy = pinPolicy;
    }

    /** Marque effective d'une serrure — Tuya par defaut, comme a l'origine. */
    public static SmartLockBrand brandOf(SmartLockDevice device) {
        return device.getBrand() != null ? device.getBrand() : SmartLockBrand.TUYA;
    }

    /**
     * Pose un code sur la serrure et retourne ce qui a ete pose.
     *
     * @throws IllegalStateException si le fournisseur refuse
     * @throws RuntimeException remontee telle quelle du fournisseur
     */
    public PlacedCode place(SmartLockDevice device, String name,
                            LocalDateTime validFrom, LocalDateTime validUntil, ZoneId zone) {
        SmartLockBrand brand = brandOf(device);
        String requestedPin = pinPolicy.requestedPin(device);

        if (brand == SmartLockBrand.TUYA) {
            Map<String, Object> result = tuyaApiService.createTemporaryPassword(
                    device.getExternalDeviceId(), epoch(validFrom, zone), epoch(validUntil, zone), name, requestedPin);
            Object pin = result.get("password");
            Object tuyaId = result.get("tuyaPasswordId");
            return new PlacedCode(
                    pin != null ? pin.toString() : null,
                    tuyaId != null ? tuyaId.toString() : null);
        }

        String pin = pinPolicy.pinForWebApi(brand, requestedPin);
        SmartLockCommandResult result = providerRegistry.getRequiredProvider(brand).generateAccessCode(
                device.getExternalDeviceId(),
                new AccessCodeParams(pin, name, validFrom, validUntil, AccessCodeParams.AccessCodeType.TEMPORARY),
                device.getOrganizationId());
        if (!result.success()) {
            throw new IllegalStateException(result.message());
        }
        return new PlacedCode(pin, result.externalId());
    }

    /**
     * Retire un code de la serrure. Best-effort : un echec fournisseur est
     * journalise mais ne se propage pas — la revocation LOCALE fait foi, et le
     * code expire de toute facon a la fin de sa fenetre.
     */
    public void remove(SmartLockDevice device, String externalCodeId) {
        if (device == null || externalCodeId == null) return;
        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isBlank()) return;
        try {
            SmartLockBrand brand = brandOf(device);
            if (brand == SmartLockBrand.TUYA) {
                tuyaApiService.deleteTemporaryPassword(device.getExternalDeviceId(), externalCodeId);
            } else {
                providerRegistry.getRequiredProvider(brand)
                        .revokeAccessCode(device.getExternalDeviceId(), externalCodeId, device.getOrganizationId());
            }
        } catch (Exception e) {
            log.warn("Revocation provider echouee pour code externe={} (revocation locale conservee): {}",
                    externalCodeId, e.getMessage());
        }
    }

    private static long epoch(LocalDateTime dt, ZoneId zone) {
        return dt.atZone(zone).toEpochSecond();
    }
}
