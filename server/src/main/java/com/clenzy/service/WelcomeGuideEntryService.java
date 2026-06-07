package com.clenzy.service;

import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.GuestbookEntryRequest;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideEntry;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.WelcomeGuideEntryRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Livre d'or du livret d'accueil : ajout par le guest (via token public valide)
 * et lecture cote hote. Service dedie pour ne pas alourdir {@link WelcomeGuideService}.
 */
@Service
public class WelcomeGuideEntryService {

    private final WelcomeGuideTokenRepository tokenRepository;
    private final WelcomeGuideEntryRepository entryRepository;
    private final WelcomeGuideRepository guideRepository;

    public WelcomeGuideEntryService(WelcomeGuideTokenRepository tokenRepository,
                                     WelcomeGuideEntryRepository entryRepository,
                                     WelcomeGuideRepository guideRepository) {
        this.tokenRepository = tokenRepository;
        this.entryRepository = entryRepository;
        this.guideRepository = guideRepository;
    }

    /** Ajoute une entree (guest) si le token est valide. Vide sinon (404). */
    @Transactional
    public Optional<GuestbookEntryDto> addEntry(UUID token, GuestbookEntryRequest req) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .filter(t -> t.getGuide() != null && t.getGuide().isGuestbookEnabled())
            .map(t -> {
                WelcomeGuide guide = t.getGuide();
                WelcomeGuideEntry entry = new WelcomeGuideEntry();
                entry.setOrganizationId(guide.getOrganizationId());
                entry.setGuide(guide);
                entry.setReservation(t.getReservation());
                entry.setAuthorName(trim(req.authorName(), 200));
                entry.setMessage(trim(req.message(), 2000));
                entry.setRating(normalizeRating(req.rating()));
                return GuestbookEntryDto.from(entryRepository.save(entry));
            });
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
        return guideRepository.findByIdAndOrganizationId(guideId, orgId)
            .map(g -> entryRepository.findByGuideIdOrderByCreatedAtDesc(g.getId())
                .stream().map(GuestbookEntryDto::from).toList())
            .orElseGet(List::of);
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
