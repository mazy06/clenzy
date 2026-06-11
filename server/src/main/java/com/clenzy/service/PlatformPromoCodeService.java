package com.clenzy.service;

import com.clenzy.model.PlatformPromoCode;
import com.clenzy.repository.PlatformPromoCodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service de validation et de consommation des codes promo.
 *
 * <p>Sépare l'audit (le code est <em>collecte</em> meme s'il est invalide,
 * pour analyser les attempts) de la <em>consommation</em> (incrementer
 * used_count + appliquer la reduction Stripe). Le flow type :</p>
 *
 * <ol>
 *   <li>{@link #validate(String)} : check actif, dates, quota — read-only</li>
 *   <li>{@link #tryConsume(Long)} : CAS atomique sur used_count — write</li>
 * </ol>
 *
 * <p>Sequence recommandee dans InscriptionService :</p>
 * <pre>
 *   var promo = promoCodeService.validate(dto.getPromoCode());
 *   if (promo.isPresent()) {
 *       boolean consumed = promoCodeService.tryConsume(promo.get().getId());
 *       if (consumed) {
 *           // Appliquer le discount Stripe
 *       }
 *   }
 * </pre>
 */
@Service
@Transactional
public class PlatformPromoCodeService {

    private static final Logger logger = LoggerFactory.getLogger(PlatformPromoCodeService.class);

    private final PlatformPromoCodeRepository repository;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public PlatformPromoCodeService(PlatformPromoCodeRepository repository) {
        this(repository, Clock.systemUTC());
    }

    /** Constructeur package-private pour les tests (Clock mock). */
    PlatformPromoCodeService(PlatformPromoCodeRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Valide un code (read-only). Retourne le PlatformPromoCode si utilisable
     * <em>au moment de l'appel</em>, sinon empty.
     */
    @Transactional(readOnly = true)
    public Optional<PlatformPromoCode> validate(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) return Optional.empty();
        var found = repository.findByCodeIgnoreCase(rawCode.trim());
        if (found.isEmpty()) {
            logger.info("Promo code inconnu: {}", rawCode);
            return Optional.empty();
        }
        var code = found.get();
        var now = LocalDateTime.now(clock);
        if (!code.isUsableAt(now)) {
            logger.info("Promo code non utilisable (code={}, active={}, validFrom={}, validUntil={}, used={}/{})",
                    code.getCode(), code.isActive(), code.getValidFrom(),
                    code.getValidUntil(), code.getUsedCount(), code.getMaxUses());
            return Optional.empty();
        }
        return found;
    }

    /**
     * Liste complete des codes promo (administration plateforme).
     * Deplace de AdminPlatformPromoCodeController (T-ARCH-01).
     */
    @Transactional(readOnly = true)
    public List<PlatformPromoCode> findAll() {
        return repository.findAll();
    }

    /**
     * Cree un code promo (administration plateforme). La validation des
     * valeurs (range %, type) est portee par les contraintes de l'entite.
     */
    public PlatformPromoCode create(PlatformPromoCode promo) {
        return repository.save(promo);
    }

    /**
     * (De)active un code promo. Entite plateforme sans organisation :
     * pas de validation d'org (endpoint reserve SUPER_ADMIN).
     *
     * @return le code mis a jour, ou empty s'il n'existe pas
     */
    public Optional<PlatformPromoCode> setActive(Long id, boolean active) {
        return repository.findById(id).map(promo -> {
            promo.setActive(active);
            return repository.save(promo);
        });
    }

    /**
     * Tentative de consommation atomique (CAS). Renvoie vrai si l'increment
     * a reussi (used_count incremente, quota non depasse), faux si race ou
     * code desactive entre temps.
     */
    public boolean tryConsume(Long promoCodeId) {
        int updated = repository.tryIncrementUsedCount(promoCodeId);
        if (updated == 0) {
            logger.warn("tryConsume failed for promoCodeId={} (quota epuise ou code desactive)", promoCodeId);
            return false;
        }
        return true;
    }
}
