package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceImportRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.UserRole;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Envoi au moins une fois : une réponse SMTP perdue peut produire un doublon du même courriel. */
@Component
public class MarketplaceNotificationDelivery {
    private final MarketplaceNotificationOutbox outbox;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceImportRepository imports;
    private final EmailService emails;
    private final NotificationService notifications;
    @Value("${clenzy.marketplace.landing-url:http://localhost:3005}") private String landingUrl;
    public MarketplaceNotificationDelivery(MarketplaceNotificationOutbox outbox, MarketplaceProviderRepository providers,
            MarketplaceImportRepository imports, EmailService emails, NotificationService notifications) {
        this.outbox=outbox; this.providers=providers; this.imports=imports; this.emails=emails; this.notifications=notifications;
    }
    @Scheduled(fixedDelayString="${baitly.marketplace.notification-delay-ms:60000}")
    public void retryDue() {
        for (UUID id : outbox.due()) {
            try { deliver(id); }
            catch (RuntimeException failure) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Notification Baitly à reprendre : {}",id);
            }
        }
    }
    public void deliver(UUID id) {
        var claim=outbox.claim(id);
        if (claim==null) return;
        String outcome="PENDING";
        try {
            var provider=providers.findById(claim.providerId()).orElse(null);
            if (provider==null) { outcome="CANCELLED"; return; }
            String name=Objects.toString(provider.getDisplayName(),"");
            String address=provider.getEmail();
            if (List.of("CONFIRMATION","DECISION").contains(claim.kind()) && (address == null || address.isBlank()))
                throw new IllegalStateException("Adresse indisponible");
            switch(claim.kind()) {
                case "CONFIRMATION" -> {
                    if (provider.isEmailConfirmed() || !Objects.equals(provider.getEmailConfirmTokenHash(),MarketplaceUploadTokens.hash(claim.payload()))
                            || provider.getStatus()!=com.clenzy.marketplace.model.ProviderStatus.PENDING_REVIEW) {
                        outcome="CANCELLED"; return;
                    }
                    emails.sendSystemTemplateEmail(address,"marketplace_email_confirmation",Map.of("displayName",name,
                        "confirmationLink",landingUrl.replaceAll("/+$","")+"/prestataires/inscription?confirmation="
                            +java.net.URLEncoder.encode(claim.payload(),java.nio.charset.StandardCharsets.UTF_8)),null);
                }
                case "DECISION" -> {
                    if (!provider.getStatus().name().equals(claim.expectedStatus())
                        || !Objects.equals(provider.getDecisionMessage(),claim.payload())) { outcome="CANCELLED"; return; }
                    emails.sendSystemTemplateEmail(address,"ACTIVE".equals(claim.expectedStatus())
                        ? "marketplace_decision_accepted" : "marketplace_decision_rejected",
                        Map.of("displayName",name,"decisionMessage",Objects.toString(claim.payload(),"")
                            + ("REJECTED".equals(claim.expectedStatus())
                                ? "\n\nVotre candidature et ses justificatifs seront supprimés 90 jours après la notification de ce refus, sauf réouverture du dossier ou conservation nécessaire à un litige identifié."
                                : "")),null);
                }
                case "APPLICATION_EMAIL" -> emails.sendRequiredInternalTemplateEmail("marketplace_application_internal",
                    Map.of("displayName",name,"email",Objects.toString(address,""),"city",Objects.toString(provider.getBaseCity(),""),
                        "offerCount",Objects.toString(claim.payload(),"0"),"providerId",provider.getId().toString()),address);
                case "APPLICATION_STAFF", "DOCUMENT_STAFF" -> {
                    boolean application="APPLICATION_STAFF".equals(claim.kind());
                    var staff=imports.findPlatformStaff(List.of(UserRole.SUPER_ADMIN,UserRole.SUPER_MANAGER));
                    if(staff.isEmpty()) throw new IllegalStateException("Destinataires indisponibles");
                    for(var member:staff) notifications.sendByOrgIdStrict(member.getKeycloakId(),
                        application ? NotificationKey.MARKETPLACE_APPLICATION_RECEIVED : NotificationKey.MARKETPLACE_APPLICATION_DOCUMENTS_ADDED,
                        application ? "Nouvelle candidature prestataire" : "Justificatif déposé",
                        name+(application ? "" : " : "+Objects.toString(claim.payload(),"")),
                        "/marketplace/providers/"+provider.getId(),member.getOrganizationId(),null);
                }
                default -> throw new IllegalStateException("Type de notification inconnu");
            }
            outcome="SENT";
        } finally { outbox.finish(claim,outcome); }
    }
}
