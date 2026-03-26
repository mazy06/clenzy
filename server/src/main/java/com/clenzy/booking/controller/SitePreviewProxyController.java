package com.clenzy.booking.controller;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import com.clenzy.booking.service.SiteSnapshotService;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * Full reverse proxy for previewing external sites in the booking engine iframe.
 *
 * Endpoints:
 * - GET /api/public/preview-proxy/site/{encodedUrl}  → proxies the HTML page (SPA-compatible via iframe src)
 * - GET /api/public/preview-proxy/asset?url=...       → proxies any asset (CSS, JS, images, fonts)
 * - GET /api/public/preview-proxy?url=...             → legacy HTML proxy (kept for backward compat)
 *
 * The /site/ endpoint is designed for use with <iframe src="...">, which allows
 * SPAs to function correctly (window.location.pathname = "/api/public/preview-proxy/site/...").
 * The HTML is rewritten so all assets are routed through the /asset proxy.
 */
@RestController
@RequestMapping("/api/public/preview-proxy")
public class SitePreviewProxyController {

    private static final Logger log = LoggerFactory.getLogger(SitePreviewProxyController.class);
    private final RestTemplate restTemplate;
    private final SiteSnapshotService snapshotService;

    public SitePreviewProxyController(SiteSnapshotService snapshotService) {
        this.restTemplate = new RestTemplate();
        this.snapshotService = snapshotService;
    }

