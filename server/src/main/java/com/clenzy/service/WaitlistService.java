package com.clenzy.service;

import com.clenzy.dto.WaitlistSignupDto;
import com.clenzy.model.WaitlistSignup;
import com.clenzy.repository.WaitlistSignupRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Gestion des inscriptions à la liste d'attente (waitlist) du lancement Baitly.
 *
 * - idempotent par email (ré-inscription = renvoie la position existante),
 * - classe les « 20 premiers » (avantage garanti) via l'ordre d'arrivée,
 * - notifie info@ (non bloquant) + synchronise Brevo (best-effort).
 */
@Service
public class WaitlistService {

    private static final Logger log = LoggerFactory.getLogger(WaitlistService.class);

    /** Nombre de places « fondateur » (20 premiers) avec avantage garanti. */
    public static final int FOUNDER_SPOTS = 20;

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$");

    private final WaitlistSignupRepository repository;
    private final EmailService emailService;
    private final BrevoContactService brevoContactService;

    public WaitlistService(WaitlistSignupRepository repository, EmailService emailService,
                           BrevoContactService brevoContactService) {
        this.repository = repository;
        this.emailService = emailService;
        this.brevoContactService = brevoContactService;
    }

    /** Résultat d'une inscription. */
    public record WaitlistResult(long position, long total, long founderSpotsLeft,
                                 boolean founder, boolean alreadyRegistered) {}

    /** Stats publiques (compteur d'urgence de la landing). */
    public record WaitlistStats(long total, int founderSpots, long founderSpotsLeft) {}

    @Transactional
    public WaitlistResult register(WaitlistSignupDto dto, String ip) {
        String email = dto.email() == null ? null : dto.email().trim();
        if (email == null || !EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("Adresse email invalide.");
        }

        var existing = repository.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            long position = repository.positionOf(existing.get().getId());
            return new WaitlistResult(position, repository.count(), founderSpotsLeft(),
                    position <= FOUNDER_SPOTS, true);
        }

        WaitlistSignup s = new WaitlistSignup();
        s.setEmail(email);
        s.setFullName(trim(dto.fullName()));
        s.setPhone(trim(dto.phone()));
        s.setPropertyCount(trim(dto.propertyCount()));
        s.setCity(trim(dto.city()));
        s.setSource(dto.source() != null && !dto.source().isBlank() ? dto.source().trim() : "landing");
        s.setIpAddress(ip);
        s = repository.save(s);

        long position = repository.positionOf(s.getId());

        // Notif info@ (non bloquant) + sync Brevo (best-effort) — ne jamais faire échouer l'inscription.
        try { emailService.sendWaitlistNotification(s, position); }
        catch (Exception e) { log.warn("Notif waitlist KO #{} : {}", s.getId(), e.getMessage()); }
        try {
            if (brevoContactService.addToWaitlist(s)) {
                s.setBrevoSynced(true);
                repository.save(s);
            }
        } catch (Exception e) { log.warn("Sync Brevo KO #{} : {}", s.getId(), e.getMessage()); }

        log.info("Waitlist : nouvelle inscription #{} ({}) — position {}", s.getId(), email, position);
        return new WaitlistResult(position, repository.count(), founderSpotsLeft(),
                position <= FOUNDER_SPOTS, false);
    }

    @Transactional(readOnly = true)
    public WaitlistStats stats() {
        return new WaitlistStats(repository.count(), FOUNDER_SPOTS, founderSpotsLeft());
    }

    @Transactional(readOnly = true)
    public List<WaitlistSignup> listAll() {
        return repository.findAllByOrderByCreatedAtAsc();
    }

    private long founderSpotsLeft() {
        return Math.max(0, FOUNDER_SPOTS - repository.count());
    }

    private static String trim(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}
