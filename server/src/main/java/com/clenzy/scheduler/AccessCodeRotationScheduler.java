package com.clenzy.scheduler;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.Intervention;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.NotificationMetadata;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Rotation automatique du code d'accès statique après le départ du voyageur (opt-in par logement).
 *
 * <p>Pour chaque {@link CheckInInstructions} dont {@code accessCodeAutoRotate=true}, dès qu'un
 * séjour s'est terminé (date + heure de départ passées, fuseau du logement), un nouveau code est
 * généré selon le format mémorisé, sauvegardé, et l'hôte est notifié (boîte à clé → il doit
 * mettre à jour physiquement le code de la boîte).</p>
 *
 * <p>Idempotence : {@code accessCodeRotatedAt} empêche de régénérer plusieurs fois pour le même
 * départ. Fenêtre de 2 jours pour ne pas tourner sur d'anciens départs à l'activation. Les serrures
 * connectées ne sont pas concernées (codes par réservation déjà gérés par leur intégration).</p>
 *
 * <p><b>Le code tourne POUR QUELQU'UN.</b> C'est le ménage qui suit le départ qui trouvera la
 * boîte à clés : la notification porte donc l'identifiant de cette mission, pour que la fiche
 * nomme l'intervenant attendu au lieu de laisser deviner à qui transmettre le code. Le lien est
 * facultatif — quand la mission n'existe pas encore à l'heure de la rotation, le fait est
 * simplement absent.</p>
 */
@Service
public class AccessCodeRotationScheduler {

    private static final Logger log = LoggerFactory.getLogger(AccessCodeRotationScheduler.class);
    private static final int LOOKBACK_DAYS = 2;
    /** Nombre de visites lues pour designer celle qui se servira du code. */
    private static final int VISIT_LOOKAHEAD = 10;

    private final CheckInInstructionsRepository instructionsRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final AccessCodeGenerator accessCodeGenerator;
    private final NotificationService notificationService;
    private final SupervisionActivityService supervisionActivityService;

    public AccessCodeRotationScheduler(
            CheckInInstructionsRepository instructionsRepository,
            ReservationRepository reservationRepository,
            InterventionRepository interventionRepository,
            AccessCodeGenerator accessCodeGenerator,
            NotificationService notificationService,
            SupervisionActivityService supervisionActivityService) {
        this.instructionsRepository = instructionsRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.accessCodeGenerator = accessCodeGenerator;
        this.notificationService = notificationService;
        this.supervisionActivityService = supervisionActivityService;
    }

    /** Toutes les heures (à :15). Régénère les codes des logements dont un séjour vient de se terminer. */
    @Scheduled(cron = "0 15 * * * *")
    @SchedulerLock(name = "access-code-rotation", lockAtMostFor = "PT15M")
    public void rotateAfterCheckout() {
        List<CheckInInstructions> autos = instructionsRepository.findAutoRotateWithProperty();
        if (autos.isEmpty()) return;

        LocalDate today = LocalDate.now();
        int rotated = 0;
        for (CheckInInstructions ci : autos) {
            try {
                if (rotateOne(ci, today)) rotated++;
            } catch (Exception e) {
                log.error("Rotation code echouee pour property={}: {}", ci.getPropertyId(), e.getMessage(), e);
            }
        }
        if (rotated > 0) {
            log.info("AccessCodeRotationScheduler: {} code(s) d'acces regenere(s)", rotated);
        }
    }

