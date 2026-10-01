package com.clenzy.controller;

import com.clenzy.dto.GuestMessageLogDto;
import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.dto.SendManualMessageRequest;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.service.messaging.GuestMessagingQueryService;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Configuration de l'automatisation messagerie + envoi manuel + historique.
 *
 * <h3>Securite</h3>
 * <p>Partage net entre lire et emettre : la <b>lecture</b> (config, apercu,
 * historique) reste ouverte a tout role authentife — l'historique des envois
 * fait partie du suivi d'un sejour. Les <b>trois ecritures</b> (envoi, renvoi,
 * reglage de l'automatisation) portent le meme garde, celui des roles
 * d'administration d'org ; {@link #resendMessage} en porte la justification
 * detaillee.</p>
 *
 * <p>Le meme garde sur les trois n'est pas une commodite : {@code /send} et
 * {@code /resend} aboutissent au meme envoi, et un garde pose sur l'un
 * seulement se contourne par l'autre.</p>
 */
@RestController
@RequestMapping("/api/guest-messaging")
@PreAuthorize("isAuthenticated()")
public class GuestMessagingController {

    private final GuestMessagingQueryService queryService;
    private final GuestMessagingService messagingService;
    private final TenantContext tenantContext;

    public GuestMessagingController(
            GuestMessagingQueryService queryService,
            GuestMessagingService messagingService,
            TenantContext tenantContext
    ) {
        this.queryService = queryService;
        this.messagingService = messagingService;
        this.tenantContext = tenantContext;
    }

    // ── Configuration d'automatisation ──

    @GetMapping("/config")
    public ResponseEntity<MessagingAutomationConfigDto> getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(
            queryService.getConfigOrDefault(orgId)));
    }

    /**
     * Regle l'automatisation des messages de l'organisation.
     *
     * <p>Meme garde que l'envoi et le renvoi (cf. {@link #resendMessage}) :
     * decider qu'un message parte tout seul engage l'organisation plus encore
     * qu'un envoi a la main. L'ecran qui appelle cette route, {@code /settings},
     * n'est de toute facon ouvert qu'au staff plateforme
     * ({@code settings:view}) ; HOST est retenu ici pour que l'hote
     * independant regle ses propres relances le jour ou cet ecran lui
     * ouvrira.</p>
     */
    @PutMapping("/config")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<MessagingAutomationConfigDto> updateConfig(
            @RequestBody MessagingAutomationConfigDto dto
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(
            queryService.updateConfig(orgId, dto)));
    }

    // ── Envoi manuel ──

    /**
     * Envoie a la main un message a un voyageur.
     *
     * <p>Meme garde que {@link #resendMessage}, et pour la meme raison : les
     * deux routes appellent le meme
     * {@link GuestMessagingService#sendMessage}. Un garde pose sur le seul
     * renvoi n'aurait rien protege — il suffisait de rejouer la reservation et
     * le modele par ici pour obtenir le meme envoi.</p>
     *
     * <p>SUPERVISOR en est exclu bien qu'il atteigne le planning
     * ({@code reservations:view}) d'ou s'ouvre la fenetre d'envoi : il encadre
     * l'execution sur le terrain, il ne porte pas la parole de l'organisation
     * aupres du voyageur. PROPERTY_OWNER l'est aussi, mais cela ne se decide
     * pas ici : les messages voyageurs sont un objet du mandat de gestion,
     * comme le rappelle {@code PermissionInitializer}.</p>
     */
    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<GuestMessageLogDto> sendMessage(@RequestBody SendManualMessageRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        if (request.reservationId() == null || request.templateId() == null) {
            return ResponseEntity.badRequest().build();
        }

        MessageChannelType channel = parseChannel(request.channel());
        GuestMessageLog logEntry = messagingService.sendMessage(
            request.reservationId(), request.templateId(), orgId, channel);
        return ResponseEntity.ok(GuestMessageLogDto.fromEntity(logEntry));
    }

    /** Canal demande, repli sur EMAIL si absent ou inconnu. */
    private static MessageChannelType parseChannel(String channel) {
        if (channel == null || channel.isBlank()) {
            return MessageChannelType.EMAIL;
        }
        try {
            return MessageChannelType.valueOf(channel.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return MessageChannelType.EMAIL;
        }
    }

    // ── Renvoi d'un message echoue ──

    /**
     * Renvoie un message deja emis (meme reservation, meme modele).
     *
     * <h3>Securite</h3>
     * <p>Le renvoi remet un contenu dans la boite d'un voyageur : c'est une
     * prise de parole au nom de l'organisation, pas une tache de terrain. Le
     * garde reprend donc l'ensemble deja retenu pour l'ecriture des contenus
     * emis vers des tiers — {@link SystemEmailTemplateController},
     * {@link WhatsAppTemplateController}, {@link DocumentController} : les
     * roles d'administration d'org, jamais les roles operationnels
     * (TECHNICIAN, HOUSEKEEPER, SUPERVISOR, LAUNDRY, EXTERIOR_TECH).</p>
     *
     * <p>Ces controleurs listent en plus {@code 'ADMIN'} : le litteral y est
     * inerte, les deux converters JWT normalisant tout role realm {@code admin}
     * en {@code SUPER_ADMIN} avant d'emettre l'authority. Il n'est pas repris
     * ici pour ne pas donner a lire une regle qui ne s'applique jamais.</p>
     *
     * <p>L'appartenance a l'organisation est portee par {@code roleInOrg}
     * ({@link com.clenzy.model.OrgMemberRole}), qui est un rang d'appartenance
     * et non une permission HTTP : aucun garde du backend ne s'en sert, et
     * l'isolation entre organisations vient du {@link TenantContext} —
     * {@code findLogForOrganization} ne rend que les logs de l'org courante.</p>
     */
    @PostMapping("/resend/{logId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<GuestMessageLogDto> resendMessage(@PathVariable Long logId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        GuestMessageLog logEntry = queryService.findLogForOrganization(logId, orgId).orElse(null);

        if (logEntry == null) {
            return ResponseEntity.notFound().build();
        }

        GuestMessageLog newLog = messagingService.sendMessage(
            logEntry.getReservationId(), logEntry.getTemplateId(), orgId);
        return ResponseEntity.ok(GuestMessageLogDto.fromEntity(newLog));
    }

    // ── Apercu du contenu d'un message ──

    @GetMapping("/preview/{logId}")
    public ResponseEntity<Map<String, String>> previewMessage(@PathVariable Long logId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        GuestMessageLog logEntry = queryService.findLogForOrganization(logId, orgId).orElse(null);

        if (logEntry == null || logEntry.getTemplateId() == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            var interpolated = messagingService.previewMessage(
                logEntry.getReservationId(), logEntry.getTemplateId(), orgId);
            return ResponseEntity.ok(Map.of(
                "subject", interpolated.subject(),
                "htmlBody", interpolated.htmlBody()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "subject", logEntry.getSubject() != null ? logEntry.getSubject() : "",
                "htmlBody", "<p>Apercu indisponible : " + e.getMessage() + "</p>"
            ));
        }
    }

    // ── Historique ──

    @GetMapping("/history")
    public List<GuestMessageLogDto> getHistory() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return queryService.getHistory(orgId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }

    @GetMapping("/history/reservation/{reservationId}")
    public List<GuestMessageLogDto> getReservationHistory(@PathVariable Long reservationId) {
        // Org du requester (null = platform staff, lecture cross-org autorisee).
        Long orgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        return queryService.getReservationHistory(reservationId, orgId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }
}
