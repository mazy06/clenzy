package com.clenzy.service.ai;

import com.clenzy.model.AiUsageLedgerEntry;
import org.springframework.stereotype.Component;

/**
 * Contexte d'autonomie du run courant (campagne X4, ADR-007) — ThreadLocal.
 *
 * <p>Determine le bucket sous lequel le metering ({@link CreditMeteringService})
 * ecrit ses lignes de ledger : {@code INTERACTIVE} (defaut — chat utilisateur),
 * {@code SOCLE} (autonomie de base, debitee 0 credit mais tracee) ou
 * {@code PREMIUM_AUTO} (autonomie proactive premium, soumise au plafond X4).</p>
 *
 * <p>Le run s'execute dans le thread appelant (contrat streaming) : un
 * declencheur autonome (scheduler/Kafka — X8) pose le bucket en debut de run et
 * le nettoie en finally. Sans pose explicite, on reste en INTERACTIVE.</p>
 */
@Component
public class AutonomyContextHolder {

    private final ThreadLocal<String> bucket = new ThreadLocal<>();

    /** Pose le bucket du run courant (a nettoyer en finally via {@link #clear}). */
    public void set(String autonomyBucket) {
        bucket.set(autonomyBucket);
    }

    /** Bucket courant ; INTERACTIVE par defaut (chat utilisateur). */
    public String current() {
        String value = bucket.get();
        return value != null ? value : AiUsageLedgerEntry.BUCKET_INTERACTIVE;
    }

    public void clear() {
        bucket.remove();
    }
}
