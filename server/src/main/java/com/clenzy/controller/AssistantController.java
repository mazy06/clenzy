package com.clenzy.controller;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.service.agent.AttachmentRef;
import com.clenzy.service.agent.briefing.AssistantBriefingPrefService;
import com.clenzy.service.agent.briefing.BriefingComposer;
import com.clenzy.service.agent.briefing.BriefingDelivery;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Endpoints de l'assistant conversationnel.
 *
 * <p>Toutes les routes sont {@code isAuthenticated()} minimum. L'ownership des
 * conversations est verifie au niveau service via le {@code keycloakId} extrait
 * du JWT — un user ne peut jamais lire ou continuer la conversation d'un autre.</p>
 *
 * <p>Le chat est en SSE : le client poste son message, on lui pousse les events
 * (deltas texte, tool calls, done). Pas de polling.</p>
 */
@RestController
@RequestMapping("/api/assistant")
@PreAuthorize("isAuthenticated()")
public class AssistantController {

    private static final Logger log = LoggerFactory.getLogger(AssistantController.class);
    private static final long SSE_TIMEOUT_MS = 5 * 60_000L; // 5 minutes
    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024; // 5 MB (limite Anthropic)
    private static final Set<String> ALLOWED_IMAGE_MIME = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp");
    private static final int MAX_ATTACHMENTS_PER_MESSAGE = 3;

    private final AgentOrchestrator orchestrator;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;
    private final PhotoStorageService photoStorageService;
    private final AssistantBriefingPrefService briefingPrefService;
    private final BriefingComposer briefingComposer;
    private final BriefingDelivery briefingDelivery;

    /**
     * Pool dedie pour les streams SSE — evite de bloquer les threads Tomcat.
     *
     * <p>Pool <b>borne</b> a {@value #SSE_POOL_MAX_THREADS} threads avec queue
     * limitee : sous pic de charge, les nouvelles connexions SSE attendent en
     * queue plutot que d'ouvrir un thread par requete (ce qui pouvait creer
     * des milliers de threads). Si la queue sature aussi, la connexion est
     * rejetee (CallerRunsPolicy : execute sur le thread Tomcat — fail-fast
     * visible cote frontend plutot qu'OOM silencieux).</p>
     */
    private static final int SSE_POOL_CORE_THREADS = 10;
    private static final int SSE_POOL_MAX_THREADS = 100;
    private static final int SSE_POOL_QUEUE_CAPACITY = 200;
    private static final long SSE_POOL_KEEP_ALIVE_SECS = 60L;

