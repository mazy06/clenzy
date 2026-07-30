package com.clenzy.service;

import com.clenzy.dto.GuestDeclarationRequest;
import com.clenzy.dto.OnlineCheckInSubmission;
import com.clenzy.model.OnlineCheckIn;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Une seule saisie du voyageur, deux obligations remplies.
 *
 * <p>Le check-in en ligne et la fiche voyageur — fiche de police, DGSN selon le
 * pays — étaient deux formulaires distincts qui ne demandaient pas les mêmes
 * champs. Un voyageur pouvait donc compléter intégralement son check-in sans
 * que la fiche existe, et le tableau de bord lui reprochait ensuite une
 * formalité qu'on ne lui avait jamais présentée.</p>
 *
 * <p><b>Pourquoi un service de plus ?</b> Parce que
 * {@link GuestDeclarationService} lit déjà le check-in pour y retrouver la
 * pièce d'identité. Appeler la déclaration depuis
 * {@link OnlineCheckInService} fermerait un cycle de dépendances, et Spring
 * refuse de construire le contexte. L'orchestration monte donc d'un cran :
 * chacun des deux services ignore l'autre, celui-ci les enchaîne.</p>
 */
@Service
public class CheckInSubmissionService {

    private static final Logger log = LoggerFactory.getLogger(CheckInSubmissionService.class);

    private final OnlineCheckInService checkInService;
    private final GuestDeclarationService guestDeclarationService;

    public CheckInSubmissionService(OnlineCheckInService checkInService,
                                    GuestDeclarationService guestDeclarationService) {
        this.checkInService = checkInService;
        this.guestDeclarationService = guestDeclarationService;
    }

    /**
     * Clôt le check-in et dépose la fiche dans la foulée.
     *
     * <p><b>Même transaction</b> : ou les deux aboutissent, ou aucun. Un
     * check-in validé sans sa fiche ferait croire l'obligation remplie alors
     * qu'elle ne l'est pas — exactement le défaut qu'on corrige.</p>
     */
    @Transactional
    public OnlineCheckIn submit(UUID token, OnlineCheckInSubmission submission) {
        final OnlineCheckIn checkIn = checkInService.completeCheckIn(token, submission);
        declareGuest(checkIn, submission);
        return checkIn;
    }

    /**
     * Dépose la fiche voyageur à partir de la saisie du check-in.
     *
     * <p>Uniquement si la saisie porte l'identité nécessaire : une fiche
     * incomplète serait réputée déposée sans l'être — l'alerte disparaîtrait,
     * l'obligation resterait. Sans effet là où la formalité n'est pas activée,
     * le service de déclaration portant la règle par juridiction.</p>
     */
    private void declareGuest(OnlineCheckIn checkIn, OnlineCheckInSubmission submission) {
        if (!submission.carriesIdentity() || checkIn.getReservation() == null) return;

        guestDeclarationService.submitDeclaration(
            checkIn.getReservation().getId(),
            new GuestDeclarationRequest(List.of(new GuestDeclarationRequest.Declarant(
                submission.firstName(),
                submission.lastName(),
                submission.maidenName(),
                submission.birthDate(),
                submission.birthPlace(),
                submission.nationality(),
                submission.residenceAddress(),
                submission.residenceCountry(),
                submission.idDocumentType(),
                submission.idDocumentNumber()))));

        log.info("Fiche voyageur deposee depuis le check-in en ligne, reservation={}",
            checkIn.getReservation().getId());
    }
}
