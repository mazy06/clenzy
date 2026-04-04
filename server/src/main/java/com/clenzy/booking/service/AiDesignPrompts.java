package com.clenzy.booking.service;

/**
 * Centralise les prompts IA pour l'analyse de design et la generation CSS.
 * Classe utilitaire (pas de bean Spring) — prompts statiques.
 */
public final class AiDesignPrompts {

    private AiDesignPrompts() {}

    // ─── OpenAI GPT-4o : Extraction des design tokens ───────────────────

    public static final String OPENAI_SYSTEM_PROMPT = """
        You are an expert web designer and CSS analyst.
        Your task is to analyze HTML and CSS from a website and extract design tokens.

        Rules:
        - Return ONLY valid JSON matching the exact schema below
        - Use real CSS values: hex colors (#rrggbb), px/rem units, font names
        - Return null for any token you cannot confidently detect
        - For colors, prefer 6-digit hex format (#rrggbb)
        - For fonts, return the first font-family in the stack
        - For shadows, return the full CSS box-shadow value
        - Do NOT guess or invent values — only extract what is clearly present
        - Do NOT include any markdown formatting, code fences, or explanations

        JSON Schema:
        {
          "primaryColor": "#hex or null",
          "secondaryColor": "#hex or null",
          "accentColor": "#hex or null",
          "backgroundColor": "#hex or null",
          "surfaceColor": "#hex or null",
          "textColor": "#hex or null",
          "textSecondaryColor": "#hex or null",
          "headingFontFamily": "font name or null",
          "bodyFontFamily": "font name or null",
          "baseFontSize": "16px or null",
          "headingFontWeight": "700 or null",
          "borderRadius": "4px or null",
          "buttonBorderRadius": "4px or null",
          "cardBorderRadius": "8px or null",
          "spacing": "16px or null",
          "boxShadow": "CSS shadow value or null",
          "cardShadow": "CSS shadow value or null",
          "buttonStyle": "filled|outlined|rounded or null",
          "buttonTextTransform": "uppercase|none|capitalize or null",
          "borderColor": "#hex or null",
          "dividerColor": "#hex or null"
        }
        """;

    public static String buildOpenAiUserPrompt(String html, String css) {
        // Truncate to stay within model context limits (~32K tokens for smaller models)
        // 1 token ≈ 4 chars → 25K chars ≈ 6K tokens per section → ~12K tokens content + system prompt
        String truncatedHtml = truncate(html, 25_000);
        String truncatedCss = truncate(css, 25_000);

        return """
            Analyze the following website HTML and CSS. Extract the design tokens.

            --- HTML ---
            %s

            --- CSS ---
            %s
            """.formatted(truncatedHtml, truncatedCss);
    }

    // ─── Combined: Analyze website + Generate CSS in one call ────────────

    public static final String CSS_FROM_WEBSITE_SYSTEM_PROMPT = """
        You are an expert CSS developer. Analyze the HTML and CSS of a website,
        then generate CSS for an embeddable booking widget that matches the website's design.

        STEP 1: Identify the website's colors, fonts, spacing, border-radius, shadows, button styles.
        STEP 2: Generate CSS with these extracted values as CSS custom properties.

        MANDATORY CSS VARIABLE NAMES (use exactly these, set to the values found on the website):
          --bw-primaryColor, --bw-secondaryColor, --bw-accentColor,
          --bw-backgroundColor, --bw-surfaceColor, --bw-textColor, --bw-textSecondaryColor,
          --bw-headingFontFamily, --bw-bodyFontFamily, --bw-baseFontSize, --bw-headingFontWeight,
          --bw-borderRadius, --bw-buttonBorderRadius, --bw-cardBorderRadius, --bw-spacing,
          --bw-boxShadow, --bw-cardShadow, --bw-buttonStyle, --bw-buttonTextTransform,
          --bw-borderColor, --bw-dividerColor

        Rules:
        - Start with `:root.booking-widget {` containing ALL --bw-* variables with real values from the website
        - Scope ALL selectors under `.booking-widget`
        - Include responsive styles (@media queries)
        - Style: buttons, inputs, cards, headers, text, links, calendar
        - Return ONLY raw CSS — no markdown, no code fences, no explanations
        - If you cannot detect a value, use a sensible default (never use "null" as a CSS value)
        """;

    public static String buildCssFromWebsitePrompt(String html, String css) {
        String truncatedHtml = truncate(html, 25_000);
        String truncatedCss = truncate(css, 25_000);
        return """
            Analyze this website's HTML and CSS, then generate the booking widget CSS.

            --- HTML ---
            %s

            --- CSS ---
            %s
            """.formatted(truncatedHtml, truncatedCss);
    }

    // ─── Anthropic Claude : Generation CSS ──────────────────────────────

    public static final String CLAUDE_SYSTEM_PROMPT = """
        You are an expert CSS developer specializing in embeddable widgets.
        Your task is to generate CSS for a booking widget that visually matches
        the design tokens extracted from a client's website.

        Rules:
        - Scope ALL selectors under `.booking-widget`
        - Use CSS custom properties (--bw-*) for all token values at the :root of .booking-widget
        - Generate clean, readable, well-commented CSS
        - Include responsive styles (@media queries)
        - Style these elements: buttons, inputs, cards, headers, text, links, calendar
        - Return ONLY raw CSS — no markdown, no code fences, no explanations
        - Use modern CSS (flexbox, gap, border-radius, transitions)
        """;

    public static String buildClaudeUserPrompt(String designTokensJson, String additionalInstructions) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate CSS for the booking widget using these design tokens:\n\n");
        sb.append(designTokensJson);

        if (additionalInstructions != null && !additionalInstructions.isBlank()) {
            sb.append("\n\nAdditional instructions from the user:\n");
            sb.append(additionalInstructions);
        }

        return sb.toString();
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private static String truncate(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(0, maxLength) + "\n... [truncated]" : text;
    }
}
