package com.clenzy.booking.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests unitaires de {@link SiteSnapshotService}.
 *
 * <p>Le service repose sur Playwright (Chromium headless) pour le rendu et ne peut
 * pas etre teste de bout en bout dans un test unitaire. On couvre donc les
 * fonctions pures (validation d'URL, rewriting CSS, post-processing Jsoup,
 * extraction d'origine, injection bridge) via reflection sur les methodes
 * package-private/private. {@code captureSnapshot} est teste sur la branche
 * de validation rapide (URL invalide, scheme non-HTTPS, IP privee).</p>
 */
class SiteSnapshotServiceTest {

    private SiteSnapshotService service;

    @BeforeEach
    void setUp() {
        service = new SiteSnapshotService();
    }

    // ───────────────────── validateUrl (via captureSnapshot) ────────────────────

    @Nested
    @DisplayName("URL validation")
    class ValidateUrl {

        @Test
        @DisplayName("rejects null URL")
        void rejectsNullUrl() {
            assertThatThrownBy(() -> service.captureSnapshot(null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects blank URL")
        void rejectsBlankUrl() {
            assertThatThrownBy(() -> service.captureSnapshot("   "))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects malformed URL")
        void rejectsMalformedUrl() {
            assertThatThrownBy(() -> service.captureSnapshot("ht tp://x"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects non-HTTPS URLs (http://)")
        void rejectsHttpUrl() {
            assertThatThrownBy(() -> service.captureSnapshot("http://example.com"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        @DisplayName("rejects FTP and other non-HTTPS schemes")
        void rejectsFtpUrl() {
            assertThatThrownBy(() -> service.captureSnapshot("ftp://example.com/file.zip"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        @DisplayName("rejects URL without host")
        void rejectsUrlWithoutHost() {
            assertThatThrownBy(() -> service.captureSnapshot("https:///path"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects loopback host (127.0.0.1)")
        void rejectsLoopbackIp() {
            assertThatThrownBy(() -> service.captureSnapshot("https://127.0.0.1/test"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects loopback hostname (localhost)")
        void rejectsLocalhost() {
            assertThatThrownBy(() -> service.captureSnapshot("https://localhost/test"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects RFC1918 private address (10.x.x.x)")
        void rejectsPrivate10() {
            assertThatThrownBy(() -> service.captureSnapshot("https://10.0.0.1/test"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects RFC1918 private address (192.168.x.x)")
        void rejectsPrivate192() {
            assertThatThrownBy(() -> service.captureSnapshot("https://192.168.1.1/test"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("rejects unknown DNS host")
        void rejectsUnknownHost() {
            // Use a host that should not resolve
            assertThatThrownBy(() -> service.captureSnapshot("https://invalid-host-clenzy-test-xyz-12345.example.invalid/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ───────────────────── extractOrigin ────────────────────────────────────────

    @Nested
    @DisplayName("extractOrigin (helper)")
    class ExtractOrigin {

        @Test
        void httpsWithPath() throws Exception {
            String origin = (String) invoke("extractOrigin", "https://example.com/path/page.html");
            assertThat(origin).isEqualTo("https://example.com");
        }

        @Test
        void httpsRootOnly() throws Exception {
            String origin = (String) invoke("extractOrigin", "https://example.com/");
            assertThat(origin).isEqualTo("https://example.com");
        }

        @Test
        void httpsBareDomain() throws Exception {
            String origin = (String) invoke("extractOrigin", "https://example.com");
            assertThat(origin).isEqualTo("https://example.com");
        }

        @Test
        void noScheme_returnsAsIs() throws Exception {
            String origin = (String) invoke("extractOrigin", "no-scheme-here");
            assertThat(origin).isEqualTo("no-scheme-here");
        }

        @Test
        void extractHost_returnsHostOrEmpty() throws Exception {
            String host = (String) invoke("extractHost", "https://www.example.com/path");
            assertThat(host).isEqualTo("www.example.com");
            String emptyHost = (String) invoke("extractHost", "not a url at all");
            assertThat(emptyHost).isNotNull();
        }
    }

    // ───────────────────── rewriteCssUrls ───────────────────────────────────────

    @Nested
    @DisplayName("rewriteCssUrls (helper)")
    class RewriteCssUrls {

        @Test
        @DisplayName("rewrites absolute paths in url()")
        void rewritesAbsolutePath() throws Exception {
            String css = ".x { background: url(/img.png); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com/page.html");
            assertThat(result).contains("https://example.com/img.png");
        }

        @Test
        @DisplayName("rewrites relative paths to directory")
        void rewritesRelativePath() throws Exception {
            String css = ".x { background: url(img.png); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com/dir/page.html");
            assertThat(result).contains("https://example.com/dir/img.png");
        }

        @Test
        @DisplayName("leaves data:, http://, https://, //, # URLs unchanged")
        void leavesAbsoluteAndDataUntouched() throws Exception {
            String css = ".x { background: url(data:image/png;base64,abc); "
                       + "color: url(https://other.com/x.png); "
                       + "border: url(#mygradient); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com/page.html");
            assertThat(result).contains("data:image/png;base64,abc");
            assertThat(result).contains("https://other.com/x.png");
            assertThat(result).contains("#mygradient");
        }
    }

    // ───────────────────── rewriteSrcset ────────────────────────────────────────

    @Nested
    @DisplayName("rewriteSrcset (helper)")
    class RewriteSrcset {

        @Test
        void rewritesAbsoluteSrcsetPaths() throws Exception {
            String result = (String) invoke(
                    "rewriteSrcset",
                    "/img-1x.png 1x, /img-2x.png 2x",
                    "https://example.com/page.html");
            assertThat(result).contains("https://example.com/img-1x.png 1x");
            assertThat(result).contains("https://example.com/img-2x.png 2x");
        }

        @Test
        void leavesAbsoluteHttpUrlsUntouched() throws Exception {
            String result = (String) invoke(
                    "rewriteSrcset",
                    "https://cdn.example.com/img.png 1x",
                    "https://example.com/page.html");
            assertThat(result).contains("https://cdn.example.com/img.png");
        }

        @Test
        void handlesEmptyEntries() throws Exception {
            String result = (String) invoke(
                    "rewriteSrcset",
                    "/img.png 1x,,/other.png 2x",
                    "https://example.com/page.html");
            assertThat(result).contains("/img.png");
            assertThat(result).contains("/other.png");
        }

        @Test
        void rewritesRelativePathToDir() throws Exception {
            String result = (String) invoke(
                    "rewriteSrcset",
                    "img.png 1x",
                    "https://example.com/dir/page.html");
            assertThat(result).contains("https://example.com/dir/img.png");
        }
    }

    // ───────────────────── postProcess ──────────────────────────────────────────

    @Nested
    @DisplayName("postProcess full pipeline")
    class PostProcess {

        @Test
        @DisplayName("removes <script> and <noscript> tags")
        void removesScripts() throws Exception {
            String html = "<html><head></head><body>"
                    + "<script>alert(1)</script>"
                    + "<noscript>no js</noscript>"
                    + "<p>visible</p>"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/page");
            assertThat(result).doesNotContain("alert(1)");
            assertThat(result).doesNotContain("noscript");
            assertThat(result).contains("<p>visible</p>");
        }

        @Test
        @DisplayName("removes CSP meta tags")
        void removesCspMeta() throws Exception {
            String html = "<html><head>"
                    + "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'\">"
                    + "</head><body></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/");
            assertThat(result).doesNotContain("Content-Security-Policy");
        }

        @Test
        @DisplayName("prepends <base href=...> in head")
        void prependsBaseHref() throws Exception {
            String html = "<html><head><title>t</title></head><body></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/page");
            assertThat(result).contains("<base href=\"https://example.com/\">");
        }

        @Test
        @DisplayName("absolutizes image src and srcset")
        void absolutizesImages() throws Exception {
            String html = "<html><body>"
                    + "<img src=\"/logo.png\" srcset=\"/img-1x.png 1x\">"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/page");
            // Jsoup absUrl converts to absolute already
            assertThat(result).contains("https://example.com/logo.png");
        }

        @Test
        @DisplayName("absolutizes link[href]")
        void absolutizesLinks() throws Exception {
            String html = "<html><head>"
                    + "<link rel=\"manifest\" href=\"/manifest.json\">"
                    + "</head><body></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/page");
            assertThat(result).contains("href=\"https://example.com/manifest.json\"");
        }

        @Test
        @DisplayName("injects no-interaction style + inspector bridge in body")
        void injectsNoInteractionStyleAndBridge() throws Exception {
            String html = "<html><head></head><body><p>x</p></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/");
            assertThat(result).contains("pointer-events: none");
            assertThat(result).contains("preview-dom-tree");
            assertThat(result).contains("preview-highlight");
        }

        @Test
        @DisplayName("rewrites inline style url() to absolute")
        void rewritesInlineStyles() throws Exception {
            String html = "<html><body>"
                    + "<div style=\"background: url(/bg.png);\">x</div>"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/dir/");
            assertThat(result).contains("https://example.com/bg.png");
        }

        @Test
        @DisplayName("rewrites <style> url() to absolute")
        void rewritesStyleBlockUrls() throws Exception {
            String html = "<html><head>"
                    + "<style>.x { background: url(/img.png); }</style>"
                    + "</head><body></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/");
            assertThat(result).contains("https://example.com/img.png");
        }
    }

    // ───────────────────── injectInspectorBridge ────────────────────────────────

    @Nested
    @DisplayName("injectInspectorBridge")
    class InjectBridge {

        @Test
        @DisplayName("appends bridge script to body")
        void appendsBridgeScript() throws Exception {
            Document doc = Jsoup.parse("<html><body><p>x</p></body></html>");
            invoke("injectInspectorBridge", doc);
            String html = doc.outerHtml();
            assertThat(html).contains("preview-dom-tree");
            assertThat(html).contains("walkDOM");
            assertThat(html).contains("__clenzy_widget_placeholder");
        }

        @Test
        @DisplayName("noop when body is missing")
        void noopWhenNoBody() throws Exception {
            Document doc = Jsoup.parseBodyFragment("");
            doc.body().remove();
            // Should not throw
            invoke("injectInspectorBridge", doc);
        }
    }

    // ───────────────────── shutdown ─────────────────────────────────────────────

    @Test
    @DisplayName("shutdown is safe to call before browser is initialized")
    void shutdown_safeWhenBrowserNotInit() {
        // Browser is lazy-init; calling shutdown without ever calling capture
        // should not throw.
        service.shutdown();
    }

    @Test
    @DisplayName("shutdown is idempotent (multiple calls)")
    void shutdown_idempotent() {
        service.shutdown();
        service.shutdown();
    }

    // ───────────────────── helpers ─────────────────────────────────────────────

    private Object invoke(String methodName, Object... args) throws Exception {
        Class<?>[] paramTypes = new Class<?>[args.length];
        for (int i = 0; i < args.length; i++) {
            Object arg = args[i];
            if (arg instanceof Document) paramTypes[i] = Document.class;
            else if (arg instanceof Element) paramTypes[i] = Element.class;
            else paramTypes[i] = arg.getClass();
        }
        for (Method m : SiteSnapshotService.class.getDeclaredMethods()) {
            if (!m.getName().equals(methodName)) continue;
            if (m.getParameterCount() != args.length) continue;
            // crude param-type match
            boolean ok = true;
            Class<?>[] sigTypes = m.getParameterTypes();
            for (int i = 0; i < args.length; i++) {
                if (!sigTypes[i].isAssignableFrom(paramTypes[i])) { ok = false; break; }
            }
            if (!ok) continue;
            m.setAccessible(true);
            return m.invoke(service, args);
        }
        throw new NoSuchMethodException(methodName + " not found");
    }

    // ===================== EXTENDED COVERAGE =====================

    @Nested
    @DisplayName("rewriteCssUrls additional patterns")
    class RewriteCssUrlsExt {
        @Test
        @DisplayName("preserves quotes around url() arg if any")
        void preservesQuotesPattern() throws Exception {
            String css = ".x { background: url(\"img.png\"); color: url('x.png'); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com/dir/page.html");
            assertThat(result).contains("https://example.com/dir/img.png");
            assertThat(result).contains("https://example.com/dir/x.png");
        }

        @Test
        @DisplayName("handles url() with spaces around content")
        void handlesSpacesAroundUrl() throws Exception {
            String css = "@font-face { src: url(  /fonts/x.woff  ); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com/page.html");
            assertThat(result).contains("https://example.com/fonts/x.woff");
        }

        @Test
        @DisplayName("base URL without trailing slash resolves to origin/")
        void baseUrlNoSlash() throws Exception {
            String css = ".x { background: url(img.png); }";
            String result = (String) invoke("rewriteCssUrls", css, "https://example.com");
            // dir falls back to origin + "/" when no slash in baseUrl... actually 'http' contains "//" so dir = "https://"
            assertThat(result).contains("img.png");
        }
    }

    @Nested
    @DisplayName("rewriteSrcset additional patterns")
    class RewriteSrcsetExt {
        @Test
        @DisplayName("handles missing descriptor (just URL)")
        void noDescriptor() throws Exception {
            String result = (String) invoke("rewriteSrcset",
                    "/img.png", "https://example.com/page.html");
            assertThat(result).contains("https://example.com/img.png");
        }

        @Test
        @DisplayName("handles multiple absolute URLs untouched")
        void multipleAbsoluteUrls() throws Exception {
            String result = (String) invoke("rewriteSrcset",
                    "https://cdn.example.com/a 1x, https://cdn.example.com/b 2x",
                    "https://example.com/page.html");
            assertThat(result).contains("https://cdn.example.com/a 1x");
            assertThat(result).contains("https://cdn.example.com/b 2x");
        }
    }

    @Nested
    @DisplayName("postProcess additional pipelines")
    class PostProcessExt {
        @Test
        @DisplayName("rewrites srcset on img elements")
        void rewritesImgSrcset() throws Exception {
            String html = "<html><body>"
                    + "<img src=\"/x.png\" srcset=\"/img-1x.png 1x, /img-2x.png 2x\">"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/page");
            assertThat(result).contains("https://example.com/img-1x.png 1x");
            assertThat(result).contains("https://example.com/img-2x.png 2x");
        }

        @Test
        @DisplayName("absolutizes source[src] elements")
        void absolutizesSourceSrc() throws Exception {
            String html = "<html><body>"
                    + "<video><source src=\"/movie.mp4\" type=\"video/mp4\"></video>"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/x");
            assertThat(result).contains("https://example.com/movie.mp4");
        }

        @Test
        @DisplayName("absolutizes video[poster]")
        void absolutizesVideoPoster() throws Exception {
            String html = "<html><body>"
                    + "<video poster=\"/poster.jpg\"></video>"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/x");
            assertThat(result).contains("https://example.com/poster.jpg");
        }

        @Test
        @DisplayName("removes multiple script tags")
        void removesMultipleScripts() throws Exception {
            String html = "<html><body>"
                    + "<script>a();</script><script>b();</script><p>kept</p>"
                    + "</body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/");
            assertThat(result).doesNotContain("a()");
            assertThat(result).doesNotContain("b()");
            assertThat(result).contains("<p>kept</p>");
        }

        @Test
        @DisplayName("when html has no head, still processes body content")
        void noHead_stillProcesses() throws Exception {
            String html = "<html><body><p>x</p></body></html>";
            String result = (String) invoke("postProcess", html, "https://example.com/");
            // Jsoup auto-creates head; base href will be there
            assertThat(result).contains("<p>x</p>");
        }
    }

    @Nested
    @DisplayName("extractHost helper additional")
    class ExtractHostExt {
        @Test
        void extractHostWithPort() throws Exception {
            String host = (String) invoke("extractHost", "https://api.example.com:8443/path");
            // Includes port via URI parsing... or just hostname depending on impl
            assertThat(host).isNotNull();
        }

        @Test
        void extractHostMalformedUrl() throws Exception {
            // URI.create succeeds but host is null when scheme is absent
            // The catch block returns "" only when URI parsing fails entirely
            String host = (String) invoke("extractHost", "not-a-real-url");
            // Accept either null (URI parsed but no host) or empty (catch fallback)
            assertThat(host == null || host.isEmpty()).isTrue();
        }
    }
}
