package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.InterventionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Evidence the assigned worker records during a Baitly mission: the technical diagnostic and the
 * end-of-mission acknowledgement (client signature, or the declared absence of a client).
 */
@Service
@Transactional
public class BaitlyMissionEvidenceService {
    private static final Set<String> CAUSES = Set.of("wear", "breakage", "leak", "electrical", "clogging", "misuse", "unknown");
    private final InterventionRepository missions;
    private final InterventionAccessPolicy access;
    private final InterventionPhotoRepository photos;
    private final Clock clock;

    public BaitlyMissionEvidenceService(InterventionRepository missions, InterventionAccessPolicy access,
                                        InterventionPhotoRepository photos, Clock clock) {
        this.missions = missions; this.access = access; this.photos = photos; this.clock = clock;
    }

    public record Material(String name, Integer quantity) {}
    public record Diagnostic(String finding, String cause, List<Material> materials) {}
    public record Signature(String status, String signerName) {}

    public void recordDiagnostic(Long id, Diagnostic diagnostic, Jwt jwt) {
        var mission = lockRunning(id, jwt);
        String finding = diagnostic == null ? null : clean(diagnostic.finding(), 2000);
        if (finding == null) throw bad("Décrivez le constat.");
        if (diagnostic.cause() != null && !CAUSES.contains(diagnostic.cause())) throw bad("Cause inconnue.");
        var materials = diagnostic.materials() == null ? List.<Material>of() : diagnostic.materials();
        if (materials.size() > 30) throw bad("Trop de pièces.");
        // Kept in the PMS fields the web team already reads; the cause is the leading line of the notes.
        mission.setTechnicianNotes(diagnostic.cause() == null ? finding : "[" + diagnostic.cause() + "] " + finding);
        mission.setMaterialsUsed(materials.isEmpty() ? null : materials.stream().map(this::material).collect(Collectors.joining(", ")));
    }

    public void recordSignature(Long id, Signature signature, Jwt jwt) {
        var mission = lockRunning(id, jwt);
        String status = signature == null ? null : signature.status();
        if ("CLIENT_ABSENT".equals(status)) {
            mission.recordBaitlySignature(status, null, LocalDateTime.now(clock));
            return;
        }
        if (!"SIGNED".equals(status)) throw bad("Statut de signature inconnu.");
        String signer = clean(signature.signerName(), 160);
        if (signer == null) throw bad("Indiquez le nom du signataire.");
        boolean stored = photos.findAllByInterventionId(id, mission.getOrganizationId()).stream()
            .anyMatch(photo -> photo.getOriginalFilename() != null && photo.getOriginalFilename().startsWith("baitly-" + id + "-step-signature-"));
        if (!stored) throw new ResponseStatusException(HttpStatus.CONFLICT, "Envoyez d’abord l’image de la signature.");
        mission.recordBaitlySignature(status, signer, LocalDateTime.now(clock));
    }

    private Intervention lockRunning(Long id, Jwt jwt) {
        var found = missions.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        access.requireAssignee(found, jwt);
        var mission = missions.findForReview(id, found.getOrganizationId()).orElseThrow();
        if (mission.getStatus() != InterventionStatus.IN_PROGRESS) throw new ResponseStatusException(HttpStatus.CONFLICT, "Mission non démarrée.");
        if (mission.getBaitlyPausedAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Intervention en pause.");
        return mission;
    }
    private String material(Material material) {
        String name = clean(material.name(), 120);
        if (name == null) throw bad("Nom de pièce manquant.");
        int quantity = material.quantity() == null ? 1 : material.quantity();
        if (quantity < 1 || quantity > 999) throw bad("Quantité invalide.");
        return name + " × " + quantity;
    }
    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        if (trimmed.length() > max) throw bad("Texte trop long.");
        return trimmed;
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