    /**
     * Filter to strip X-Frame-Options header on proxy responses.
     */
    @Bean
    public FilterRegistrationBean<Filter> previewProxyFrameOptionsFilter() {
        FilterRegistrationBean<Filter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletResponseWrapper wrapper = new HttpServletResponseWrapper((HttpServletResponse) response) {
                    @Override
                    public void setHeader(String name, String value) {
                        if ("X-Frame-Options".equalsIgnoreCase(name)) return;
                        super.setHeader(name, value);
                    }
                    @Override
                    public void addHeader(String name, String value) {
                        if ("X-Frame-Options".equalsIgnoreCase(name)) return;
                        super.addHeader(name, value);
                    }
                };
                chain.doFilter(request, wrapper);
            }
        });
        reg.addUrlPatterns("/api/public/preview-proxy", "/api/public/preview-proxy/*");
        reg.setOrder(Integer.MAX_VALUE);
        return reg;
    }

    // ─── Site proxy (iframe src compatible) ────────────────────────────────────

    /**
     * Proxy the HTML page for iframe src embedding.
     * URL format: /api/public/preview-proxy/site?url=https://example.com
     *
     * This endpoint injects a script shim that patches the SPA router
     * to work inside the proxy context (overrides history API and location properties).
     */
    @GetMapping("/site")
    public ResponseEntity<byte[]> proxySite(@RequestParam String url) {
        url = normalizeUrl(url);
        if (url == null) {
            return ResponseEntity.badRequest().body("Invalid URL".getBytes(StandardCharsets.UTF_8));
        }

        try {
            validateUrl(url);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    URI.create(url), HttpMethod.GET, null, byte[].class);
            byte[] body = response.getBody();
            HttpHeaders headers = buildHeaders(response);

            if (body != null && isHtml(headers)) {
                String html = new String(body, StandardCharsets.UTF_8);
                html = rewriteHtml(html, url);
                body = html.getBytes(StandardCharsets.UTF_8);
            }

            return ResponseEntity.ok().headers(headers).body(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("Preview proxy failed for {}: {}", url, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(("Failed to load site: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    // ─── Snapshot endpoint (self-contained HTML) ────────────────────────────────

    /**
     * Capture a static snapshot of the website.
     * Returns a self-contained HTML string with inlined CSS, absolute image URLs,
     * and no JavaScript. Designed for use with {@code <iframe srcdoc="...">}.
     */
    @GetMapping("/snapshot")
    public ResponseEntity<String> snapshotSite(@RequestParam String url) {
        url = normalizeUrl(url);
        if (url == null) {
            return ResponseEntity.badRequest().body("Invalid URL");
        }

        try {
            String html = snapshotService.captureSnapshot(url);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(10)))
                    .body(html);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.warn("Snapshot failed for {}: {}", url, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Failed to capture site: " + e.getMessage());
        }
    }

    // ─── Legacy page proxy (query param) ──────────────────────────────────────

    /**
     * Legacy proxy endpoint (kept for backward compatibility).
     */
    @GetMapping
    public ResponseEntity<byte[]> proxyPage(@RequestParam String url) {
        url = normalizeUrl(url);
        if (url == null) {
            return ResponseEntity.badRequest().body("Invalid URL".getBytes(StandardCharsets.UTF_8));
        }

        try {
            validateUrl(url);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    URI.create(url), HttpMethod.GET, null, byte[].class);
            byte[] body = response.getBody();
            HttpHeaders headers = buildHeaders(response);

            if (body != null && isHtml(headers)) {
                String html = new String(body, StandardCharsets.UTF_8);
                html = rewriteHtml(html, url);
                body = html.getBytes(StandardCharsets.UTF_8);
            }

            return ResponseEntity.ok().headers(headers).body(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("Preview proxy failed for {}: {}", url, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(("Failed to load site: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    // ─── Asset proxy ──────────────────────────────────────────────────────────

    /**
     * Proxy any asset (CSS, JS, images, fonts) from the target site.
     */
    @GetMapping("/asset")
    public ResponseEntity<byte[]> proxyAsset(@RequestParam String url) {
        url = normalizeUrl(url);
        if (url == null) {
            return ResponseEntity.badRequest().body("Invalid URL".getBytes(StandardCharsets.UTF_8));
        }

        try {
            validateUrl(url);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    URI.create(url), HttpMethod.GET, null, byte[].class);
            HttpHeaders headers = buildHeaders(response);

            byte[] body = response.getBody();
            if (body != null && isCss(headers)) {
                String css = new String(body, StandardCharsets.UTF_8);
                String origin = extractOrigin(url);
                String assetBase = getServerBase() + "/api/public/preview-proxy/asset?url=";
                css = css.replaceAll("url\\(\\s*['\"]?/([^'\"\\)]+)['\"]?\\s*\\)",
                        "url(" + assetBase + origin + "/$1)");
                body = css.getBytes(StandardCharsets.UTF_8);
            }

            headers.setCacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)));
            return ResponseEntity.ok().headers(headers).body(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.debug("Asset proxy failed for {}: {}", url, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(new byte[0]);
        }
    }

    // ─── HTML rewriting ───────────────────────────────────────────────────────

    private String rewriteHtml(String html, String url) {
        String origin = extractOrigin(url);
        String assetBase = getServerBase() + "/api/public/preview-proxy/asset?url=";

        // Rewrite absolute URLs pointing to the target site
        html = html.replace("href=\"" + origin + "/", "href=\"" + assetBase + origin + "/");
        html = html.replace("src=\"" + origin + "/", "src=\"" + assetBase + origin + "/");
        html = html.replace("href='" + origin + "/", "href='" + assetBase + origin + "/");
        html = html.replace("src='" + origin + "/", "src='" + assetBase + origin + "/");

        // Rewrite root-relative URLs (/assets/...) → proxy
        html = html.replace("href=\"/", "href=\"" + assetBase + origin + "/");
        html = html.replace("src=\"/", "src=\"" + assetBase + origin + "/");
        html = html.replace("href='/", "href='" + assetBase + origin + "/");
        html = html.replace("src='/", "src='" + assetBase + origin + "/");

        // Inject SPA shim — navigate to "/" so the router matches the home route
        String shimScript = "<script>"
                + "(function(){"
                + "history.replaceState(null,'','/');"
                + "var origPush=history.pushState,origReplace=history.replaceState;"
                + "history.pushState=function(s,t,u){try{origPush.call(this,s,t,u)}catch(e){}};"
                + "history.replaceState=function(s,t,u){try{origReplace.call(this,s,t,u)}catch(e){}};"
                + "window.__PREVIEW_MODE__=true;"
                + "})();"
                + "</script>"
                // Force html/body/root to take full height — SPAs often collapse without this
                + "<style>html,body,#root{min-height:100vh!important;height:auto!important;}</style>";
        html = html.replace("<head>", "<head>" + shimScript);

        // Inject DOM inspector bridge — sends DOM tree + hover/click events to parent via postMessage
        String inspectorScript = "<script>"
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
                // Highlight hovered element
                + "var hlEl=null;"
                + "var hlDiv=document.createElement('div');"
                + "hlDiv.style.cssText='position:fixed;pointer-events:none;border:2px solid #635BFF;background:rgba(99,91,255,0.08);z-index:99999;display:none;transition:all 0.08s ease;border-radius:2px';"
                + "document.addEventListener('DOMContentLoaded',function(){"
                +   "document.body.appendChild(hlDiv);"
                +   "setTimeout(sendTree,1000);"
                +   "new MutationObserver(function(){setTimeout(sendTree,500)}).observe(document.body,{childList:true,subtree:true});"
                + "});"
                // Listen for parent messages
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
                + "});"
                // Report clicks to parent
                + "document.addEventListener('click',function(e){"
                +   "if(!window.__INSPECT_MODE__)return;"
                +   "e.preventDefault();e.stopPropagation();"
                +   "var el=e.target;var tag=el.tagName?el.tagName.toLowerCase():'';"
                +   "var selector=tag;"
                +   "if(el.id)selector+='#'+el.id;"
                +   "else if(el.className&&typeof el.className==='string')selector+='.'+el.className.trim().split(/\\s+/).slice(0,2).join('.');"
                +   "parent.postMessage({type:'preview-element-clicked',selector:selector,tag:tag,id:el.id||'',cls:el.className||''},'*');"
                + "},true);"
                // Toggle inspect mode from parent
                + "window.addEventListener('message',function(e){"
                +   "if(e.data&&e.data.type==='preview-set-inspect')window.__INSPECT_MODE__=e.data.enabled;"
                + "});"
                + "})();"
                + "</script>";
        html = html.replace("</body>", inspectorScript + "</body>");

        return html;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String getServerBase() {
        String envUrl = System.getenv("CLENZY_API_URL");
        return envUrl != null ? envUrl : "http://localhost:8084";
    }

    private String normalizeUrl(String url) {
        if (url == null || url.isBlank()) return null;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        if (url.startsWith("http://")) {
            url = "https://" + url.substring(7);
        }
        return url;
    }

    private void validateUrl(String url) {
        URI uri = URI.create(url);
        String host = uri.getHost();
        if (host == null || host.equals("localhost") || host.startsWith("127.")
                || host.startsWith("10.") || host.startsWith("192.168.")
                || host.startsWith("172.16.") || host.endsWith(".local")) {
            throw new IllegalArgumentException("Private/internal URLs are not allowed");
        }
    }

    private String extractOrigin(String url) {
        int idx = url.indexOf("//");
        if (idx < 0) return url;
        int slashIdx = url.indexOf('/', idx + 2);
        return slashIdx > 0 ? url.substring(0, slashIdx) : url;
    }

    private String extractHost(String url) {
        URI uri = URI.create(url);
        int port = uri.getPort();
        return port > 0 ? uri.getHost() + ":" + port : uri.getHost();
    }

    private String extractHostname(String url) {
        return URI.create(url).getHost();
    }

    private HttpHeaders buildHeaders(ResponseEntity<byte[]> response) {
        HttpHeaders headers = new HttpHeaders();
        if (response.getHeaders().getContentType() != null) {
            headers.setContentType(response.getHeaders().getContentType());
        }
        headers.set("Content-Security-Policy", "frame-ancestors *");
        return headers;
    }

    private boolean isHtml(HttpHeaders headers) {
        MediaType ct = headers.getContentType();
        return ct != null && ct.toString().contains("text/html");
    }

    private boolean isCss(HttpHeaders headers) {
        MediaType ct = headers.getContentType();
        return ct != null && ct.toString().contains("text/css");
    }
}
