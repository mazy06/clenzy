package com.clenzy.service.smartlock;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.service.access.AccessCodeGenerator;
import org.springframework.stereotype.Service;

/**
 * Quel PIN poser sur une serrure — et qui le decide.
 *
 * <p>Deux regles se croisaient au milieu de la generation d'un code, sans
 * rapport l'une avec l'autre :</p>
 * <ul>
 *   <li>celle du <b>logement</b> : en mode {@code PMS_GENERATED}, le PIN suit le
 *       format d'arrivee du logement (longueur, chiffres) ; en mode
 *       {@code LOCK_GENERATED}, le PMS n'en propose aucun et laisse la serrure
 *       choisir ;</li>
 *   <li>celle de la <b>marque</b> : un keypad Nuki n'accepte que six chiffres
 *       sans zero, et les fournisseurs Web API exigent tous un code fourni —
 *       contrairement a Tuya, seul capable d'en generer un lui-meme.</li>
 * </ul>
 *
 * <p>Les tenir ensemble ici evite qu'une contrainte materielle ne se retrouve
 * ecrite au milieu du cycle de vie d'un code.</p>
 */
@Service
public class SmartLockPinPolicy {

    /** Longueur par defaut quand le logement n'impose pas de format. */
    private static final int DEFAULT_LENGTH = 6;

    private final CheckInInstructionsRepository checkInInstructionsRepository;
    private final AccessCodeGenerator accessCodeGenerator;

    public SmartLockPinPolicy(CheckInInstructionsRepository checkInInstructionsRepository,
                              AccessCodeGenerator accessCodeGenerator) {
        this.checkInInstructionsRepository = checkInInstructionsRepository;
        this.accessCodeGenerator = accessCodeGenerator;
    }

    /**
     * PIN que le PMS propose, ou {@code null} s'il laisse la serrure choisir.
     *
     * <p>{@code null} n'est pas une absence de PIN : c'est une DELEGATION, que
     * seul Tuya sait honorer. Les fournisseurs Web API la rattrapent via
     * {@link #pinForWebApi}.</p>
     */
    public String requestedPin(SmartLockDevice device) {
        if (device.getAccessCodeMode() != SmartLockDevice.AccessCodeMode.PMS_GENERATED) {
            return null;
        }
        String formatJson = checkInInstructionsRepository
                .findByPropertyIdAndOrganizationId(device.getPropertyId(), device.getOrganizationId())
                .map(CheckInInstructions::getAccessCodeFormat).orElse(null);
        return accessCodeGenerator.generateNumeric(formatJson, DEFAULT_LENGTH);
    }

    /**
     * PIN effectivement pose sur un fournisseur Web API, qui en exige toujours un.
     *
     * <p>Nuki ignore volontairement {@code requestedPin} et le format du
     * logement : son keypad n'accepte que six chiffres sans zero, un PIN au
     * format du logement y serait refuse.</p>
     */
    public String pinForWebApi(SmartLockBrand brand, String requestedPin) {
        if (brand == SmartLockBrand.NUKI) {
            return accessCodeGenerator.withoutZeros(accessCodeGenerator.generateNumeric(null, DEFAULT_LENGTH));
        }
        return requestedPin != null ? requestedPin : accessCodeGenerator.generateNumeric(null, DEFAULT_LENGTH);
    }
}