    private boolean rotateOne(CheckInInstructions ci, LocalDate today) {
        Property property = ci.getProperty();
        if (property == null) return false;
        Long orgId = ci.getOrganizationId();
        Long propertyId = property.getId();
        ZoneId zone = StayTimes.zoneOf(property);
        ZonedDateTime now = ZonedDateTime.now(zone);

        // Départ effectif le plus récent (déjà passé) dans la fenêtre de rattrapage.
        List<Reservation> recent = reservationRepository.findRecentCheckoutsByProperty(
                propertyId, today.minusDays(LOOKBACK_DAYS), today, orgId);
        ZonedDateTime lastCheckout = null;
        for (Reservation r : recent) {
            ZonedDateTime co = StayTimes.checkOutMoment(r, property);
            if (co != null && !co.isAfter(now) && (lastCheckout == null || co.isAfter(lastCheckout))) {
                lastCheckout = co;
            }
        }
        if (lastCheckout == null) return false; // aucun départ passé récent

        // Idempotence : déjà régénéré depuis ce départ ?
        LocalDateTime rotatedAt = ci.getAccessCodeRotatedAt();
        if (rotatedAt != null
                && !rotatedAt.atZone(ZoneId.systemDefault()).toInstant().isBefore(lastCheckout.toInstant())) {
            return false;
        }

        String newCode = accessCodeGenerator.generate(ci.getAccessCodeFormat(), ci.getAccessCode());
        if (newCode == null || newCode.isBlank()) {
            log.warn("Rotation: generation impossible pour property={}", propertyId);
            return false;
        }

        ci.setAccessCode(newCode);
        ci.setAccessCodeRotatedAt(LocalDateTime.now());
        instructionsRepository.save(ci);

        Intervention nextVisit = nextVisitAfter(propertyId, orgId, lastCheckout);

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.ACCESS_CODE_ROTATED,
                "Nouveau digicode / boîte à clés — " + property.getName(),
                "Le voyageur est parti : le code d'accès de « " + property.getName()
                        + " » a été régénéré (" + newCode + "). Pensez à mettre à jour le code de la boîte à clé.",
                "/properties/" + propertyId,
                // Le code lui-meme reste hors des faits : un secret n'a rien a
                // faire dans un champ structure destine a etre affiche partout.
                // Le LOGEMENT, lui, y entre : c'est par lui que la fiche va lire
                // le code EN VIGUEUR — celui du message vieillit a la premiere
                // rotation suivante, et c'est l'ancien qu'on irait recopier.
                // La MISSION qui va s'en servir, quand elle existe deja : au depart
                // du voyageur, c'est le menage qui trouvera la boite a cles. Sans
                // elle, « pensez a mettre a jour le code » ne dit ni pour quand, ni
                // a qui le transmettre.
                NotificationMetadata.of()
                        .property(property.getName())
                        .propertyId(propertyId)
                        .interventionId(nextVisit != null ? nextVisit.getId() : null)
                        .build());

        // Feed « En direct » de la constellation du logement (agent Opérations « ops ») : best-effort,
        // un échec ne doit jamais casser la rotation. propertyId résolu par occurrence (ce logement).
        try {
            supervisionActivityService.recordModuleAct(orgId, propertyId, "ops", "access_code_rotated",
                    "Code d'accès renouvelé après le départ du voyageur sur ce logement");
        } catch (Exception e) {
            log.debug("Rotation code: activite constellation non enregistree (property={}): {}",
                    propertyId, e.getMessage());
        }
        return true;
    }

    /**
     * La mission qui va se servir du nouveau code, ou {@code null}.
     *
     * <p>Le ménage d'abord : c'est POUR LUI que le code tourne au départ du voyageur. À défaut,
     * la première visite prévue — quelle qu'elle soit, c'est elle qui trouvera la boîte à clés.
     * Quelques lignes suffisent : au-delà des toutes prochaines visites, plus rien ne se rattache
     * à ce départ-là.</p>
     *
     * <p>Une résolution impossible ne fait rien échouer : le code est déjà tourné et sauvegardé,
     * et la notification reste juste sans ce fait — c'est la fiche qui retombera sur sa propre
     * déduction.</p>
     */
    private Intervention nextVisitAfter(Long propertyId, Long orgId, ZonedDateTime lastCheckout) {
        try {
            List<Intervention> upcoming = interventionRepository.findUpcomingByProperty(
                    propertyId, lastCheckout.toLocalDateTime(), orgId, PageRequest.of(0, VISIT_LOOKAHEAD));
            if (upcoming.isEmpty()) return null;
            return upcoming.stream()
                    .filter(visit -> isCleaning(visit.getType()))
                    .findFirst()
                    .orElse(upcoming.get(0));
        } catch (Exception e) {
            log.debug("Rotation code: mission suivante non resolue (property={}): {}", propertyId, e.getMessage());
            return null;
        }
    }

    /**
     * Un ménage se reconnaît à son type.
     *
     * <p>Le type n'est pas contraint en base : on lit le MOT plutôt qu'une liste close qui
     * laisserait passer le prochain libellé ajouté. Même règle que
     * {@code OpsAnalyticsService.categorize}.</p>
     */
    private static boolean isCleaning(String type) {
        if (type == null) return false;
        String upper = type.toUpperCase();
        return upper.contains("CLEAN") || upper.contains("HOUSEKEEP") || upper.contains("MENAGE");
    }

}
