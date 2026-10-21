package com.clenzy.config;

import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.protocol.Mechanism;
import io.sentry.protocol.Message;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;

import java.util.List;

/** Outbound allowlist: error diagnosis without requests, SQL, messages or identity. */
final class BaitlySentryPrivacy {
    private BaitlySentryPrivacy() {}

    static SentryEvent sanitize(SentryEvent source, Hint hint) {
        if (hint != null) {
            hint.clearAttachments();
            hint.setScreenshot(null);
            hint.setViewHierarchy(null);
            hint.setThreadDump(null);
        }
        SentryEvent clean = new SentryEvent(source.getTimestamp());
        clean.setEventId(source.getEventId());
        clean.setLevel(source.getLevel());
        clean.setLogger(codeName(source.getLogger()));
        clean.setPlatform("java");
        if (source.getRelease() != null && source.getRelease().matches(
                "(baitly@)?([0-9a-f]{7,40}|[0-9]+\\.[0-9]+\\.[0-9]+([-.][A-Za-z0-9.-]+)?)")) {
            clean.setRelease(source.getRelease());
        }
        if (List.of("production", "staging", "development", "test").contains(
                source.getEnvironment() == null ? "" : source.getEnvironment())) {
            clean.setEnvironment(source.getEnvironment());
        }
        Message message = new Message();
        message.setMessage("Baitly server error (private details withheld)");
        clean.setMessage(message);
        if (source.getExceptions() != null) {
            clean.setExceptions(source.getExceptions().stream().limit(8).map(BaitlySentryPrivacy::exception).toList());
        }
        return clean;
    }

    private static SentryException exception(SentryException source) {
        SentryException clean = new SentryException();
        clean.setType(codeName(source.getType()));
        clean.setModule(codeName(source.getModule()));
        clean.setValue("Private error details withheld");
        if (source.getMechanism() != null) {
            Mechanism mechanism = new Mechanism();
            mechanism.setType("generic");
            mechanism.setHandled(source.getMechanism().isHandled());
            clean.setMechanism(mechanism);
        }
        if (source.getStacktrace() != null && source.getStacktrace().getFrames() != null) {
            clean.setStacktrace(new SentryStackTrace(source.getStacktrace().getFrames().stream()
                    .limit(80).map(BaitlySentryPrivacy::frame).toList()));
        }
        return clean;
    }

    private static SentryStackFrame frame(SentryStackFrame source) {
        SentryStackFrame clean = new SentryStackFrame();
        String filename = source.getFilename();
        if (filename != null && filename.matches("[A-Za-z0-9_$]+\\.java")) clean.setFilename(filename);
        clean.setModule(codeName(source.getModule()));
        clean.setFunction(codeName(source.getFunction()));
        clean.setLineno(source.getLineno());
        clean.setColno(source.getColno());
        clean.setInApp(source.isInApp());
        return clean;
    }

    private static String codeName(String value) {
        return value != null && value.matches("[A-Za-z_$][A-Za-z0-9_.$<>]{0,180}") ? value : null;
    }
}
