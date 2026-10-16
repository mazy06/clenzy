package com.baitly.iot;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

/** Buffer only the small measurement contract, including requests sent with chunked encoding. */
final class BoundedJsonRequest extends HttpServletRequestWrapper {
    private final byte[] body;

    BoundedJsonRequest(HttpServletRequest request, byte[] body) {
        super(request);
        this.body = body;
    }

    @Override
    public ServletInputStream getInputStream() {
        var input = new ByteArrayInputStream(body);
        return new ServletInputStream() {
            @Override
            public int read() {
                return input.read();
            }

            @Override
            public int read(byte[] bytes, int offset, int length) {
                return input.read(bytes, offset, length);
            }

            @Override
            public boolean isFinished() {
                return input.available() == 0;
            }

            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setReadListener(ReadListener listener) {
                try {
                    if (!isFinished()) {
                        listener.onDataAvailable();
                    }
                    if (isFinished()) {
                        listener.onAllDataRead();
                    }
                } catch (IOException exception) {
                    listener.onError(exception);
                }
            }
        };
    }
}
