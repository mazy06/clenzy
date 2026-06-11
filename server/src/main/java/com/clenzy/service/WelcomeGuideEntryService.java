package com.clenzy.service;

import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.GuestbookEntryRequest;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideEntry;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.WelcomeGuideEntryRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Livre d'or du livret d'accueil : ajout par le guest (via token public valide)
 * et lecture cote hote. Service dedie pour ne pas alourdir {@link WelcomeGuideService}.
 *
 * <p>Anti spam/storage abuse (Z4B-SECBUGS-05) : l'ajout est plafonne par token
 * (compteur Redis journalier, comme {@code WelcomeGuideAnalyticsService}) et par
 * livret (nombre total d'entrees en base). Refus silencieux (404), aligne sur la
 * semantique token invalide.</p>
 */
@Service
public class WelcomeGuideEntryService {

    private static final Logger log = LoggerFactory.getLogger(WelcomeGuideEntryService.class);

    /** Un guest ecrit 1 entree ; 10/jour absorbe les corrections sans permettre le spam. */
    private static final long DAILY_CAP_PER_TOKEN = 10;
    /** Borne de stockage par livret (chaque message peut atteindre 2000 chars). */
    private static final long MAX_ENTRIES_PER_GUIDE = 500;

    private final WelcomeGuideTokenRepository tokenRepository;
    private final WelcomeGuideEntryRepository entryRepository;
    private final WelcomeGuideRepository guideRepository;
    private final StringRedisTemplate redisTemplate;

    public WelcomeGuideEntryService(WelcomeGuideTokenRepository tokenRepository,
                                     WelcomeGuideEntryRepository entryRepository,
                                     WelcomeGuideRepository guideRepository,
                                     StringRedisTemplate redisTemplate) {
        this.tokenRepository = tokenRepository;
        this.entryRepository = entryRepository;
        this.guideRepository = guideRepository;
        this.redisTemplate = redisTemplate;
    }

    /** Ajoute une entree (guest) si le token est valide et sous les plafonds. Vide sinon (404). */
    @Transactional
    public Optional<GuestbookEntryDto> addEntry(UUID token, GuestbookEntryRequest req) {
        Optional<WelcomeGuideToken> validToken = tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .filter(t -> t.getGuide() != null && t.getGuide().isGuestbookEnabled());
        if (validToken.isEmpty()) {
            return Optional.empty();
        }
        WelcomeGuideToken t = validToken.get();
        WelcomeGuide guide = t.getGuide();
        if (overDailyCap(token) || guideFull(guide.getId())) {
            log.warn("Entree livre d'or refusee (plafond atteint, guide={})", guide.getId());
            return Optional.empty();
        }

        WelcomeGuideEntry entry = new WelcomeGuideEntry();
        entry.setOrganizationId(guide.getOrganizationId());
        entry.setGuide(guide);
        entry.setReservation(t.getReservation());
        entry.setAuthorName(trim(req.authorName(), 200));
        entry.setMessage(trim(req.message(), 2000));
        entry.setRating(normalizeRating(req.rating()));
        return Optional.of(GuestbookEntryDto.from(entryRepository.save(entry)));
    }

    /** Liste publique (guest) : 100 dernieres entrees du livret, si token valide. */
    @Transactional(readOnly = true)
    public List<GuestbookEntryDto> listPublic(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .filter(t -> t.getGuide() != null && t.getGuide().isGuestbookEnabled())
            .map(t -> entryRepository.findTop100ByGuideIdOrderByCreatedAtDesc(t.getGuide().getId())
                .stream().map(GuestbookEntryDto::from).toList())
            .orElseGet(List::of);
    }

    /** Liste cote hote (org-scopee via le livret). */
    @Transactional(readOnly = true)
    public List<GuestbookEntryDto> listForGuide(Long guideId, Long orgId) {
        // Staff plateforme (orgId null) : accès cross-org par id.
        var guide = orgId != null
            ? guideRepository.findByIdAndOrganizationId(guideId, orgId)
            : guideRepository.findById(guideId);
        return guide
            .map(g -> entryRepository.findByGuideIdOrderByCreatedAtDesc(g.getId())
                .stream().map(GuestbookEntryDto::from).toList())
            .orElseGet(List::of);
    }

    /**
     * Incremente le compteur journalier du token ; true si le plafond est depasse.
     * Tolere Redis indisponible (le plafond par livret en base reste la borne dure).
     */
    private boolean overDailyCap(UUID token) {
        try {
            String key = "guide:entry:" + token + ":cap";
            Long n = redisTemplate.opsForValue().increment(key);
            if (n != null && n == 1L) {
                redisTemplate.expire(key, Duration.ofHours(24));
            }
            return n != null && n > DAILY_CAP_PER_TOKEN;
        } catch (Exception e) {
            return false;
        }
    }

    /** Borne dure de stockage : refuse au-dela de {@value #MAX_ENTRIES_PER_GUIDE} entrees par livret. */
    private boolean guideFull(Long guideId) {
        return entryRepository.countByGuideId(guideId) >= MAX_ENTRIES_PER_GUIDE;
    }

    private static String trim(String s, int max) {
        if (s == null) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    private static Integer normalizeRating(Integer r) {
        return (r != null && r >= 1 && r <= 5) ? r : null;
    }
}
