package com.clenzy.config;

import com.clenzy.model.Guest;
import com.clenzy.repository.GuestRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Backfill idempotent du {@code phone_hash} des guests existants, au démarrage.
 *
 * <p>Le {@code phone} est chiffré (AES) — on ne peut donc PAS le hasher en SQL
 * natif (cf. migration 0193, contrairement à email_hash des users en 0039). On
 * le fait en Java : charger les guests sans phone_hash, déchiffrer via le getter,
 * normaliser E.164 + hasher, sauver.</p>
 *
 * <p>Idempotent : aux boots suivants il ne reste que les guests sans numéro (ou
 * numéro non normalisable), qui sont ignorés. En pré-lancement le volume est
 * faible. Échec non bloquant pour ne pas empêcher le démarrage.</p>
 */
@Component
public class GuestPhoneHashBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(GuestPhoneHashBackfillRunner.class);

    private final GuestRepository guestRepository;

    public GuestPhoneHashBackfillRunner(GuestRepository guestRepository) {
        this.guestRepository = guestRepository;
    }

    @Override
    public void run(String... args) {
        try {
            List<Guest> pending = guestRepository.findByPhoneHashIsNull();
            int updated = 0;
            for (Guest g : pending) {
                String phone = g.getPhone();
                if (phone == null || phone.isBlank()) continue;
                String hash = StringUtils.computePhoneHash(phone, g.getCountryCode());
                if (hash == null) continue; // numéro non normalisable, on laisse null
                g.setPhoneHash(hash);
                guestRepository.save(g);
                updated++;
            }
            if (updated > 0) {
                log.info("Backfill phone_hash : {} guest(s) mis a jour", updated);
            }
        } catch (Exception e) {
            log.warn("Backfill phone_hash echoue (non bloquant): {}", e.getMessage());
        }
    }
}
