package com.clenzy.fiscal.einvoicing.zatca;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Encodage QR TLV ZATCA (CLZ-P0-20).
 */
class ZatcaQrTlvEncoderTest {

    private final ZatcaQrTlvEncoder encoder = new ZatcaQrTlvEncoder();

    @Test
    void encodesTlvBase64WithSellerAsFirstTag() {
        String b64 = encoder.encodeBase64(
            "Clenzy KSA", "300000000000003", "2026-03-15T10:00:00Z", "115.00", "15.00");

        byte[] bytes = Base64.getDecoder().decode(b64);
        assertThat(bytes[0]).isEqualTo((byte) 1);                 // tag 1 = nom vendeur
        int len1 = bytes[1] & 0xFF;
        String seller = new String(bytes, 2, len1, StandardCharsets.UTF_8);
        assertThat(seller).isEqualTo("Clenzy KSA");
        assertThat(bytes[2 + len1]).isEqualTo((byte) 2);          // tag 2 = numero TVA suit
    }

    @Test
    void handlesNullValuesAsEmptyTlv() {
        byte[] bytes = Base64.getDecoder().decode(encoder.encodeBase64(null, null, null, null, null));
        // 5 tags, chacun [tag,len=0] = 10 octets
        assertThat(bytes).hasSize(10);
        assertThat(bytes[0]).isEqualTo((byte) 1);
        assertThat(bytes[1]).isEqualTo((byte) 0);
    }
}
