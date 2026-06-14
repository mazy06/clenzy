package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.model.ZatcaInvoiceChain;
import com.clenzy.repository.ZatcaInvoiceChainRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Gère la chaîne PIH/ICV ZATCA (CLZ-P0-21). Chaque facture émise en KSA reçoit un ICV monotone et
 * un hash SHA-256 Base64 qui incorpore le hash de la facture précédente (PIH) → chaîne inviolable.
 *
 * <p>Concurrence (audit #8) : l'attribution de l'ICV se fait sous <b>verrou pessimiste</b> sur la
 * tête de chaîne ({@link ZatcaInvoiceChainRepository#findTailForUpdate}) ; la double contrainte
 * unique {@code (org, icv)} / {@code (org, invoice_number)} est le garde-fou DB (jamais de
 * check-then-act). L'ajout est <b>idempotent</b> par numéro de facture.</p>
 *
 * <p><b>Périmètre (HP-10)</b> : le hash porte ici sur l'artefact UBL fourni. Au branchement de la
 * signature XAdES (CSID), il devra porter sur le document <b>signé</b> (conformément à la spec
 * ZATCA). L'ICV par EGS unit (vs par org) est aussi un raffinement HP-10.</p>
 */
@Service
public class ZatcaChainService {

    /** PIH de la première facture = Base64(SHA-256("0")), par la spec ZATCA. */
    static final String GENESIS_PIH = sha256Base64("0".getBytes(StandardCharsets.UTF_8));

    private final ZatcaInvoiceChainRepository repository;

    public ZatcaChainService(ZatcaInvoiceChainRepository repository) {
        this.repository = repository;
    }

    /**
     * Ajoute une facture à la chaîne et renvoie son maillon (ICV + hash + PIH). Idempotent : si la
     * facture est déjà chaînée, renvoie le maillon existant sans réinsertion.
     *
     * @param orgId         organisation émettrice
     * @param invoiceNumber numéro de facture (clé d'idempotence)
     * @param artifactBytes artefact à hasher (UBL ; document signé une fois XAdES branché — HP-10)
     */
    @Transactional
    public ZatcaInvoiceChain append(Long orgId, String invoiceNumber, byte[] artifactBytes) {
        // Idempotence sous verrou (le lock de tête sérialise les ajouts concurrents de la meme org).
        ZatcaInvoiceChain tail = repository.findTailForUpdate(orgId).orElse(null);

        return repository.findByOrganizationIdAndInvoiceNumber(orgId, invoiceNumber)
            .orElseGet(() -> {
                long nextIcv = (tail == null) ? 1L : tail.getIcv() + 1L;
                String previousHash = (tail == null) ? GENESIS_PIH : tail.getInvoiceHash();
                String invoiceHash = sha256Base64(concat(previousHash, artifactBytes));
                return repository.save(new ZatcaInvoiceChain(
                    orgId, nextIcv, invoiceNumber, invoiceHash, previousHash));
            });
    }

    private static byte[] concat(String previousHash, byte[] artifactBytes) {
        byte[] prev = (previousHash != null ? previousHash : "").getBytes(StandardCharsets.UTF_8);
        byte[] art = (artifactBytes != null ? artifactBytes : new byte[0]);
        byte[] out = new byte[prev.length + art.length];
        System.arraycopy(prev, 0, out, 0, prev.length);
        System.arraycopy(art, 0, out, prev.length, art.length);
        return out;
    }

    static String sha256Base64(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(data));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 est garanti par la plateforme Java ; absence = environnement casse.
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}
