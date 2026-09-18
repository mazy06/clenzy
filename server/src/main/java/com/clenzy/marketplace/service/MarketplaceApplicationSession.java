package com.clenzy.marketplace.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import java.time.Duration;
import java.util.Arrays;

/** Le navigateur conserve le secret ; le code client ne manipule que « session ». */
public final class MarketplaceApplicationSession {
    public static final String COOKIE = "baitly_application";
    private MarketplaceApplicationSession() {}

    public static String cookie(String token) {
        return ResponseCookie.from(COOKIE, token).httpOnly(true).secure(true).sameSite("None")
                .path("/api/public/marketplace/applications")
                .maxAge(token.isEmpty() ? Duration.ZERO : Duration.ofDays(30)).build().toString();
    }

    public static void requireBrowserRequest(HttpServletRequest request) {
        // Cet en-tête impose un preflight CORS, limité aux origines autorisées du PMS.
        if (!"BaitlyApplication".equals(request.getHeader("X-Requested-With")))
            throw new MarketplaceApplicationDocumentService.InvalidUploadTokenException();
    }

    public static String resolve(String reference, HttpServletRequest request) {
        requireBrowserRequest(request);
        if (!"session".equals(reference) || request.getCookies() == null)
            throw new MarketplaceApplicationDocumentService.InvalidUploadTokenException();
        return Arrays.stream(request.getCookies()).filter(cookie -> COOKIE.equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue).filter(value -> value != null && !value.isBlank())
                .findFirst().orElseThrow(MarketplaceApplicationDocumentService.InvalidUploadTokenException::new);
    }
}