    private final Executor sseExecutor = new ThreadPoolExecutor(
            SSE_POOL_CORE_THREADS, SSE_POOL_MAX_THREADS,
            SSE_POOL_KEEP_ALIVE_SECS, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(SSE_POOL_QUEUE_CAPACITY),
            r -> {
                Thread t = new Thread(r, "assistant-sse");
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.CallerRunsPolicy());

    public AssistantController(AgentOrchestrator orchestrator,
                                AssistantConversationRepository conversationRepository,
                                AssistantMessageRepository messageRepository,
                                TenantContext tenantContext,
                                ObjectMapper objectMapper,
                                PhotoStorageService photoStorageService,
                                AssistantBriefingPrefService briefingPrefService,
                                BriefingComposer briefingComposer,
                                BriefingDelivery briefingDelivery) {
        this.orchestrator = orchestrator;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.photoStorageService = photoStorageService;
        this.briefingPrefService = briefingPrefService;
        this.briefingComposer = briefingComposer;
        this.briefingDelivery = briefingDelivery;
    }

    // ─── Chat SSE ──────────────────────────────────────────────────────────

    /**
     * Lance un nouveau message dans une conversation (existante ou nouvelle).
     * Stream les evenements via SSE jusqu'a "done" ou "error".
     *
     * Body JSON : {"conversationId": 42, "message": "...", "currentPage": "...", "selectedPropertyId": 7}
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@RequestBody ChatRequestBody body, @AuthenticationPrincipal Jwt jwt) {
        // Le message peut etre blank si seules des images sont envoyees ("voici le frigo")
        boolean hasMessage = body != null && body.message() != null && !body.message().isBlank();
        boolean hasAttachments = body != null && body.attachments() != null && !body.attachments().isEmpty();
        if (body == null || (!hasMessage && !hasAttachments)) {
            throw new IllegalArgumentException("message ou attachments est requis");
        }
        if (hasAttachments && body.attachments().size() > MAX_ATTACHMENTS_PER_MESSAGE) {
            throw new IllegalArgumentException(
                    "Maximum " + MAX_ATTACHMENTS_PER_MESSAGE + " images par message");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt.getSubject();

        AgentContext context = new AgentContext(
                orgId,
                keycloakId,
                jwt,
                jwt.getClaimAsString("locale") != null ? jwt.getClaimAsString("locale") : "fr",
                body.currentPage(),
                body.selectedPropertyId()
        );

        // Defaut : si l'user envoie que des images sans texte, on fournit un prompt minimal
        // pour que le modele commente l'image.
        String userMessage = hasMessage ? body.message() : "Analyse ces images.";
        List<AttachmentRef> attachments = hasAttachments ? body.attachments() : List.of();

        sseExecutor.execute(() -> {
            try {
                orchestrator.handleMessage(
                        body.conversationId(),
                        userMessage,
                        attachments,
                        context,
                        event -> sendSseEvent(emitter, event)
                );
                emitter.complete();
            } catch (IllegalArgumentException e) {
                // Owner mismatch / conversation introuvable — message clair pour le frontend
                sendSseEvent(emitter, AgentSseEvent.error(e.getMessage()));
                emitter.complete();
            } catch (Exception e) {
                log.error("AssistantController.chat failed", e);
                sendSseEvent(emitter, AgentSseEvent.error("Erreur interne : " + e.getMessage()));
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    private void sendSseEvent(SseEmitter emitter, AgentSseEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.type())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            // Le client a probablement coupe la connexion — silencieux
            log.debug("SSE send failed (client disconnected?) : {}", e.getMessage());
        }
    }

    // ─── Tool confirmation (reprise apres pause) ──────────────────────────

    /**
     * Endpoint appele par le frontend apres confirmation/refus d'un tool
     * d'ecriture en attente. Reprend la boucle de l'assistant en SSE.
     *
     * Body JSON : {"toolCallId": "toolu_xxx", "confirmed": true}
     */
    @PostMapping(value = "/tool-confirm", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter confirmTool(@RequestBody ToolConfirmBody body, @AuthenticationPrincipal Jwt jwt) {
        if (body == null || body.toolCallId() == null || body.toolCallId().isBlank()) {
            throw new IllegalArgumentException("toolCallId is required");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt.getSubject();

        AgentContext context = new AgentContext(
                orgId,
                keycloakId,
                jwt,
                jwt.getClaimAsString("locale") != null ? jwt.getClaimAsString("locale") : "fr",
                null,
                null
        );

        sseExecutor.execute(() -> {
            try {
                orchestrator.resumeAfterConfirmation(
                        body.toolCallId(),
                        body.confirmed(),
                        context,
                        event -> sendSseEvent(emitter, event)
                );
                emitter.complete();
            } catch (IllegalArgumentException e) {
                sendSseEvent(emitter, AgentSseEvent.error(e.getMessage()));
                emitter.complete();
            } catch (Exception e) {
                log.error("AssistantController.confirmTool failed", e);
                sendSseEvent(emitter, AgentSseEvent.error("Erreur interne : " + e.getMessage()));
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    /** Body de POST /assistant/tool-confirm. */
    public record ToolConfirmBody(String toolCallId, boolean confirmed) {}

    // ─── Conversations history ─────────────────────────────────────────────

    @GetMapping("/conversations")
    public ResponseEntity<Page<Map<String, Object>>> listConversations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AssistantConversation> p = conversationRepository.findActiveByUser(
                jwt.getSubject(), PageRequest.of(page, Math.min(50, size)));
        return ResponseEntity.ok(p.map(this::toConversationSummary));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<Map<String, Object>>> getMessages(
            @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // Ownership check : findByIdAndUser retourne empty si pas le proprietaire
        AssistantConversation conv = conversationRepository.findByIdAndUser(id, jwt.getSubject())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));

        List<AssistantMessage> messages = messageRepository.findByConversation(conv.getId());
        return ResponseEntity.ok(messages.stream().map(this::toMessageDto).toList());
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Void> archive(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        AssistantConversation conv = conversationRepository.findByIdAndUser(id, jwt.getSubject())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));
        conv.setArchivedAt(java.time.LocalDateTime.now());
        conversationRepository.save(conv);
        return ResponseEntity.noContent().build();
    }

    // ─── Mapping helpers ──────────────────────────────────────────────────

    private Map<String, Object> toConversationSummary(AssistantConversation c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("title", c.getTitle());
        m.put("model", c.getModel());
        m.put("createdAt", c.getCreatedAt());
        m.put("updatedAt", c.getUpdatedAt());
        return m;
    }

    private Map<String, Object> toMessageDto(AssistantMessage msg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", msg.getId());
        m.put("role", msg.getRole());
        if (msg.getContent() != null) m.put("content", msg.getContent());
        if (msg.getToolCalls() != null) m.put("toolCalls", msg.getToolCalls());
        if (msg.getAttachments() != null) m.put("attachments", msg.getAttachments());
        if (msg.getToolCallId() != null) m.put("toolCallId", msg.getToolCallId());
        m.put("createdAt", msg.getCreatedAt());
        return m;
    }

    // ─── Upload + retrieval pour les attachments (vision) ──────────────────

    /**
     * Upload d'une image pour usage dans le chat. Valide MIME + taille, persiste
     * via {@link PhotoStorageService} et retourne la reference que le frontend
     * doit reinjecter dans le body chat ({@code attachments}).
     *
     * <p>Limites :
     * <ul>
     *   <li>MIME : image/jpeg, image/png, image/gif, image/webp</li>
     *   <li>Taille : 5 MB max (limite Anthropic Vision)</li>
     * </ul>
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        validateUpload(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Lecture du fichier impossible");
        }

        String mediaType = file.getContentType();
        String filename = file.getOriginalFilename();
        String storageKey = photoStorageService.store(bytes, mediaType, filename);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("storageKey", storageKey);
        response.put("mediaType", mediaType);
        response.put("name", filename);
        response.put("size", bytes.length);
        // URL applicative pour re-rendu cote frontend (thumbnail dans MessageBubble)
        response.put("url", "/api/assistant/attachments/" + storageKey);

        log.info("Upload assistant : user={} mediaType={} size={}b key={}",
                jwt.getSubject(), mediaType, bytes.length, storageKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Sert le binaire d'un attachment uploade — utilise par le frontend pour
     * afficher les thumbnails dans l'historique.
     *
     * <p><b>Authorization stricte</b> : le {@code storageKey} doit appartenir a un
     * message d'une conversation du {@code keycloakId} extrait du JWT. Un user A
     * qui devine ou intercepte le storageKey d'un user B obtient un 404 (volontaire
     * — on ne distingue pas "n'existe pas" de "pas autorise" pour eviter
     * l'enumeration de cles).</p>
     *
     * <p>Le Content-Type est extrait du JSON {@code attachments} (champ
     * {@code mediaType}) — fallback {@code image/jpeg} si parsing echoue, pour
     * conserver l'ancien comportement en cas de cle legacy mal formee.</p>
     */
    @GetMapping("/attachments/{storageKey}")
    public ResponseEntity<byte[]> serveAttachment(@PathVariable String storageKey,
                                                    @AuthenticationPrincipal Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String keycloakId = jwt.getSubject();

        String attachmentsJson;
        try {
            attachmentsJson = messageRepository.findAttachmentsJsonByStorageKeyForUser(
                    storageKey, keycloakId);
        } catch (Exception e) {
            log.warn("serveAttachment: ownership lookup failed for key {} user {} : {}",
                    storageKey, keycloakId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
        if (attachmentsJson == null) {
            // Soit la cle n'existe pas, soit elle appartient a un autre user.
            // 404 dans les deux cas pour eviter l'enumeration.
            log.debug("serveAttachment: storage key {} not owned by user {}",
                    storageKey, keycloakId);
            return ResponseEntity.notFound().build();
        }

        String mediaType = extractMediaType(attachmentsJson, storageKey);
        if (mediaType == null) mediaType = "image/jpeg";

        try {
            byte[] data = photoStorageService.retrieve(storageKey);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mediaType))
                    .header("Cache-Control", "private, max-age=3600")
                    .body(data);
        } catch (Exception e) {
            log.debug("serveAttachment: storage key {} introuvable en storage", storageKey);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Extrait le {@code mediaType} associe a un {@code storageKey} dans une chaine
     * JSON d'attachments. Retourne null si le parsing echoue ou la cle est absente.
     * Volontairement defensif : ce parsing est sur le chemin chaud d'affichage des
     * thumbnails, il ne doit jamais crasher.
     */
    private String extractMediaType(String attachmentsJson, String storageKey) {
        if (attachmentsJson == null || storageKey == null) return null;
        try {
            com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(attachmentsJson);
            if (!arr.isArray()) return null;
            for (com.fasterxml.jackson.databind.JsonNode item : arr) {
                if (storageKey.equals(item.path("storageKey").asText(null))) {
                    String mt = item.path("mediaType").asText(null);
                    return (mt != null && !mt.isBlank()) ? mt : null;
                }
            }
        } catch (Exception e) {
            log.debug("extractMediaType: parsing failed : {}", e.getMessage());
        }
        return null;
    }

    private void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file est requis");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException(
                    "Fichier trop volumineux (max " + (MAX_UPLOAD_BYTES / (1024 * 1024)) + " MB)");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_MIME.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException(
                    "Type de fichier non supporte (MIME : " + contentType + "). "
                            + "Formats acceptes : " + String.join(", ", ALLOWED_IMAGE_MIME));
        }
    }

    // ─── Briefings proactifs ────────────────────────────────────────────────

    /**
     * Recupere les preferences de briefing de l'user courant. Si pas de pref
     * persistee, retourne les defauts ({@code daily_morning} / {@code in_app}
     * / 08:00 Europe/Paris).
     */
    @GetMapping("/briefings/prefs")
    public ResponseEntity<Map<String, Object>> getBriefingPrefs(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AssistantBriefingPref pref = briefingPrefService.get(jwt.getSubject())
                .orElseGet(() -> briefingPrefService.getDefaultPrefs(orgId, jwt.getSubject()));
        return ResponseEntity.ok(toPrefDto(pref));
    }

    /** Met a jour les prefs (upsert). */
    @PutMapping("/briefings/prefs")
    public ResponseEntity<Map<String, Object>> updateBriefingPrefs(
            @RequestBody BriefingPrefsBody body,
            @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AssistantBriefingPref.Frequency freq = AssistantBriefingPref.Frequency
                .fromString(body.frequency());
        java.time.LocalTime timeLocal = parseTimeOrDefault(body.timeLocal());
        AssistantBriefingPref pref = briefingPrefService.upsert(
                orgId,
                jwt.getSubject(),
                body.enabled() != null ? body.enabled() : true,
                freq,
                body.channels(),
                timeLocal,
                body.timezone());
        return ResponseEntity.ok(toPrefDto(pref));
    }

    /**
     * Trigger manuel pour test/debug — declenche immediatement un briefing
     * pour l'user, sans passer par le scheduler ni l'idempotence. Renvoie
     * l'id de la conversation creee + les canaux delivres.
     */
    @PostMapping("/briefings/trigger")
    public ResponseEntity<Map<String, Object>> triggerBriefing(
            @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AssistantBriefingPref pref = briefingPrefService.get(jwt.getSubject())
                .orElseGet(() -> briefingPrefService.getDefaultPrefs(orgId, jwt.getSubject()));

        BriefingComposer.BriefingResult result = briefingComposer.compose(pref);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                    Map.of("error", "BriefingComposer indisponible"));
        }
        List<String> channels = briefingPrefService.parseChannels(pref);
        List<String> delivered = briefingDelivery.dispatch(
                result, jwt.getSubject(), orgId, channels);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("conversationId", result.conversationId());
        response.put("delivered", delivered);
        response.put("requested", channels);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toPrefDto(AssistantBriefingPref pref) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", pref.isEnabled());
        m.put("frequency", pref.getFrequencyEnum().dbValue());
        m.put("channels", briefingPrefService.parseChannels(pref));
        m.put("timeLocal", pref.getTimeLocal() != null
                ? pref.getTimeLocal().toString() : "08:00");
        m.put("timezone", pref.getTimezone());
        return m;
    }

    private static java.time.LocalTime parseTimeOrDefault(String raw) {
        if (raw == null || raw.isBlank()) return java.time.LocalTime.of(8, 0);
        try { return java.time.LocalTime.parse(raw); }
        catch (Exception e) {
            throw new IllegalArgumentException("timeLocal invalide : '" + raw + "' (format HH:mm)");
        }
    }

    /** Body pour PUT /briefings/prefs. {@code enabled} null = true par defaut. */
    public record BriefingPrefsBody(
            Boolean enabled,
            String frequency,
            List<String> channels,
            String timeLocal,
            String timezone
    ) {}

    // ─── Request body record ───────────────────────────────────────────────

    /**
     * Corps de requete chat. {@code conversationId} null = nouvelle conversation.
     * {@code attachments} : liste optionnelle de refs d'images uploadees au prealable
     * via {@code POST /upload}. Max {@value #MAX_ATTACHMENTS_PER_MESSAGE} par message.
     */
    public record ChatRequestBody(
            Long conversationId,
            String message,
            String currentPage,
            Long selectedPropertyId,
            List<AttachmentRef> attachments
    ) {}
}
