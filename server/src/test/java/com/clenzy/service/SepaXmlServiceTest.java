package com.clenzy.service;

import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link SepaXmlService} — pain.001.001.03 XML generation.
 *
 * <p>Tests cover validation of debtor and beneficiary inputs, multi-payout
 * batches, BIC/IBAN normalization, name truncation, description fallback,
 * and correct XML structure.</p>
 */
class SepaXmlServiceTest {

    private SepaXmlService service;

    @BeforeEach
    void setUp() {
        service = new SepaXmlService();
    }

    // ─── Validation ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("validateInputs")
    class ValidateInputs {

        @Test
        void whenDebtorIbanMissing_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorIban(null);
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("IBAN debiteur");
        }

        @Test
        void whenDebtorIbanBlank_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorIban("   ");
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenDebtorBicMissing_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorBic(null);
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("BIC debiteur");
        }

        @Test
        void whenDebtorBicBlank_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorBic("");
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenDebtorNameMissing_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorName(null);
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("debiteur");
        }

        @Test
        void whenDebtorNameBlank_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            org.setSepaDebtorName("  ");
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of(1L, configFor(1L));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenPayoutsListEmpty_thenThrowsIllegalArgument() {
            Organization org = baseOrg();

            assertThatThrownBy(() -> service.generatePain001(org, List.of(), Map.of()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Aucun payout");
        }

        @Test
        void whenConfigMissingForOwner_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            List<OwnerPayout> payouts = List.of(payout(99L, "10.00"));
            Map<Long, OwnerPayoutConfig> configs = Map.of();

            assertThatThrownBy(() -> service.generatePain001(org, payouts, configs))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Configuration manquante")
                    .hasMessageContaining("99");
        }

        @Test
        void whenOwnerConfigIbanMissing_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setIban(null);
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, Map.of(1L, cfg)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("IBAN manquant");
        }

        @Test
        void whenOwnerConfigIbanBlank_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setIban("  ");
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, Map.of(1L, cfg)))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenOwnerConfigBicMissing_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setBic(null);
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, Map.of(1L, cfg)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("BIC manquant");
        }

        @Test
        void whenOwnerConfigBicBlank_thenThrowsIllegalArgument() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setBic("");
            List<OwnerPayout> payouts = List.of(payout(1L, "10.00"));

            assertThatThrownBy(() -> service.generatePain001(org, payouts, Map.of(1L, cfg)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── Successful XML generation ──────────────────────────────────────────

    @Nested
    @DisplayName("generatePain001 — single payout")
    class SinglePayout {

        @Test
        void whenValidInputs_thenGeneratesValidXml() {
            Organization org = baseOrg();
            OwnerPayout p = payout(1L, "150.00");
            OwnerPayoutConfig cfg = configFor(1L);

            String xml = service.generatePain001(org, List.of(p), Map.of(1L, cfg));

            assertThat(xml).isNotBlank();
            assertThat(xml).startsWith("<?xml");
            assertThat(xml).contains("pain.001.001.03");
            assertThat(xml).contains("<Document");
            assertThat(xml).contains("<CstmrCdtTrfInitn>");
            assertThat(xml).contains("<GrpHdr>");
            assertThat(xml).contains("<PmtInf>");
            assertThat(xml).contains("<CdtTrfTxInf>");
        }

        @Test
        void whenValidInputs_thenContainsDebtorDetails() {
            Organization org = baseOrg();
            org.setSepaDebtorName("Clenzy SAS");
            org.setSepaDebtorIban("FR7630006000011234567890189");
            org.setSepaDebtorBic("BNPAFRPP");

            String xml = service.generatePain001(org, List.of(payout(1L, "200.00")),
                    Map.of(1L, configFor(1L)));

            assertThat(xml).contains("Clenzy SAS");
            assertThat(xml).contains("<IBAN>FR7630006000011234567890189</IBAN>");
            assertThat(xml).contains("<BIC>BNPAFRPP</BIC>");
        }

        @Test
        void whenIbanContainsSpaces_thenWhitespaceStrippedInXml() {
            Organization org = baseOrg();
            org.setSepaDebtorIban("FR76 3000 6000 0112 3456 7890 189");
            org.setSepaDebtorBic("BNPA FRPP");
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setIban("DE89 3704 0044 0532 0130 00");
            cfg.setBic("COBA DEFF");

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")), Map.of(1L, cfg));

            assertThat(xml).contains("<IBAN>FR7630006000011234567890189</IBAN>");
            assertThat(xml).contains("<BIC>BNPAFRPP</BIC>");
            assertThat(xml).contains("<IBAN>DE89370400440532013000</IBAN>");
            assertThat(xml).contains("<BIC>COBADEFF</BIC>");
        }

        @Test
        void whenSinglePayout_thenContainsCtrlSumAndNbOfTxs() {
            Organization org = baseOrg();
            String xml = service.generatePain001(org, List.of(payout(1L, "150.00")),
                    Map.of(1L, configFor(1L)));

            assertThat(xml).contains("<NbOfTxs>1</NbOfTxs>");
            assertThat(xml).contains("<CtrlSum>150.00</CtrlSum>");
        }

        @Test
        void whenSinglePayout_thenContainsEndToEndIdAndAmount() {
            Organization org = baseOrg();
            OwnerPayout p = payout(1L, "99.99");
            p.setId(42L);

            String xml = service.generatePain001(org, List.of(p), Map.of(1L, configFor(1L)));

            assertThat(xml).contains("<EndToEndId>PAYOUT-42</EndToEndId>");
            assertThat(xml).contains("Ccy=\"EUR\"");
            assertThat(xml).contains(">99.99<");
        }

        @Test
        void whenPayoutHasPeriods_thenDescriptionIncludesDates() {
            Organization org = baseOrg();
            OwnerPayout p = payout(1L, "50.00");
            p.setId(7L);
            p.setPeriodStart(LocalDate.of(2026, 1, 1));
            p.setPeriodEnd(LocalDate.of(2026, 1, 31));

            String xml = service.generatePain001(org, List.of(p), Map.of(1L, configFor(1L)));

            assertThat(xml).contains("Reversement #7");
            assertThat(xml).contains("2026-01-01");
            assertThat(xml).contains("2026-01-31");
        }

        @Test
        void whenPayoutHasNullPeriods_thenDescriptionStillIncludesPayoutId() {
            Organization org = baseOrg();
            OwnerPayout p = payout(1L, "50.00");
            p.setId(7L);
            p.setPeriodStart(null);
            p.setPeriodEnd(null);

            String xml = service.generatePain001(org, List.of(p), Map.of(1L, configFor(1L)));

            assertThat(xml).contains("Reversement #7");
            assertThat(xml).contains("<Ustrd>");
        }

        @Test
        void whenBankAccountHolderProvided_thenUsedAsCreditorName() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setBankAccountHolder("John Smith");

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")), Map.of(1L, cfg));

            assertThat(xml).contains("John Smith");
        }

        @Test
        void whenBankAccountHolderNull_thenUsesNAFallback() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setBankAccountHolder(null);

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")), Map.of(1L, cfg));

            assertThat(xml).contains(">N/A<");
        }

        @Test
        void whenLongDebtorName_thenTruncatedTo70Chars() {
            String longName = "X".repeat(150);
            Organization org = baseOrg();
            org.setSepaDebtorName(longName);

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")),
                    Map.of(1L, configFor(1L)));

            // The truncation keeps only first 70 chars in <Nm> tags
            assertThat(xml).contains("<Nm>" + "X".repeat(70) + "</Nm>");
            assertThat(xml).doesNotContain("<Nm>" + "X".repeat(71) + "</Nm>");
        }

        @Test
        void whenLongHolderName_thenTruncatedTo70Chars() {
            Organization org = baseOrg();
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setBankAccountHolder("Y".repeat(120));

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")), Map.of(1L, cfg));

            assertThat(xml).contains("<Nm>" + "Y".repeat(70) + "</Nm>");
        }

        @Test
        void whenSinglePayout_thenIncludesServiceLevelSepa() {
            String xml = service.generatePain001(baseOrg(), List.of(payout(1L, "10.00")),
                    Map.of(1L, configFor(1L)));

            assertThat(xml).contains("<Cd>SEPA</Cd>");
            assertThat(xml).contains("<PmtMtd>TRF</PmtMtd>");
            assertThat(xml).contains("<ChrgBr>SLEV</ChrgBr>");
        }

        @Test
        void whenSinglePayout_thenIncludesMessageId() {
            Organization org = baseOrg();
            org.setId(42L);

            String xml = service.generatePain001(org, List.of(payout(1L, "10.00")),
                    Map.of(1L, configFor(1L)));

            assertThat(xml).contains("<MsgId>CLENZY-42-");
            assertThat(xml).contains("<PmtInfId>PMT-CLENZY-42-");
        }
    }

    @Nested
    @DisplayName("generatePain001 — batch")
    class BatchPayouts {

        @Test
        void whenMultiplePayouts_thenAggregatesCtrlSumAndNbOfTxs() {
            Organization org = baseOrg();
            OwnerPayout p1 = payout(1L, "100.00");
            OwnerPayout p2 = payout(2L, "200.50");
            OwnerPayout p3 = payout(3L, "300.25");

            String xml = service.generatePain001(org, List.of(p1, p2, p3),
                    Map.of(1L, configFor(1L), 2L, configFor(2L), 3L, configFor(3L)));

            assertThat(xml).contains("<NbOfTxs>3</NbOfTxs>");
            assertThat(xml).contains("<CtrlSum>600.75</CtrlSum>");
        }

        @Test
        void whenMultiplePayouts_thenGeneratesOneCreditTransferPerPayout() {
            Organization org = baseOrg();
            OwnerPayout p1 = payout(1L, "100.00");
            p1.setId(10L);
            OwnerPayout p2 = payout(2L, "200.00");
            p2.setId(20L);

            String xml = service.generatePain001(org, List.of(p1, p2),
                    Map.of(1L, configFor(1L), 2L, configFor(2L)));

            assertThat(xml).contains("PAYOUT-10");
            assertThat(xml).contains("PAYOUT-20");
            // Two <CdtTrfTxInf> elements
            int count = xml.split("<CdtTrfTxInf>", -1).length - 1;
            assertThat(count).isEqualTo(2);
        }

        @Test
        void whenMultiplePayoutsForSameOwner_thenSameIbanReferenced() {
            Organization org = baseOrg();
            OwnerPayout p1 = payout(1L, "100.00");
            p1.setId(11L);
            OwnerPayout p2 = payout(1L, "50.00");
            p2.setId(12L);
            OwnerPayoutConfig cfg = configFor(1L);
            cfg.setIban("DE89370400440532013000");

            String xml = service.generatePain001(org, List.of(p1, p2), Map.of(1L, cfg));

            // IBAN should appear twice for credit transfers + once for debtor (= 3 total)
            int count = xml.split("DE89370400440532013000", -1).length - 1;
            assertThat(count).isGreaterThanOrEqualTo(2);
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Organization baseOrg() {
        Organization org = new Organization();
        org.setId(10L);
        org.setSepaDebtorName("Clenzy");
        org.setSepaDebtorIban("FR7630006000011234567890189");
        org.setSepaDebtorBic("BNPAFRPP");
        return org;
    }

    private OwnerPayout payout(Long ownerId, String amount) {
        OwnerPayout p = new OwnerPayout();
        p.setId(1L);
        p.setOwnerId(ownerId);
        p.setOrganizationId(10L);
        p.setNetAmount(new BigDecimal(amount));
        p.setPeriodStart(LocalDate.of(2026, 1, 1));
        p.setPeriodEnd(LocalDate.of(2026, 1, 31));
        return p;
    }

    private OwnerPayoutConfig configFor(Long ownerId) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOwnerId(ownerId);
        c.setOrganizationId(10L);
        c.setIban("DE89370400440532013000");
        c.setBic("COBADEFF");
        c.setBankAccountHolder("Holder Name");
        c.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        return c;
    }
}
