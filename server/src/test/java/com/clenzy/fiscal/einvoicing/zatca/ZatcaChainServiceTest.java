package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.model.ZatcaInvoiceChain;
import com.clenzy.repository.ZatcaInvoiceChainRepository;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Chaîne PIH/ICV ZATCA (CLZ-P0-21) : séquence ICV + chaînage des hash SHA-256 Base64.
 */
class ZatcaChainServiceTest {

    private final ZatcaInvoiceChainRepository repository = mock(ZatcaInvoiceChainRepository.class);
    private final ZatcaChainService service = new ZatcaChainService(repository);

    private static String sha256Base64(byte[] data) throws Exception {
        return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(data));
    }

    @Test
    void firstInvoiceUsesGenesisPihAndIcvOne() throws Exception {
        when(repository.findTailForUpdate(1L)).thenReturn(Optional.empty());
        when(repository.findByOrganizationIdAndInvoiceNumber(1L, "INV-1")).thenReturn(Optional.empty());
        when(repository.save(any(ZatcaInvoiceChain.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] artifact = "<Invoice/>".getBytes(StandardCharsets.UTF_8);
        ZatcaInvoiceChain link = service.append(1L, "INV-1", artifact);

        String genesis = sha256Base64("0".getBytes(StandardCharsets.UTF_8));
        assertThat(link.getIcv()).isEqualTo(1L);
        assertThat(link.getPreviousInvoiceHash()).isEqualTo(genesis);
        // hash = SHA-256(prevHash || artifact)
        byte[] concat = (genesis + new String(artifact, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
        assertThat(link.getInvoiceHash()).isEqualTo(sha256Base64(concat));
    }

    @Test
    void nextInvoiceIncrementsIcvAndChainsPreviousHash() {
        ZatcaInvoiceChain tail = new ZatcaInvoiceChain(1L, 4L, "INV-4", "PREVHASH_BASE64", "GENESIS");
        when(repository.findTailForUpdate(1L)).thenReturn(Optional.of(tail));
        when(repository.findByOrganizationIdAndInvoiceNumber(1L, "INV-5")).thenReturn(Optional.empty());
        when(repository.save(any(ZatcaInvoiceChain.class))).thenAnswer(inv -> inv.getArgument(0));

        ZatcaInvoiceChain link = service.append(1L, "INV-5", "<Invoice/>".getBytes(StandardCharsets.UTF_8));

        assertThat(link.getIcv()).isEqualTo(5L);
        assertThat(link.getPreviousInvoiceHash()).isEqualTo("PREVHASH_BASE64");
        assertThat(link.getInvoiceHash()).isNotBlank().isNotEqualTo("PREVHASH_BASE64");
    }

    @Test
    void isIdempotentByInvoiceNumber() {
        ZatcaInvoiceChain existing = new ZatcaInvoiceChain(1L, 2L, "INV-2", "HASH2", "HASH1");
        when(repository.findTailForUpdate(1L)).thenReturn(Optional.of(
            new ZatcaInvoiceChain(1L, 9L, "INV-9", "HASH9", "HASH8")));
        when(repository.findByOrganizationIdAndInvoiceNumber(1L, "INV-2")).thenReturn(Optional.of(existing));

        ZatcaInvoiceChain link = service.append(1L, "INV-2", "x".getBytes(StandardCharsets.UTF_8));

        assertThat(link).isSameAs(existing);
        assertThat(link.getIcv()).isEqualTo(2L); // pas de ré-incrément
    }

    @Test
    void hashIsDeterministicForSameInputs() {
        when(repository.findTailForUpdate(anyLong())).thenReturn(Optional.empty());
        when(repository.findByOrganizationIdAndInvoiceNumber(eq(1L), any())).thenReturn(Optional.empty());
        when(repository.save(any(ZatcaInvoiceChain.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] artifact = "same".getBytes(StandardCharsets.UTF_8);
        String h1 = service.append(1L, "A", artifact).getInvoiceHash();
        String h2 = service.append(1L, "B", artifact).getInvoiceHash();

        assertThat(h1).isEqualTo(h2); // genesis PIH + meme artefact -> meme hash
    }
}
