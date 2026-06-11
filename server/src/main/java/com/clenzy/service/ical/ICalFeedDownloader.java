package com.clenzy.service.ical;

import com.clenzy.service.ICalUrlValidator;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.BufferedInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Telechargement HTTPS des feeds iCal avec connexion epinglee sur l'IP validee.
 *
 * <p><b>Anti SSRF / DNS rebinding (TOCTOU)</b> : {@link ICalUrlValidator#validateAndResolve}
 * resout le DNS et verifie que l'adresse est publique. Cette classe ouvre ensuite la
 * connexion TCP <b>directement sur cette InetAddress validee</b> — aucune re-resolution
 * DNS n'a lieu au moment de la requete, un attaquant ne peut donc pas faire pointer
 * le hostname vers une IP privee entre la validation et la connexion. Le certificat
 * TLS et le SNI restent valides contre le hostname d'origine (endpoint identification
 * HTTPS sur le hostname, pas sur l'IP).</p>
 *
 * <p><b>Redirections HTTP</b> : volontairement NON suivies (equivalent strict de
 * l'ancien {@code HttpClient.Redirect.NEVER}) — toute reponse non-200 (3xx compris)
 * est rejetee, ce qui empeche une redirection vers une IP privee ou un endpoint
 * de metadata cloud.</p>
 */
@Component
public class ICalFeedDownloader {

    /** SSRF protection: taille max de la reponse (5 MB). */
    static final long MAX_ICAL_RESPONSE_BYTES = 5 * 1024 * 1024;

    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final int MAX_HEADER_LINES = 100;
    private static final int MAX_LINE_LENGTH = 8 * 1024;
    private static final int HTTPS_DEFAULT_PORT = 443;

    /**
     * Valide l'URL (SSRF), resout le DNS et telecharge le contenu en se connectant
     * a l'adresse IP validee (pinning anti DNS-rebinding).
     * Retourne un flux limite en taille ; sa fermeture ferme la connexion sous-jacente.
     *
     * @throws IllegalArgumentException si l'URL est invalide ou pointe vers une adresse interdite
     * @throws IOException en cas d'erreur reseau ou de reponse HTTP non-200
     */
    public InputStream download(String url) throws IOException {
        InetAddress pinnedAddress = ICalUrlValidator.validateAndResolve(url);
        return download(URI.create(url.trim()), pinnedAddress);
    }

    /**
     * Telecharge le contenu de {@code uri} en se connectant a {@code pinnedAddress}.
     * Package-private pour les tests (l'adresse est normalement issue de
     * {@link ICalUrlValidator#validateAndResolve}).
     */
    InputStream download(URI uri, InetAddress pinnedAddress) throws IOException {
        Socket socket = openPinnedTlsSocket(uri, pinnedAddress);
        try {
            writeGetRequest(socket.getOutputStream(), uri);
            InputStream body = readResponseBody(new BufferedInputStream(socket.getInputStream()));
            return new SizeLimitedInputStream(new SocketClosingInputStream(body, socket));
        } catch (IOException e) {
            closeQuietly(socket);
            throw e;
        }
    }

    /**
     * Ouvre une connexion TLS dont le TCP cible l'IP epinglee mais dont le handshake
     * (SNI + verification du certificat) est fait contre le hostname d'origine.
     * Package-private pour permettre aux tests de court-circuiter le reseau.
     */
    Socket openPinnedTlsSocket(URI uri, InetAddress pinnedAddress) throws IOException {
        String host = uri.getHost();
        int port = uri.getPort() != -1 ? uri.getPort() : HTTPS_DEFAULT_PORT;
        Socket raw = new Socket();
        try {
            raw.connect(new InetSocketAddress(pinnedAddress, port), CONNECT_TIMEOUT_MS);
            raw.setSoTimeout(READ_TIMEOUT_MS);
            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            // host (et non l'IP) comme peer host -> SNI correct + verification du certificat
            // contre le hostname via l'endpoint identification HTTPS.
            SSLSocket ssl = (SSLSocket) factory.createSocket(raw, host, port, true);
            SSLParameters params = ssl.getSSLParameters();
            params.setEndpointIdentificationAlgorithm("HTTPS");
            ssl.setSSLParameters(params);
            ssl.startHandshake();
            return ssl;
        } catch (IOException e) {
            closeQuietly(raw);
            throw e;
        }
    }

    private static void writeGetRequest(OutputStream out, URI uri) throws IOException {
        String path = (uri.getRawPath() == null || uri.getRawPath().isEmpty()) ? "/" : uri.getRawPath();
        String target = uri.getRawQuery() != null ? path + "?" + uri.getRawQuery() : path;
        String hostHeader = (uri.getPort() != -1 && uri.getPort() != HTTPS_DEFAULT_PORT)
                ? uri.getHost() + ":" + uri.getPort()
                : uri.getHost();
        String request = "GET " + target + " HTTP/1.1\r\n"
                + "Host: " + hostHeader + "\r\n"
                + "User-Agent: Clenzy-PMS/1.0\r\n"
                + "Accept: text/calendar, */*\r\n"
                + "Accept-Encoding: identity\r\n"
                + "Connection: close\r\n"
                + "\r\n";
        out.write(request.getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    /**
     * Parse la status line et les en-tetes HTTP/1.1 puis retourne le flux du corps.
     * Toute reponse non-200 (redirections 3xx comprises) est rejetee.
     * Package-private static pour etre testable sans socket.
     */
    static InputStream readResponseBody(InputStream in) throws IOException {
        int statusCode = readStatusCode(in);
        boolean chunked = false;
        long contentLength = -1;
        int headerLines = 0;
        String line;
        while (!(line = readLine(in)).isEmpty()) {
            if (++headerLines > MAX_HEADER_LINES) {
                throw new IOException("Reponse HTTP invalide : trop d'en-tetes");
            }
            int colon = line.indexOf(':');
            if (colon <= 0) {
                continue;
            }
            String name = line.substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = line.substring(colon + 1).trim();
            if ("transfer-encoding".equals(name)) {
                chunked = value.toLowerCase(Locale.ROOT).contains("chunked");
            } else if ("content-length".equals(name)) {
                contentLength = parseContentLength(value);
            }
        }
        if (statusCode != 200) {
            throw new IOException("Erreur HTTP " + statusCode + " lors du telechargement du calendrier");
        }
        if (chunked) {
            return new ChunkedInputStream(in);
        }
        if (contentLength >= 0) {
            return new BoundedInputStream(in, contentLength);
        }
        // Connection: close -> lecture jusqu'a EOF
        return in;
    }

    private static int readStatusCode(InputStream in) throws IOException {
        String statusLine = readLine(in);
        String[] parts = statusLine.split(" ", 3);
        if (parts.length < 2 || !parts[0].startsWith("HTTP/")) {
            throw new IOException("Reponse HTTP invalide : " + statusLine);
        }
        try {
            return Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            throw new IOException("Reponse HTTP invalide : " + statusLine);
        }
    }

    private static long parseContentLength(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder(64);
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') {
                int len = sb.length();
                if (len > 0 && sb.charAt(len - 1) == '\r') {
                    sb.setLength(len - 1);
                }
                return sb.toString();
            }
            if (sb.length() >= MAX_LINE_LENGTH) {
                throw new IOException("Reponse HTTP invalide : ligne d'en-tete trop longue");
            }
            sb.append((char) b);
        }
        throw new IOException("Connexion interrompue pendant la lecture de la reponse HTTP");
    }

    private static void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
            // best effort
        }
    }

    /** Limite la taille lue pour eviter l'epuisement memoire (messages identiques a l'historique). */
    private static final class SizeLimitedInputStream extends FilterInputStream {
        private long bytesRead = 0;

        SizeLimitedInputStream(InputStream in) {
            super(in);
        }

        @Override
        public int read() throws IOException {
            if (bytesRead >= MAX_ICAL_RESPONSE_BYTES) {
                throw tooLarge();
            }
            int b = super.read();
            if (b != -1) {
                bytesRead++;
            }
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            if (bytesRead >= MAX_ICAL_RESPONSE_BYTES) {
                throw tooLarge();
            }
            int n = super.read(buf, off, (int) Math.min(len, MAX_ICAL_RESPONSE_BYTES - bytesRead));
            if (n > 0) {
                bytesRead += n;
            }
            return n;
        }

        private static IOException tooLarge() {
            return new IOException("Calendrier iCal trop volumineux (limite: "
                    + MAX_ICAL_RESPONSE_BYTES / 1024 / 1024 + " Mo)");
        }
    }

    /** Ferme la socket sous-jacente quand le flux est ferme. */
    private static final class SocketClosingInputStream extends FilterInputStream {
        private final Socket socket;

        SocketClosingInputStream(InputStream in, Socket socket) {
            super(in);
            this.socket = socket;
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } finally {
                socket.close();
            }
        }
    }

    /** Decodage Transfer-Encoding: chunked (RFC 9112 section 7.1). */
    private static final class ChunkedInputStream extends InputStream {
        private final InputStream in;
        private long remaining = 0;
        private boolean done = false;
        private boolean firstChunk = true;

        ChunkedInputStream(InputStream in) {
            this.in = in;
        }

        @Override
        public int read() throws IOException {
            byte[] one = new byte[1];
            int n = read(one, 0, 1);
            return n == -1 ? -1 : one[0] & 0xFF;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (done) {
                return -1;
            }
            if (remaining == 0) {
                advanceChunk();
                if (done) {
                    return -1;
                }
            }
            int n = in.read(b, off, (int) Math.min(len, remaining));
            if (n == -1) {
                throw new IOException("Flux chunked tronque");
            }
            remaining -= n;
            return n;
        }

        private void advanceChunk() throws IOException {
            if (!firstChunk) {
                String crlf = readLine(in);
                if (!crlf.isEmpty()) {
                    throw new IOException("Encodage chunked invalide");
                }
            }
            firstChunk = false;
            String sizeLine = readLine(in);
            int semi = sizeLine.indexOf(';');
            String hex = (semi >= 0 ? sizeLine.substring(0, semi) : sizeLine).trim();
            long size;
            try {
                size = Long.parseLong(hex, 16);
            } catch (NumberFormatException e) {
                throw new IOException("Taille de chunk invalide");
            }
            if (size == 0) {
                // trailers eventuels puis fin
                while (!readLine(in).isEmpty()) {
                    // skip trailers
                }
                done = true;
                return;
            }
            remaining = size;
        }

        @Override
        public void close() throws IOException {
            in.close();
        }
    }

    /** Borne la lecture a Content-Length octets. */
    private static final class BoundedInputStream extends InputStream {
        private final InputStream in;
        private long remaining;

        BoundedInputStream(InputStream in, long contentLength) {
            this.in = in;
            this.remaining = contentLength;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int b = in.read();
            if (b != -1) {
                remaining--;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int n = in.read(b, off, (int) Math.min(len, remaining));
            if (n > 0) {
                remaining -= n;
            }
            return n;
        }

        @Override
        public void close() throws IOException {
            in.close();
        }
    }
}
