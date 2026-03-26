package com.clenzy.booking.service;

import com.microsoft.playwright.*;
import jakarta.annotation.PreDestroy;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.List;
import java.util.concurrent.Semaphore;

/**
 * Captures a self-contained static snapshot of any website (including SPAs).
 * Uses Playwright (headless Chromium) to render the page with full JS execution,
 * then post-processes the DOM with Jsoup to produce a static, self-contained HTML.
 *
 * Features:
 * - Full SPA support (JS executes in headless Chromium)
 * - CSS inlined in the rendered DOM (already applied by the browser)
 * - Images converted to absolute URLs
 * - All scripts stripped (static preview only)
 * - Inspector bridge injected for DOM tree communication
 * - Redis-cached for 10 minutes
 * - Semaphore-limited concurrency (max 3 pages)
 */
@Service
public class SiteSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(SiteSnapshotService.class);

    @Value("${clenzy.snapshot.timeout-ms:30000}")
    private int timeoutMs;

    private volatile Playwright playwright;
    private volatile Browser browser;
    private final Object browserLock = new Object();
    private final Semaphore pageSemaphore = new Semaphore(3);

    /**
     * Lazy-init the browser singleton (thread-safe).
     */
    private Browser getBrowser() {
        if (browser == null) {
            synchronized (browserLock) {
                if (browser == null) {
                    playwright = Playwright.create();
                    browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
                            .setHeadless(true)
                            .setArgs(List.of(
                                    "--no-sandbox",
                                    "--disable-setuid-sandbox",
                                    "--disable-dev-shm-usage",
                                    "--disable-gpu"
                            )));
                    log.info("Playwright Chromium browser launched");
                }
            }
        }
        return browser;
    }

    @PreDestroy
    public void shutdown() {
        synchronized (browserLock) {
            if (browser != null) {
                browser.close();
                browser = null;
            }
            if (playwright != null) {
                playwright.close();
                playwright = null;
            }
            log.info("Playwright browser closed");
        }
    }

    /**
     * Capture a static HTML snapshot of the given URL.
     * Renders the page with Chromium, waits for network idle,
     * then post-processes the HTML to be self-contained.
     *
     * @param url HTTPS URL of the website to snapshot
     * @return self-contained HTML string
     */
    @Cacheable(value = "site-snapshots", key = "#url")
    public String captureSnapshot(String url) {
        validateUrl(url);

        log.info("Capturing snapshot with Playwright: {}", url);

        try {
            pageSemaphore.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while waiting for browser slot", e);
        }

        try {
            String rawHtml = renderPage(url);
            String processedHtml = postProcess(rawHtml, url);

            log.info("Snapshot captured: {}KB for {}", processedHtml.length() / 1024, url);
            return processedHtml;

        } finally {
            pageSemaphore.release();
        }
    }

    // ─── Playwright rendering ────────────────────────────────────────────

    private String renderPage(String url) {
        Browser browser = getBrowser();
        BrowserContext context = null;
        Page page = null;

        try {
            context = browser.newContext(new Browser.NewContextOptions()
                    .setViewportSize(1280, 900)
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));
            page = context.newPage();

            // Navigate — use LOAD first (faster than networkidle, always fires)
            page.navigate(url, new Page.NavigateOptions()
                    .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.LOAD)
                    .setTimeout(timeoutMs));

            // Wait for SPA rendering: body must have meaningful content
            // SPAs populate <div id="root"> or <div id="app"> after JS executes
            try {
                page.waitForFunction(
                        "() => {"
                        + "  const body = document.body;"
                        + "  if (!body) return false;"
                        + "  // Check for common SPA root containers with children"
                        + "  const root = document.getElementById('root') || document.getElementById('app') || document.getElementById('__next');"
                        + "  if (root && root.children.length > 0) return true;"
                        + "  // Fallback: body has enough content (not just a shell)"
                        + "  return body.querySelectorAll('section, article, main, header, h1, h2, p').length >= 3;"
                        + "}",
                        new Page.WaitForFunctionOptions().setTimeout(timeoutMs)
                );
            } catch (PlaywrightException e) {
                log.debug("SPA wait heuristic timed out for {}, capturing as-is", url);
            }

            // Extra wait for lazy-loaded images and animations
            page.waitForTimeout(2000);

            // Capture the fully rendered DOM
            return page.content();

        } catch (PlaywrightException e) {
            log.warn("Playwright rendering failed for {}: {}", url, e.getMessage());
            throw new RuntimeException("Page rendering failed: " + e.getMessage(), e);
        } finally {
            if (page != null) page.close();
            if (context != null) context.close();
        }
    }

    // ─── Jsoup post-processing ───────────────────────────────────────────

    private String postProcess(String rawHtml, String url) {
        String origin = extractOrigin(url);
        Document doc = Jsoup.parse(rawHtml, url);

        // 1. Remove all scripts (static preview, no JS needed)
        doc.select("script").remove();
        doc.select("noscript").remove();

        // 2. Remove CSP meta tags
        doc.select("meta[http-equiv=Content-Security-Policy]").remove();

        // 3. Inline linked stylesheets (avoid CORS in srcdoc iframe)
        inlineStylesheets(doc, origin);

        // 4. Absolutize image URLs
        for (Element img : doc.select("img[src]")) {
            String absUrl = img.absUrl("src");
            if (!absUrl.isEmpty()) img.attr("src", absUrl);
        }
        for (Element el : doc.select("[srcset]")) {
            String srcset = el.attr("srcset");
            if (!srcset.isEmpty()) el.attr("srcset", rewriteSrcset(srcset, url));
        }
        for (Element el : doc.select("source[src]")) {
            String absUrl = el.absUrl("src");
            if (!absUrl.isEmpty()) el.attr("src", absUrl);
        }
        for (Element el : doc.select("video[poster]")) {
            String absUrl = el.absUrl("poster");
            if (!absUrl.isEmpty()) el.attr("poster", absUrl);
        }

        // 4. Absolutize CSS url() in inline styles
        for (Element el : doc.select("[style*=url]")) {
            String style = el.attr("style");
            el.attr("style", rewriteCssUrls(style, url));
        }
        for (Element style : doc.select("style")) {
            String css = style.data();
            if (css.contains("url(")) {
                style.html(rewriteCssUrls(css, url));
            }
        }

        // 5. Absolutize remaining link hrefs
        for (Element link : doc.select("link[href]")) {
            String absUrl = link.absUrl("href");
            if (!absUrl.isEmpty()) link.attr("href", absUrl);
        }

        // 6. Add base href
        Element head = doc.head();
        if (head != null) {
            head.prepend("<base href=\"" + origin + "/\">");
        }

        // 7. Inject no-interaction style + min-height fix
        if (head != null) {
            head.append("<style>"
                    + "* { pointer-events: none !important; cursor: default !important; }"
                    + "a { text-decoration: inherit !important; }"
                    + "html, body { min-height: 100vh !important; height: auto !important; }"
                    + "</style>");
        }

        // 8. Inject inspector bridge
        injectInspectorBridge(doc);

        return doc.outerHtml();
    }

    // ─── CSS Inlining ────────────────────────────────────────────────────

    private static final int MAX_STYLESHEETS = 10;
    private static final int STYLESHEET_TIMEOUT_MS = 5_000;
    private static final int STYLESHEET_MAX_SIZE_KB = 500;

    private void inlineStylesheets(Document doc, String origin) {
        Elements linkElements = doc.select("link[rel=stylesheet]");
        int fetchedCount = 0;

        for (Element link : linkElements) {
            if (fetchedCount >= MAX_STYLESHEETS) {
                link.remove();
                continue;
            }

            String href = link.absUrl("href");
            if (href.isEmpty()) { link.remove(); continue; }

            try {
                String cssText = Jsoup.connect(href)
                        .userAgent("Mozilla/5.0 (compatible; ClenzyBot/1.0)")
                        .timeout(STYLESHEET_TIMEOUT_MS)
                        .maxBodySize(STYLESHEET_MAX_SIZE_KB * 1024)
                        .ignoreContentType(true)
                        .execute()
                        .body();

                cssText = rewriteCssUrls(cssText, href);
                link.after("<style>/* inlined: " + extractHost(href) + " */\n" + cssText + "</style>");
                link.remove();
                fetchedCount++;
            } catch (Exception e) {
                log.debug("Failed to inline stylesheet {}: {}", href, e.getMessage());
                link.remove(); // Remove to avoid CORS error in srcdoc
            }
        }

        // Rewrite url() in existing inline <style> blocks
        for (Element style : doc.select("style")) {
            String cssData = style.data();
            if (cssData.contains("url(")) {
                style.html(rewriteCssUrls(cssData, doc.baseUri()));
            }
        }
    }

    private String extractHost(String url) {
        try { return new java.net.URI(url).getHost(); }
        catch (Exception e) { return ""; }
    }

    // ─── CSS URL rewriting ───────────────────────────────────────────────

    private String rewriteCssUrls(String css, String baseUrl) {
        String origin = extractOrigin(baseUrl);
        String dir = baseUrl.contains("/")
                ? baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)
                : origin + "/";

        css = css.replaceAll(
                "url\\(\\s*['\"]?/([^'\"\\)]+)['\"]?\\s*\\)",
                "url(" + origin + "/$1)");
        css = css.replaceAll(
                "url\\(\\s*['\"]?(?!https?://|data:|#|//)([^'\"\\)]+)['\"]?\\s*\\)",
                "url(" + dir + "$1)");
        return css;
    }

    private String rewriteSrcset(String srcset, String baseUrl) {
        String origin = extractOrigin(baseUrl);
        StringBuilder result = new StringBuilder();
        for (String entry : srcset.split(",")) {
            entry = entry.trim();
            if (entry.isEmpty()) continue;
            String[] parts = entry.split("\\s+", 2);
            String src = parts[0];
            String descriptor = parts.length > 1 ? " " + parts[1] : "";
            if (src.startsWith("/")) src = origin + src;
            else if (!src.startsWith("http")) {
                String dir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                src = dir + src;
            }
            if (result.length() > 0) result.append(", ");
            result.append(src).append(descriptor);
        }
        return result.toString();
    }

    // ─── Inspector Bridge ────────────────────────────────────────────────

    private void injectInspectorBridge(Document doc) {
        Element body = doc.body();
        if (body == null) return;

        body.append("<script>"
                + "(function(){"
                + "function walkDOM(el,depth){"
                +   "if(depth>4||!el)return null;"
                +   "var tag=el.tagName?el.tagName.toLowerCase():'';"
                +   "if(!tag||tag==='script'||tag==='style'||tag==='link'||tag==='meta')return null;"
                +   "var node={tag:tag,id:el.id||'',cls:(el.className&&typeof el.className==='string')?el.className.split(' ').filter(function(c){return c}).slice(0,3).join(' '):''"
                +     ",text:(!el.children||el.children.length===0)?(el.textContent||'').trim().substring(0,40):''"
                +     ",rect:null,children:[]};"
                +   "try{var r=el.getBoundingClientRect();node.rect={t:Math.round(r.top),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)};}catch(e){}"
                +   "for(var i=0;i<el.children.length;i++){"
                +     "var c=walkDOM(el.children[i],depth+1);"
                +     "if(c)node.children.push(c);"
                +   "}"
                +   "return node;"
                + "}"
                + "function sendTree(){"
                +   "var body=document.body;"
                +   "if(!body)return;"
                +   "var tree=walkDOM(body,0);"
                +   "if(tree)parent.postMessage({type:'preview-dom-tree',tree:tree},'*');"
                + "}"
                + "var hlDiv=document.createElement('div');"
                + "hlDiv.style.cssText='position:fixed;pointer-events:auto;border:2px solid #635BFF;background:rgba(99,91,255,0.08);z-index:99999;display:none;transition:all 0.08s ease;border-radius:2px';"
                + "document.addEventListener('DOMContentLoaded',function(){"
                +   "document.body.appendChild(hlDiv);"
                +   "setTimeout(sendTree,500);"
                + "});"
                + "if(document.readyState!=='loading'){document.body.appendChild(hlDiv);setTimeout(sendTree,200);}"
                // Inline widget placeholder
                + "var phDiv=document.createElement('div');"
                + "phDiv.id='__clenzy_widget_placeholder';"
                + "phDiv.style.cssText='pointer-events:auto!important;min-height:80px;width:100%;background:rgba(99,91,255,0.05);border:2px dashed rgba(99,91,255,0.3);border-radius:8px;box-sizing:border-box;transition:all 0.3s ease;display:none';"
                + "function reportPlaceholderRect(){"
                +   "if(phDiv.style.display==='none'){parent.postMessage({type:'preview-placeholder-rect',rect:null},'*');return;}"
                +   "var r=phDiv.getBoundingClientRect();"
                +   "var scrollY=window.pageYOffset||document.documentElement.scrollTop;"
                +   "var scrollX=window.pageXOffset||document.documentElement.scrollLeft;"
                +   "parent.postMessage({type:'preview-placeholder-rect',rect:{top:Math.round(r.top+scrollY),left:Math.round(r.left+scrollX),width:Math.round(r.width),height:Math.round(r.height)}},'*');"
                + "}"
                + "window.addEventListener('message',function(e){"
                +   "if(!e.data||!e.data.type)return;"
                +   "if(e.data.type==='preview-request-tree')sendTree();"
                +   "if(e.data.type==='preview-highlight'){"
                +     "var sel=e.data.selector;"
                +     "try{"
                +       "var target=sel?document.querySelector(sel):null;"
                +       "if(target){"
                +         "var r=target.getBoundingClientRect();"
                +         "hlDiv.style.display='block';hlDiv.style.top=r.top+'px';hlDiv.style.left=r.left+'px';hlDiv.style.width=r.width+'px';hlDiv.style.height=r.height+'px';"
                +       "}else{hlDiv.style.display='none';}"
                +     "}catch(ex){hlDiv.style.display='none';}"
                +   "}"
                +   "if(e.data.type==='preview-set-inline'){"
                +     "var sel=e.data.selector;"
                +     "var placement=e.data.placement||'after';"
                +     "if(!sel){phDiv.style.display='none';if(phDiv.parentNode)phDiv.parentNode.removeChild(phDiv);reportPlaceholderRect();return;}"
                +     "try{"
                +       "var target=document.querySelector(sel);"
                +       "if(target){"
                +         "phDiv.style.display='block';"
                +         "if(placement==='before'){target.parentNode.insertBefore(phDiv,target);}"
                +         "else{target.parentNode.insertBefore(phDiv,target.nextSibling);}"
                +         "setTimeout(reportPlaceholderRect,50);"
                +       "}else{phDiv.style.display='none';reportPlaceholderRect();}"
                +     "}catch(ex){phDiv.style.display='none';reportPlaceholderRect();}"
                +   "}"
                + "});"
                + "})();"
                + "</script>");
    }

    // ─── Validation ──────────────────────────────────────────────────────

    private void validateUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Website URL is required");
        }

        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Invalid URL format: " + url);
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("Only HTTPS URLs are accepted");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("URL must have a valid host");
        }

        try {
            InetAddress address = InetAddress.getByName(host);
            if (address.isLoopbackAddress()
                    || address.isSiteLocalAddress()
                    || address.isLinkLocalAddress()
                    || address.isAnyLocalAddress()) {
                throw new IllegalArgumentException("Internal/private URLs are not allowed");
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("Cannot resolve host: " + host);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private String extractOrigin(String url) {
        int idx = url.indexOf("//");
        if (idx < 0) return url;
        int slashIdx = url.indexOf('/', idx + 2);
        return slashIdx > 0 ? url.substring(0, slashIdx) : url;
    }
}
