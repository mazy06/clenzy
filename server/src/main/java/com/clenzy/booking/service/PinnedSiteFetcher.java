package com.clenzy.booking.service;

import com.clenzy.service.ICalUrlValidator;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
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
 * Telechargement HTTPS pour la preview de sites externes (booking engine),
 * avec connexion epinglee sur l'IP validee.
 *
 * <p><b>Anti SSRF / DNS rebinding — Z4A-SEC-02 (TOCTOU)</b> :
 * {@link ICalUrlValidator#validateAndResolve} resout le DNS et verifie que
 * l'adresse est publique ; la connexion TCP est ensuite ouverte
 * <b>directement sur cette InetAddress validee</b> (meme pattern que
 * {@code ICalFeedDownloader}, fix iCal vague 2). Aucune re-resolution DNS
 * n'a lieu au moment de la requete : un attaquant ne peut pas faire pointer
 * le hostname vers une IP privee entre la validation et la connexion.
 * Le SNI et la verification du certificat TLS restent faits contre le
 * hostname d'origine.</p>
 *
 * <p><b>Surface reduite (Z4A-SEC-03)</b> : HTTPS uniquement, port 443
 * uniquement, redirections NON suivies (toute reponse non-200 est rejetee,
 * 3xx compris), taille de reponse plafonnee.</p>
 */
@Component
public class PinnedSiteFetcher {

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 20_000;
    private static final int MAX_HEADER_LINES = 100;
    private static final int MAX_LINE_LENGTH = 8 * 1024;
    private static final int HTTPS_DEFAULT_PORT = 443;

    /** Reponse proxifiee : content-type d'origine + corps borne en taille. */
    public record FetchedResource(String contentType, byte[] body) {}

    /**
     * Valide l'URL (SSRF + port 443 uniquement) et resout le DNS.
     * Expose pour les pre-flights des controllers (erreur 400 precoce).
     *
     * @return l'InetAddress epinglee a utiliser pour la connexion
     * @throws IllegalArgumentException si l'URL est invalide ou interdite
     */
    public static InetAddress validatePublicHttpsUrl(String url) {
        URI uri;
        try {
            uri = URI.create(url == null ? "" : url.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("URL invalide : " + e.getMessage());
        }
        int port = uri.getPort();
        if (port != -1 && port != HTTPS_DEFAULT_PORT) {
            throw new IllegalArgumentException(
                "Seul le port HTTPS par defaut (443) est autorise pour la preview");
        }
        return ICalUrlValidator.validateAndResolve(url);
    }

    /**
     * Valide, resout, puis telecharge {@code url} en se connectant a l'IP
     * epinglee. La reponse est entierement bufferisee et bornee a
     * {@code maxBytes}.
     *
     * @throws IllegalArgumentException si l'URL est invalide ou interdite (SSRF)
     * @throws IOException erreur reseau, reponse non-200 ou corps trop volumineux
     */
    public FetchedResource fetch(String url, long maxBytes) throws IOException {
        InetAddress pinnedAddress = validatePublicHttpsUrl(url);
        URI uri = URI.create(url.trim());
        Socket socket = openPinnedTlsSocket(uri, pinnedAddress);
        try (socket) {
            writeGetRequest(socket.getOutputStream(), uri);
            return readResponse(new BufferedInputStream(socket.getInputStream()), maxBytes);
        }
    }

    /**
     * Connexion TLS dont le TCP cible l'IP epinglee mais dont le handshake
     * (SNI + certificat) est fait contre le hostname d'origine.
     * Package-private pour permettre aux tests de court-circuiter le reseau.
     */
    Socket openPinnedTlsSocket(URI uri, InetAddress pinnedAddress) throws IOException {
        String host = uri.getHost();
        Socket raw = new Socket();
        try {
            raw.connect(new InetSocketAddress(pinnedAddress, HTTPS_DEFAULT_PORT), CONNECT_TIMEOUT_MS);
            raw.setSoTimeout(READ_TIMEOUT_MS);
            SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
            SSLSocket ssl = (SSLSocket) factory.createSocket(raw, host, HTTPS_DEFAULT_PORT, true);
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
        String request = "GET " + target + " HTTP/1.1\r\n"
                + "Host: " + uri.getHost() + "\r\n"
                + "User-Agent: Clenzy-Preview/1.0\r\n"
                + "Accept: */*\r\n"
                + "Accept-Encoding: identity\r\n"
                + "Connection: close\r\n"
                + "\r\n";
        out.write(request.getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    /**
     * Parse la status line et les en-tetes puis lit le corps (chunked,
     * Content-Length ou jusqu'a EOF). Toute reponse non-200 — redirections
     * 3xx comprises — est rejetee (pas de follow vers une cible interne).
     * Package-private static pour etre testable sans socket.
     */
    static FetchedResource readResponse(InputStream in, long maxBytes) throws IOException {
        int statusCode = readStatusCode(in);
        boolean chunked = false;
        long contentLength = -1;
        String contentType = null;
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
            switch (name) {
                case "transfer-encoding" -> chunked = value.toLowerCase(Locale.ROOT).contains("chunked");
                case "content-length" -> contentLength = parseContentLength(value);
                case "content-type" -> contentType = value;
                default -> { /* en-tete ignore */ }
            }
        }
        if (statusCode != 200) {
            throw new IOException("Erreur HTTP " + statusCode + " lors du chargement du site");
        }
        if (contentLength > maxBytes) {
            throw new IOException("Reponse trop volumineuse (limite: " + maxBytes + " octets)");
        }
        byte[] body = chunked
                ? readChunkedBody(in, maxBytes)
                : readPlainBody(in, contentLength, maxBytes);
        return new FetchedResource(contentType, body);
    }

    private static byte[] readPlainBody(InputStream in, long contentLength, long maxBytes) throws IOException {
        long limit = contentLength >= 0 ? Math.min(contentLength, maxBytes) : maxBytes;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        long total = 0;
        int n;
        while ((n = in.read(buf, 0, (int) Math.min(buf.length, limit - total + 1))) != -1) {
            total += n;
            if (total > maxBytes) {
                throw new IOException("Reponse trop volumineuse (limite: " + maxBytes + " octets)");
            }
            out.write(buf, 0, n);
            if (contentLength >= 0 && total >= contentLength) {
                break;
            }
        }
        return out.toByteArray();
    }

    private static byte[] readChunkedBody(InputStream in, long maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        long total = 0;
        boolean firstChunk = true;
        while (true) {
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
            final long size;
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
                return out.toByteArray();
            }
            total += size;
            if (total > maxBytes) {
                throw new IOException("Reponse trop volumineuse (limite: " + maxBytes + " octets)");
            }
            byte[] chunk = in.readNBytes((int) size);
            if (chunk.length < size) {
                throw new IOException("Flux chunked tronque");
            }
            out.write(chunk);
        }
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
}
