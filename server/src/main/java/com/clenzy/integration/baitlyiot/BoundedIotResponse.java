package com.clenzy.integration.baitlyiot;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpResponse;

/** The PMS also treats its IoT upstream as untrusted, including chunked responses. */
final class BoundedIotResponse implements ClientHttpResponse {
    static final int MAX_BYTES = 4 * 1024 * 1024;
    private final ClientHttpResponse source;
    private final byte[] body;
    private final Runnable release;
    private final AtomicBoolean closed = new AtomicBoolean();

    BoundedIotResponse(ClientHttpResponse source, Runnable release) throws IOException {
        this.source = source;
        this.release = release;
        try {
            if (source.getHeaders().getContentLength() > MAX_BYTES) throw new IOException("Baitly IoT response too large");
            body = source.getBody().readNBytes(MAX_BYTES + 1);
            if (body.length > MAX_BYTES) throw new IOException("Baitly IoT response too large");
        } catch (IOException | RuntimeException error) {
            source.close();
            throw error;
        }
    }

    @Override public HttpStatusCode getStatusCode() throws IOException { return source.getStatusCode(); }
    @Override public String getStatusText() throws IOException { return source.getStatusText(); }
    @Override public HttpHeaders getHeaders() { return source.getHeaders(); }
    @Override public InputStream getBody() { return new ByteArrayInputStream(body); }
    @Override public void close() {
        if (closed.compareAndSet(false, true)) {
            try { source.close(); }
            finally { release.run(); }
        }
    }
}
