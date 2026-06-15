package com.clenzy.booking.service;

import com.clenzy.booking.model.GuestCreditAccount;
import com.clenzy.booking.model.GuestReferral;
import com.clenzy.booking.model.GuestReferralStatus;
import com.clenzy.booking.repository.GuestCreditAccountRepository;
import com.clenzy.booking.repository.GuestReferralRepository;
import com.clenzy.model.Organization;
import com.clenzy.model.Reservation;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Parrainage voyageur (2.11). Un voyageur partage son code (stable, par compte de crédit) ; un
 * nouveau voyageur le saisit au moment de réserver (claim). Quand le séjour DIRECT du filleul est
 * terminé, parrain et filleul reçoivent un crédit fidélité (type GRANT, via {@link GuestCreditService}).
 * Aucun débit : crédit uniquement. Idempotent (statut du lien + clés de grant distinctes).
 */
@Service
public class GuestReferralService {

    private static final Logger log = LoggerFactory.getLogger(GuestReferralService.class);
    /** Alphabet sans caractères ambigus (pas de O/0/I/1) pour un code lisible/partageable. */
    private static final char[] CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GuestCreditAccountRepository accountRepository;
    private final GuestReferralRepository referralRepository;
    private final ReservationRepository reservationRepository;
    private final OrganizationRepository organizationRepository;
    private final GuestCreditService creditService;
    private final ObjectProvider<GuestReferralService> self;

    public GuestReferralService(GuestCreditAccountRepository accountRepository,
                                GuestReferralRepository referralRepository,
                                ReservationRepository reservationRepository,
                                OrganizationRepository organizationRepository,
                                GuestCreditService creditService,
                                ObjectProvider<GuestReferralService> self) {
        this.accountRepository = accountRepository;
        this.referralRepository = referralRepository;
        this.reservationRepository = reservationRepository;
        this.organizationRepository = organizationRepository;
        this.creditService = creditService;
        this.self = self;
    }

    /** Crédit de parrainage par côté (centimes) configuré sur l'org, 0 si le programme est désactivé. */
    @Transactional(readOnly = true)
    public int referralCreditCents(Long orgId) {
        return organizationRepository.findById(orgId)
            .map(Organization::getReferralCreditCents)
            .filter(c -> c != null && c > 0)
            .orElse(0);
    }

    /**
     * Code de parrainage du voyageur (créé à la demande). Garantit qu'un compte de crédit existe
     * pour {@code (org, email)} et lui attribue un code unique stable s'il n'en a pas.
     */
    @Transactional
    public String getOrCreateCode(Long orgId, String email) {
        if (orgId == null || email == null || email.isBlank()) {
            return null;
        }
        String mail = normalize(email);
        GuestCreditAccount acc = accountRepository.findByOrganizationIdAndEmail(orgId, mail)
            .orElseGet(() -> {
                GuestCreditAccount a = new GuestCreditAccount();
                a.setOrganizationId(orgId);
                a.setEmail(mail);
                a.setBalanceCents(0);
                return accountRepository.save(a);
            });
        if (acc.getReferralCode() == null || acc.getReferralCode().isBlank()) {
            acc.setReferralCode(generateUniqueCode(orgId));
            acc = accountRepository.save(acc);
        }
        return acc.getReferralCode();
    }

