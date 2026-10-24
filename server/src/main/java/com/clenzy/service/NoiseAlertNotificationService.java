package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Fan-out de notifications pour les alertes bruit.
 * Baitly : travail durable par canal ; aucun effet externe dans la transaction de creation.
 */
@Service
public class NoiseAlertNotificationService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertNotificationService.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    /** Nom Meta du template alerte bruit (cf. whatsapp-templates/noise_alert.yaml). */
    private static final String NOISE_ALERT_TEMPLATE = "clenzy_noise_alert_v1";
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final TemplateInterpolationService templateInterpolationService;
    private final EmailWrapperService emailWrapperService;
    // WhatsApp via l'abstraction provider (Meta Cloud API / OpenWA selon la config
    // de l'org). Beans non-conditionnels => demarrage toujours OK ; si l'org n'a pas
    // de config WhatsApp active, l'envoi est simplement ignore (best-effort).
    private final WhatsAppProviderResolver whatsAppProviderResolver;
    private final WhatsAppConfigRepository whatsAppConfigRepository;
    private final BaitlyNoiseWarningJournal warningJournal;
    private final BaitlyNoiseDeliveryOutbox deliveryOutbox;
    private final TransactionTemplate withoutTransaction;

    public NoiseAlertNotificationService(NotificationService notificationService,
                                          EmailService emailService,
                                          PropertyRepository propertyRepository,
                                          ReservationRepository reservationRepository,
                                          SystemEmailTemplateService systemEmailTemplateService,
                                          TemplateInterpolationService templateInterpolationService,
                                          EmailWrapperService emailWrapperService,
                                          WhatsAppProviderResolver whatsAppProviderResolver,
                                          WhatsAppConfigRepository whatsAppConfigRepository,
                                          BaitlyNoiseWarningJournal warningJournal,
                                          PlatformTransactionManager transactionManager, BaitlyNoiseDeliveryOutbox deliveryOutbox) {
        this.whatsAppProviderResolver = whatsAppProviderResolver;
        this.whatsAppConfigRepository = whatsAppConfigRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.templateInterpolationService = templateInterpolationService;
        this.emailWrapperService = emailWrapperService;
        this.warningJournal = warningJournal;
        this.deliveryOutbox = deliveryOutbox;
        this.withoutTransaction = new TransactionTemplate(transactionManager);
        this.withoutTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
    }

    /**
     * Dispatche toutes les notifications configurees pour cette alerte.
     */
    public void dispatch(NoiseAlert alert, NoiseAlertConfig config) {
        // No provider or notification here. Failure propagates and rolls the alert back.
        deliveryOutbox.enqueue(alert.getId(),alert.getOrganizationId(),config.getId());
    }

    Supplier<Boolean> prepareOwnerInApp(NoiseAlert alert, Property property) {
        if(property.getOwner()==null || property.getOwner().getKeycloakId()==null) return null;
        String recipient=property.getOwner().getKeycloakId();
        NotificationKey key=alert.getSeverity()==NoiseAlert.AlertSeverity.CRITICAL
            ? NotificationKey.NOISE_ALERT_CRITICAL : NotificationKey.NOISE_ALERT_WARNING;
        String title=(alert.getSeverity()==NoiseAlert.AlertSeverity.CRITICAL ? "Alerte bruit critique : " : "Alerte bruit : ")+property.getName();
        String message=String.format("Niveau sonore de %.0f dB detecte (seuil : %d dB, creneau : %s)",
            alert.getMeasuredDb(),alert.getThresholdDb(),alert.getTimeWindowLabel()==null ? "" : alert.getTimeWindowLabel());
        String url="/connected-objects/property/"+alert.getPropertyId()+"?highlight="+alert.getId();
        Long organization=alert.getOrganizationId();
        Map<String,Object> metadata=NotificationMetadata.of().property(property.getName()).propertyId(alert.getPropertyId())
            .noise(alert.getMeasuredDb(),alert.getThresholdDb()).build();
        return () -> notificationService.sendByOrgIdStrict(recipient,key,title,message,url,organization,metadata)!=null;
    }

    Runnable prepareOwnerEmail(NoiseAlert alert, NoiseAlertConfig config, Property property, int ordinal) {
        List<String> recipients=resolveEmailRecipients(config,property);
        if(ordinal<0 || ordinal>=recipients.size()) return null;
        String recipient=recipients.get(ordinal);
        var template=systemEmailTemplateService.resolve(alert.getOrganizationId(),"noise_alert_owner","fr")
            .orElseThrow(() -> new IllegalStateException("Template bruit indisponible"));
        Map<String,String> vars=buildNoiseAlertVariables(alert,property.getName());
        String subject=templateInterpolationService.interpolate(template.getSubject(),vars,false);
        String body=emailWrapperService.wrap(template.getWrapperStyle(),
            templateInterpolationService.interpolate(template.getBody(),vars,true));
        return () -> emailService.sendContactMessage(recipient,null,null,null,subject,body,List.of());
    }

    /**
     * Construit la map des variables d'interpolation pour le template
     * {@code noise_alert_owner}. Les valeurs HTML-safe (severityColor,
     * severityLabel) sont listees dans
     * {@link TemplateInterpolationService#HTML_SAFE_VARIABLES} pour ne pas etre
     * re-echappees au rendu.
     */
    private Map<String, String> buildNoiseAlertVariables(NoiseAlert alert, String propertyName) {
        boolean critical = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL;
        Map<String, String> vars = new HashMap<>();
        vars.put("propertyName", propertyName);
        vars.put("severityLabel", critical ? "CRITIQUE" : "AVERTISSEMENT");
        vars.put("severityColor", critical ? "#D32F2F" : "#ED6C02");
        vars.put("measuredDb", String.format("%.0f", alert.getMeasuredDb()));
        vars.put("thresholdDb", String.valueOf(alert.getThresholdDb()));
        vars.put("timeWindow", alert.getTimeWindowLabel() != null ? alert.getTimeWindowLabel() : "—");
        vars.put("alertTime", alert.getCreatedAt() != null ? alert.getCreatedAt().format(TIME_FMT) : "—");
        return vars;
    }

    private List<String> resolveEmailRecipients(NoiseAlertConfig config, Property property) {
        // Priorite : destinataires configures > email du proprietaire
        if (config.getEmailRecipients() != null && !config.getEmailRecipients().isBlank()) {
            return BaitlyNoiseDeliveryOutbox.recipients(config.getEmailRecipients());
        }
        if (property != null && property.getOwner() != null
                && property.getOwner().getEmail() != null) {
            return List.of(property.getOwner().getEmail());
        }
        return List.of();
    }

    // ─── Guest warning (F6a — pont alerte → voyageur) ───────────────────────────

    /**
     * Resultat explicite de l'avertissement voyageur : envoye (avec canal), ou
     * saute avec raison lisible — consommee par l'executeur SEND_NOISE_WARNING.
     */
    public record GuestWarningOutcome(boolean sent, String channel, String skipReason) {
        static GuestWarningOutcome sentVia(String channel) {
            return new GuestWarningOutcome(true, channel, null);
        }

        static GuestWarningOutcome skipped(String reason) {
            return new GuestWarningOutcome(false, null, reason);
        }
    }

    /**
     * L'intention durable est commitee avant l'effet externe. L'envoi ne rejoint
     * jamais la transaction du moteur d'automatisation ou du callback afterCommit.
     */
    public GuestWarningOutcome sendGuestWarning(NoiseAlert alert) {
        try {
            return withoutTransaction.execute(status -> sendOutsideTransaction(alert,null));
        } catch (Exception failure) {
            log.error("Baitly bruit : avertissement non confirme");
            return GuestWarningOutcome.skipped("traitement non confirme : rapprochement necessaire");
        }
    }

    GuestWarningOutcome sendQueuedGuestWarning(NoiseAlert alert,BaitlyNoiseDeliveryOutbox.Snapshot expected) {
        try {return withoutTransaction.execute(status -> sendOutsideTransaction(alert,expected));}
        catch(Exception failure) {return GuestWarningOutcome.skipped("delegation non confirmee");}
    }

    private GuestWarningOutcome sendOutsideTransaction(NoiseAlert alert,BaitlyNoiseDeliveryOutbox.Snapshot expected) {
        try {
            if (warningJournal.repairAccepted(alert.getOrganizationId(), alert.getId()).isPresent()) {
                return GuestWarningOutcome.skipped("avertissement deja delegue");
            }
        } catch (Exception failure) {
            return GuestWarningOutcome.skipped("preuve durable indisponible");
        }
        Property property = propertyRepository.findById(alert.getPropertyId()).orElse(null);
        if (property == null || !alert.getOrganizationId().equals(property.getOrganizationId())) {
            return GuestWarningOutcome.skipped("logement indisponible");
        }
        Reservation reservation = reservationRepository.findActiveByPropertyIdAndDate(
                alert.getPropertyId(), LocalDate.now(), alert.getOrganizationId()).orElse(null);
        if (reservation == null || reservation.getGuest() == null
                || !alert.getOrganizationId().equals(reservation.getGuest().getOrganizationId())) {
            return GuestWarningOutcome.skipped("aucun voyageur sur un sejour actif");
        }
        if(expected!=null && (!java.util.Objects.equals(expected.reservation(),reservation.getId())
                || !java.util.Objects.equals(expected.guest(),reservation.getGuest().getId())
                || !java.util.Objects.equals(expected.guestVersion(),reservation.getGuest().getUpdatedAt()))) {
            return GuestWarningOutcome.skipped("sejour ou voyageur modifie");
        }
        final GuestDelivery delivery;
        try {
            delivery = prepareGuestDelivery(alert, reservation.getGuest(), property.getName());
        } catch (Exception failure) {
            log.warn("Baitly bruit : preparation du canal indisponible pour alerte {}", alert.getId());
            return GuestWarningOutcome.skipped("preparation du canal indisponible");
        }
        if (delivery == null) return GuestWarningOutcome.skipped("aucun canal disponible");
        final Optional<BaitlyNoiseWarningJournal.Ticket> admission;
        try {
            var guest=reservation.getGuest();
            admission=warningJournal.claim(new BaitlyNoiseWarningJournal.Scope(
                alert.getId(),alert.getOrganizationId(),alert.getPropertyId(),reservation.getId(),
                guest.getId(),guest.getUpdatedAt(),delivery.channel(),alert.getMeasuredDb(),
                alert.getThresholdDb(),alert.getSeverity()==null ? null : alert.getSeverity().name()));
        } catch (Exception failure) {
            log.warn("Baitly bruit : intention durable non confirmee pour alerte {}", alert.getId());
            return GuestWarningOutcome.skipped("intention durable indisponible");
        }
        if (admission.isEmpty()) return GuestWarningOutcome.skipped("avertissement bloque : historique ou intention existante");
        var ticket=admission.orElseThrow();
        try {
            String receipt=delivery.send().get();
            warningJournal.accepted(ticket,receipt);
            warningJournal.repairAccepted(alert.getOrganizationId(),alert.getId());
            log.info("Baitly bruit : avertissement delegue pour alerte {}",alert.getId());
            return GuestWarningOutcome.sentVia(delivery.channel().publicName());
        } catch (Exception uncertain) {
            try { warningJournal.uncertain(ticket); }
            catch(Exception storageFailure) {
                log.error("Baitly bruit : intention conservee sans resultat confirme");
            }
            return GuestWarningOutcome.skipped("resultat incertain : rapprochement necessaire");
        }
    }

    private record GuestDelivery(BaitlyNoiseWarningJournal.Channel channel, Supplier<String> send) {}

    private GuestDelivery prepareGuestDelivery(NoiseAlert alert, Guest guest, String propertyName) {
        WhatsAppConfig waConfig = whatsAppConfigRepository
            .findByOrganizationId(alert.getOrganizationId()).orElse(null);
        if (waConfig != null && waConfig.isEnabled()
                && guest.getPhone() != null && !guest.getPhone().isBlank()) {
            String phone=guest.getPhone();
            WhatsAppProvider provider = whatsAppProviderResolver.resolve(waConfig);
            WhatsAppProviderType type = provider.getProviderType();
            if (type == null) throw new IllegalStateException("Canal non qualifie");
            String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
            if (type == WhatsAppProviderType.OPENWA) {
                String body = String.format(
                    "Bonjour %s, un niveau sonore eleve (%.0f dB, seuil %d dB) a ete detecte au logement "
                    + "\"%s\". Merci de veiller a preserver le calme afin de ne pas gener le voisinage.",
                    guestName, alert.getMeasuredDb(), alert.getThresholdDb(), propertyName);
                return new GuestDelivery(BaitlyNoiseWarningJournal.Channel.WHATSAPP_OPENWA, () ->
                    requireMessageId(provider.sendTextMessage(waConfig, phone, body)));
            }
            List<String> parameters = List.of(guestName, String.format("%.0f", alert.getMeasuredDb()),
                String.valueOf(alert.getThresholdDb()), propertyName);
            String language = toMetaLocale(guest.getLanguage());
            return new GuestDelivery(BaitlyNoiseWarningJournal.Channel.WHATSAPP_META, () ->
                requireMessageId(provider.sendTemplateMessage(waConfig, phone,
                    NOISE_ALERT_TEMPLATE, language, parameters)));
        }
        if (guest.getEmail() == null || guest.getEmail().isBlank()) return null;
        var template = systemEmailTemplateService.resolve(
            alert.getOrganizationId(), "noise_alert_guest", "fr").orElse(null);
        if (template == null) return null;
        String email=guest.getEmail();
        String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
        Map<String, String> vars = Map.of("guestName", guestName, "propertyName", propertyName);
        String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
        String body = templateInterpolationService.interpolate(template.getBody(), vars, true);
        String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), body);
        return new GuestDelivery(BaitlyNoiseWarningJournal.Channel.EMAIL, () -> {
            emailService.sendContactMessage(email, guestName, null, null, subject, htmlBody, List.of());
            return null; // Le service email ne retourne pas de recu fournisseur.
        });
    }

    private static String requireMessageId(String id) {
        if (id == null || id.isBlank()) throw new IllegalStateException("Envoi non confirme");
        return id;
    }

    /**
     * Mappe la langue guest (fr/en/ar) vers la locale Meta (fr_FR/en_US/ar_AR).
     * Defaut fr_FR.
     */
    private static String toMetaLocale(String language) {
        if (language == null) return "fr_FR";
        return switch (language.toLowerCase()) {
            case "en" -> "en_US";
            case "ar" -> "ar_AR";
            default -> "fr_FR";
        };
    }

}
