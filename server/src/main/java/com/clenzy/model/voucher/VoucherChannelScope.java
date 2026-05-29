package com.clenzy.model.voucher;

/**
 * Canal d'application autorise pour un voucher.
 *
 * <p>Sert principalement pour les analytics (segmenter la provenance des
 * utilisations) et pour restreindre l'usage a certains canaux (ex: code
 * EXCLUSIF a WhatsApp envoye en campagne ciblee).</p>
 *
 * <ul>
 *   <li>{@link #ALL} : tous canaux (default, le plus permissif).</li>
 *   <li>{@link #BOOKING_ENGINE} : uniquement saisie dans le widget guest.</li>
 *   <li>{@link #DIRECT_LINK} : uniquement via lien pre-rempli {@code ?voucher=X}.</li>
 *   <li>{@link #WHATSAPP} : lien partage via WhatsApp (tracking d'origine).</li>
 *   <li>{@link #EMAIL} : lien partage via email (tracking d'origine).</li>
 * </ul>
 */
public enum VoucherChannelScope {
    ALL,
    BOOKING_ENGINE,
    DIRECT_LINK,
    WHATSAPP,
    EMAIL
}
