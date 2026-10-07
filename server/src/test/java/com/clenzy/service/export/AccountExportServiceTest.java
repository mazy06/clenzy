package com.clenzy.service.export;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class AccountExportServiceTest {
    private static final AccountExportService.Scope HOST = new AccountExportService.Scope(1L, "owner", false);
    private static final AccountExportService.Scope STAFF = new AccountExportService.Scope(1L, "admin", true);

    @Test void hostRowsAreReachableOnlyFromOwnedProperties() {
        assertThat(AccountExportService.scopeFilter("properties", Set.of("id", "organization_id"), HOST, List.of(4L)))
            .isEqualTo(" and id in (:ids)");
        assertThat(AccountExportService.scopeFilter("conversation_messages", Set.of("conversation_id"), HOST, List.of(4L)))
            .contains("from conversations where property_id in (:ids)");
        assertThat(AccountExportService.scopeFilter("invoice_lines", Set.of("invoice_id"), HOST, List.of(4L)))
            .contains("from invoices where reservation_id in");
        assertThat(AccountExportService.scopeFilter("message_templates", Set.of("organization_id"), HOST, List.of(4L))).isNull();
        assertThat(AccountExportService.scopeFilter("reservations", Set.of("property_id"), HOST, List.of())).isEqualTo(" and false");
        assertThat(AccountExportService.scopeFilter("message_templates", Set.of("organization_id"), STAFF, List.of())).isEmpty();
    }

    @Test void secretsPaymentHandlesAndBlobsAreNeverExported() {
        for (String column : List.of("api_key", "access_token", "client_secret", "password_hash", "stripe_customer_id",
            "stripe_session_id", "payment_method_id", "sepa_debtor_iban", "data", "xml_content"))
            assertThat(AccountExportService.EXCLUDED_COLUMN.matcher(column).matches()).as(column).isTrue();
        for (String column : List.of("guest_name", "total_price", "check_in", "content", "review_text", "confirmation_code"))
            assertThat(AccountExportService.EXCLUDED_COLUMN.matcher(column).matches()).as(column).isFalse();
    }

    @Test void inventoryRecordsSizeAndSha256OfEveryFile() throws Exception {
        var buffer = new ByteArrayOutputStream();
        try (var writer = new AccountExportService.Writer(new ZipOutputStream(buffer))) {
            writer.text("csv/a.csv", "abc");
            assertThat(writer.inventory()).singleElement().satisfies(entry -> {
                assertThat(entry).containsEntry("path", "csv/a.csv").containsEntry("bytes", 3);
                assertThat(entry.get("sha256")).isEqualTo(AccountExportService.Writer.sha256("abc".getBytes(StandardCharsets.UTF_8)));
            });
        }
        assertThat(buffer.size()).isPositive();
    }
}
