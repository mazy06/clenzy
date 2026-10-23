package com.clenzy.service.payout;

import org.junit.jupiter.api.Test;
import java.io.PrintWriter;
import java.io.StringWriter;
import static org.assertj.core.api.Assertions.*;

class BaitlyPayoutDiagnosticsTest {
    @Test void technicalTraceRetainsLocationsWithoutPrivateMessagesOrExceptionGraph() {
        var failure = new IllegalStateException("email=synthetic@example.invalid token=private-canary",
                new RuntimeException("password=private-cause"));
        failure.addSuppressed(new RuntimeException("address=private-suppressed"));
        var safe = BaitlyPayoutDiagnostics.technicalCause(failure);
        var rendered = new StringWriter(); safe.printStackTrace(new PrintWriter(rendered));
        assertThat(rendered.toString()).contains("technicalTraceRetainsLocations", BaitlyPayoutDiagnostics.RECONCILIATION_REQUIRED)
                .doesNotContain("private-", "example.invalid", "password=", "address=");
        assertThat(safe.getStackTrace()).containsExactly(failure.getStackTrace());
        assertThat(safe.getCause()).isNull(); assertThat(safe.getSuppressed()).isEmpty();
    }
}
