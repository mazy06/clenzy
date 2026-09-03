package com.clenzy.service.smartlock;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Serrure fictive, pour eprouver le circuit des codes d'acces sans compte fabricant.
 *
 * <p>La generation d'un code appelle TOUJOURS l'API du fabricant : sans compte Tuya
 * ni Nuki, {@code SmartLockAccessCodeService.createAndPersist} echoue et enregistre
 * un {@code GENERATION_FAILED}. On ne peut donc pas verifier que le reste de la
 * chaine — persistance, evenement, outbox, notification voyageur, revocation au
 * depart — fonctionne. Ce provider repond a la place du fabricant.</p>
 *
 * <p>Il ne simule PAS une serrure : il accepte tout et repond en succes. Il ne
 * prouve donc rien sur l'integration Tuya ou Nuki elle-meme, seulement sur ce qui
 * l'entoure.</p>
 *
 * <h2>Pourquoi il ne peut pas s'activer en production</h2>
 * <p>Trois verrous independants, parce qu'un seul se contourne par accident :</p>
 * <ol>
 *   <li>{@link Profile} sur une liste POSITIVE de profils hors production. Le
 *       matching negatif ({@code @Profile("!prod")}) est proscrit : un profil
 *       inconnu — une faute de frappe, un environnement « staging » seul — activerait
 *       la configuration permissive (regle de securite #11, constat Z1-SEC-03).</li>
 *   <li>{@link ConditionalOnProperty} sans {@code matchIfMissing} : absente, la
 *       propriete vaut « desactive ». Il faut l'avoir ecrite pour l'obtenir.</li>
 *   <li>Un garde-fou au demarrage : si le profil {@code prod} est actif malgre les
 *       deux premiers verrous (profils cumules, ex. {@code dev,prod}), le bean
 *       refuse de se construire et le boot echoue. Mieux vaut ne pas demarrer que
 *       demarrer avec de fausses serrures.</li>
 * </ol>
 */
@Service
@Profile({"dev", "local", "test", "ci", "performance"})
@ConditionalOnProperty(name = "clenzy.smartlock.simulation.enabled", havingValue = "true")
public class SimulationSmartLockProvider implements SmartLockProvider {

    private static final Logger log = LoggerFactory.getLogger(SimulationSmartLockProvider.class);

    /** Profil dont la presence interdit ce bean, quels que soient les autres. */
    private static final String PROD_PROFILE = "prod";

    private final Environment environment;

    /** Codes emis, pour que revocation et relecture restent coherentes avec la generation. */
    private final Map<String, IssuedCode> issued = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public SimulationSmartLockProvider(Environment environment) {
        this.environment = environment;
    }

    /**
     * Troisieme verrou : refuse le demarrage si {@code prod} est actif.
     *
     * <p>Le {@link Profile} ci-dessus ne couvre pas le cumul : {@code dev,prod}
     * satisfait la liste positive tout en etant une production.</p>
     */
    @PostConstruct
    void refuseEnProduction() {
        String[] active = environment.getActiveProfiles();
        List<String> profiles = Arrays.asList(active.length > 0 ? active : environment.getDefaultProfiles());
        if (profiles.contains(PROD_PROFILE)) {
            throw new IllegalStateException(
                    "SimulationSmartLockProvider est actif alors que le profil '" + PROD_PROFILE
                    + "' l'est aussi (profils : " + profiles + "). Une serrure fictive en production"
                    + " delivrerait des codes qui n'ouvrent aucune porte. Retirer"
                    + " clenzy.smartlock.simulation.enabled de la configuration de cet environnement.");
        }
        log.warn("Serrures en SIMULATION activees (profils {}) : les codes generes pour la marque {}"
                 + " ne sont envoyes a aucune serrure reelle.", profiles, SmartLockBrand.SIMULATION);
    }

    @Override
    public SmartLockBrand getBrand() {
        return SmartLockBrand.SIMULATION;
    }

    @Override
    public SmartLockCommandResult unlock(String deviceId, Long orgId) {
        log.info("[SIMULATION] Deverrouillage device={} org={}", deviceId, orgId);
        return SmartLockCommandResult.success("Serrure simulee deverrouillee");
    }

    @Override
    public SmartLockCommandResult lock(String deviceId, Long orgId) {
        log.info("[SIMULATION] Verrouillage device={} org={}", deviceId, orgId);
        return SmartLockCommandResult.success("Serrure simulee verrouillee");
    }

    /**
     * Accepte le code fourni par l'appelant et lui attribue un identifiant externe.
     *
     * <p>{@code createAndPersist} fournit toujours un PIN pour les providers Web API ;
     * on le refuse s'il manque, plutot que d'en inventer un que l'appelant ne
     * connaitrait pas — le voyageur recevrait alors un code different de celui pose
     * sur la serrure.</p>
     */
    @Override
    public SmartLockCommandResult generateAccessCode(String deviceId, AccessCodeParams params, Long orgId) {
        if (deviceId == null || deviceId.isBlank()) {
            return SmartLockCommandResult.failure("Identifiant de device manquant");
        }
        if (params == null || params.code() == null || params.code().isBlank()) {
            return SmartLockCommandResult.failure("Code d'acces absent : le provider simule ne le genere pas");
        }
        String externalId = "sim-" + deviceId + "-" + sequence.incrementAndGet();
        issued.put(externalId, new IssuedCode(deviceId, params.code(), params.validFrom(), params.validUntil()));
        log.info("[SIMULATION] Code {} pose sur device={} du {} au {} (org={})",
                externalId, deviceId, params.validFrom(), params.validUntil(), orgId);
        return SmartLockCommandResult.success("Code simule enregistre", externalId);
    }

    @Override
    public SmartLockCommandResult revokeAccessCode(String deviceId, String codeId, Long orgId) {
        IssuedCode removed = codeId == null ? null : issued.remove(codeId);
        if (removed == null) {
            // La revocation locale est conservee par l'appelant : on ne fait pas
            // echouer un depart parce que le banc d'essai a redemarre entre-temps.
            log.info("[SIMULATION] Code {} deja absent (device={}, org={})", codeId, deviceId, orgId);
            return SmartLockCommandResult.success("Code simule deja revoque");
        }
        log.info("[SIMULATION] Code {} revoque sur device={} (org={})", codeId, deviceId, orgId);
        return SmartLockCommandResult.success("Code simule revoque");
    }

    @Override
    public SmartLockDeviceInfo getDeviceInfo(String deviceId, Long orgId) {
        // Batterie et etat stables : une valeur qui derive a chaque appel ferait
        // clignoter l'ecran des objets connectes sans rien apprendre.
        return new SmartLockDeviceInfo(deviceId, "Serrure simulée", 100, true, "LOCKED", "simulation");
    }

    @Override
    public boolean isAvailable(Long orgId) {
        return true;
    }

    /** Nombre de codes actuellement poses (diagnostic, tests). */
    public int codesEnCours() {
        return issued.size();
    }

    private record IssuedCode(String deviceId, String code, LocalDateTime validFrom, LocalDateTime validUntil) {
        private IssuedCode {
            Objects.requireNonNull(deviceId);
            Objects.requireNonNull(code);
        }
    }
}