    /**
     * Rattache un filleul à un parrain via son code, sur une réservation directe. Best-effort :
     * renvoie {@code false} (sans lever) si le code est invalide, l'auto-parrainage, le filleul déjà
     * parrainé, ou la réservation introuvable/non directe. Le crédit est accordé plus tard (séjour terminé).
     */
    @Transactional
    public boolean claim(Long orgId, String reservationCode, String referralCode) {
        if (orgId == null || reservationCode == null || reservationCode.isBlank()
            || referralCode == null || referralCode.isBlank()) {
            return false;
        }
        GuestCreditAccount referrer = accountRepository
            .findByOrganizationIdAndReferralCode(orgId, referralCode.trim().toUpperCase(Locale.ROOT))
            .orElse(null);
        if (referrer == null) {
            return false; // code inconnu
        }
        Reservation reservation = reservationRepository
            .findByConfirmationCodeAndOrganizationId(reservationCode.trim(), orgId)
            .orElse(null);
        if (reservation == null || !"direct".equalsIgnoreCase(reservation.getSource())
            || reservation.getGuest() == null || reservation.getGuest().getEmail() == null) {
            return false;
        }
        String refereeEmail = normalize(reservation.getGuest().getEmail());
        if (refereeEmail.equalsIgnoreCase(referrer.getEmail())) {
            return false; // auto-parrainage interdit
        }
        if (referralRepository.existsByOrganizationIdAndRefereeEmail(orgId, refereeEmail)) {
            return false; // filleul déjà parrainé
        }
        GuestReferral referral = new GuestReferral();
        referral.setOrganizationId(orgId);
        referral.setRefereeEmail(refereeEmail);
        referral.setReferrerEmail(referrer.getEmail());
        referral.setReferralCode(referrer.getReferralCode());
        referral.setReservationCode(reservationCode.trim());
        referral.setStatus(GuestReferralStatus.PENDING);
        try {
            referralRepository.save(referral);
            return true;
        } catch (DataIntegrityViolationException e) {
            return false; // course sur la contrainte unique (filleul déjà parrainé)
        }
    }

    /**
     * Scan (scheduler) : pour chaque lien en attente dont le séjour direct est terminé (check-out
     * passé), crédite parrain ET filleul du montant org-level et passe le lien à GRANTED. Idempotent.
     * Renvoie le nombre de parrainages crédités.
     */
    public int grantCompletedStays(LocalDate cutoff) {
        int granted = 0;
        for (Organization org : organizationRepository.findByReferralCreditCentsGreaterThan(0)) {
            Integer cents = org.getReferralCreditCents();
            if (cents == null || cents <= 0) {
                continue;
            }
            for (GuestReferral ref : referralRepository.findByOrganizationIdAndStatus(org.getId(), GuestReferralStatus.PENDING)) {
                Reservation r = reservationRepository
                    .findByConfirmationCodeAndOrganizationId(ref.getReservationCode(), org.getId())
                    .orElse(null);
                if (!isCompletedDirectStay(r, cutoff)) {
                    continue;
                }
                try {
                    self.getObject().grantOne(ref, cents);
                    granted++;
                } catch (RuntimeException e) {
                    log.warn("Parrainage : échec crédit lien {} (org {}) : {}", ref.getId(), org.getId(), e.getMessage());
                }
            }
        }
        return granted;
    }

    /** Crédite les deux côtés d'un parrainage et fige le lien (transaction dédiée via le proxy). */
    @Transactional
    public void grantOne(GuestReferral ref, int cents) {
        String code = ref.getReservationCode();
        creditService.grant(ref.getOrganizationId(), ref.getReferrerEmail(), cents, "REF:" + code + ":referrer");
        creditService.grant(ref.getOrganizationId(), ref.getRefereeEmail(), cents, "REF:" + code + ":referee");
        ref.setStatus(GuestReferralStatus.GRANTED);
        ref.setGrantedAt(LocalDateTime.now());
        referralRepository.save(ref);
    }

    private boolean isCompletedDirectStay(Reservation r, LocalDate cutoff) {
        return r != null
            && "direct".equalsIgnoreCase(r.getSource())
            && "confirmed".equalsIgnoreCase(r.getStatus())
            && r.getCheckOut() != null && r.getCheckOut().isBefore(cutoff);
    }

    private String generateUniqueCode(Long orgId) {
        for (int attempt = 0; attempt < 6; attempt++) {
            String code = randomCode();
            if (accountRepository.findByOrganizationIdAndReferralCode(orgId, code).isEmpty()) {
                return code;
            }
        }
        throw new IllegalStateException("Impossible de générer un code de parrainage unique");
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)]);
        }
        return sb.toString();
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
