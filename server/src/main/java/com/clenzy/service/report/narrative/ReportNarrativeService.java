package com.clenzy.service.report.narrative;

import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.dto.report.*;
import com.clenzy.service.report.ReportFormats;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fait commenter un rapport par un agent — sous surveillance.
 *
 * <p><b>La regle non negociable : l'agent ne produit JAMAIS un chiffre.</b> Il
 * recoit un snapshot deja calcule et le commente. Tout nombre present dans son
 * texte doit donc se retrouver dans le snapshot ; sinon le commentaire est
 * REJETE en entier et le rapport part sans lui. Un releve financier qui
 * hallucine un montant est pire qu'un releve sans commentaire : il engage
 * l'emetteur sur un chiffre qui n'existe pas.</p>
 *
 * <p>Le rapport reste lisible sans agent : les constats deterministes
 * ({@link ReportNote}) sont calcules par le moteur et ne dependent pas de lui.</p>
 */
@Service
public class ReportNarrativeService {

    private static final Logger log = LoggerFactory.getLogger(ReportNarrativeService.class);

    /**
     * Nombres du texte genere.
     *
     * <p>Capture les formes francaises : « 17 133,00 », « 30,7 », « 1 250 ».
     * Les espaces insecables sont inclus — un formateur francais en pose, et les
     * oublier ferait passer un montant a travers le controle.</p>
     */
    private static final Pattern NUMBER = Pattern.compile("\\d[\\d\\s\\u00A0\\u202F.,]*");

    private static final String SYSTEM = """
            Tu rediges le commentaire d'un rapport de gestion locative destine a un lecteur \
            professionnel mais non specialiste.

            REGLE ABSOLUE : tu ne produis JAMAIS un chiffre qui ne figure pas dans les donnees \
            fournies. Tu ne calcules rien, tu n'extrapoles rien, tu n'arrondis rien differemment. \
            Si tu veux citer une quantite absente des donnees, ecris-la en toutes lettres \
            (« quelques », « la majorite ») ou n'en parle pas. Un commentaire contenant un \
            nombre absent des donnees sera rejete en entier.

            Style : francais, phrases courtes, ton factuel. Pas de superlatif, pas de formule \
            de politesse, pas d'emoji, pas de titre. Tu expliques ce que les chiffres signifient \
            et ce qu'ils appellent comme decision — tu ne les repetes pas tels quels.

            Reponds UNIQUEMENT par un objet JSON valide de la forme :
            {"executiveSummary": "...", "sections": {"<id>": "...", ...}, "risks": ["...", "..."]}

            executiveSummary : 3 a 5 phrases, la lecture d'ensemble de la periode.
            sections : une a trois phrases par section fournie, indexees par son id.
            risks : 0 a 3 points de vigilance, une phrase chacun. Tableau vide si rien ne l'exige.
            """;

    private final AiProviderRouter aiProviderRouter;
    private final ObjectMapper objectMapper;

    public ReportNarrativeService(AiProviderRouter aiProviderRouter, ObjectMapper objectMapper) {
        this.aiProviderRouter = aiProviderRouter;
        this.objectMapper = objectMapper;
    }

    /**
     * Commente un snapshot.
     *
     * <p>Ne leve jamais : un agent indisponible ou un texte rejete rend un
     * commentaire vide, et le rapport reste diffusable. Bloquer la generation
     * d'un releve sur une panne de LLM serait disproportionne.</p>
     */
    public ReportNarrative narrate(ReportSnapshot snapshot, Long orgId) {
        try {
            // Par le routeur et non par un provider en dur : l'organisation peut
            // porter sa propre cle et son propre modele (BYOK).
            final AiResponse response = aiProviderRouter.route(orgId, null, AiFeature.ANALYTICS,
                    AiRequest.json(SYSTEM + toneFor(snapshot.meta().profile()), userPrompt(snapshot)))
                    .response();
            final ReportNarrative narrative = parse(response, snapshot);
            if (narrative.rejected()) {
                log.warn("Commentaire de rapport rejete, le document part sans : {}",
                        narrative.rejectionReason());
            }
            return narrative;
        } catch (Exception e) {
            log.warn("Commentaire de rapport indisponible, le document part sans : {}", e.toString());
            return ReportNarrative.empty();
        }
    }

    // ── Prompt ──────────────────────────────────────────────────────────────

    private String toneFor(ReportProfile profile) {
        return switch (profile) {
            case OWNER -> """

                    Le lecteur est un PROPRIETAIRE : il confie ses biens a un gestionnaire. \
                    Explique ce que les chiffres veulent dire pour lui, sans jargon d'hotellerie. \
                    Ne le flatte pas, et ne minimise pas une mauvaise periode.""";
            case INTERNAL -> """

                    Le lecteur est l'EQUIPE INTERNE. Sois direct et technique, nomme les ecarts \
                    sans les amortir, et signale ce qui demande une action.""";
            case PROSPECT -> """

                    Le lecteur est un PROSPECT : il evalue la qualite de la gestion. Reste \
                    factuel, ne nomme aucun bien ni aucun proprietaire, ne promets rien.""";
        };
    }

    /**
     * Ce que l'agent voit.
     *
     * <p>Le snapshot brut serait long et truffe de details de rendu. On lui donne
     * l'essentiel : les chiffres cles avec leurs deux ecarts, et par section son
     * intitule, ses totaux et ses constats deja calcules.</p>
     */
    private String userPrompt(ReportSnapshot snapshot) {
        final StringBuilder prompt = new StringBuilder();
        final ReportMeta meta = snapshot.meta();
        prompt.append("PERIODE : ").append(meta.periodStart()).append(" au ").append(meta.periodEnd())
                .append("\nPERIMETRE : ").append(meta.scopeLabels().size()).append(" bien(s)\n\n");

        prompt.append("CHIFFRES CLES\n");
        for (ReportKpi kpi : snapshot.kpis()) {
            prompt.append("- ").append(kpi.label()).append(" : ").append(kpi.value());
            if (kpi.deltaPreviousPct() != null) {
                prompt.append(" (periode precedente ")
                        .append(ReportFormats.signedPercent(kpi.deltaPreviousPct())).append(")");
            }
            if (kpi.deltaLastYearPct() != null) {
                prompt.append(" (an dernier ")
                        .append(ReportFormats.signedPercent(kpi.deltaLastYearPct())).append(")");
            }
            prompt.append('\n');
        }

        prompt.append("\nSECTIONS\n");
        for (ReportSection section : snapshot.sections()) {
            if (section.kind() == ReportSectionKind.GLOSSARY || section.kind() == ReportSectionKind.NOTICE) {
                continue;
            }
            prompt.append("id=").append(section.id()).append(" — ").append(section.title()).append('\n');
            if (section.hasTable() && !section.table().totals().isEmpty()) {
                prompt.append("  totaux : ").append(String.join(" | ", section.table().totals())).append('\n');
            }
            for (ReportNote note : section.notes()) {
                prompt.append("  constat : ").append(note.label());
                if (note.detail() != null) {
                    prompt.append(" — ").append(note.detail());
                }
                if (note.impact() != null) {
                    prompt.append(" [").append(note.impact()).append("]");
                }
                prompt.append('\n');
            }
        }
        return prompt.toString();
    }

    // ── Analyse et controle ─────────────────────────────────────────────────

    private ReportNarrative parse(AiResponse response, ReportSnapshot snapshot) {
        final String json = extractJson(response.content());
        if (json == null) {
            return ReportNarrative.rejectedBecause("reponse non JSON", response.model());
        }

        final JsonNode root;
        try {
            root = objectMapper.readTree(json);
        } catch (Exception e) {
            return ReportNarrative.rejectedBecause("JSON illisible", response.model());
        }

        final String summary = text(root.get("executiveSummary"));
        final Map<String, String> comments = new LinkedHashMap<>();
        final JsonNode sections = root.get("sections");
        if (sections != null && sections.isObject()) {
            sections.fields().forEachRemaining(entry -> {
                final String value = text(entry.getValue());
                // Un identifiant de section inconnu est ignore : l'agent ne cree
                // pas de section, il commente celles qu'on lui a soumises.
                if (value != null && snapshot.section(entry.getKey()) != null) {
                    comments.put(entry.getKey(), value);
                }
            });
        }
        final List<String> risks = new ArrayList<>();
        final JsonNode risksNode = root.get("risks");
        if (risksNode != null && risksNode.isArray()) {
            risksNode.forEach(node -> {
                final String value = text(node);
                if (value != null) {
                    risks.add(value);
                }
            });
        }

        final Set<String> allowed = allowedNumbers(snapshot);
        final List<String> invented = new ArrayList<>();
        collectInvented(summary, allowed, invented);
        comments.values().forEach(value -> collectInvented(value, allowed, invented));
        risks.forEach(value -> collectInvented(value, allowed, invented));

        if (!invented.isEmpty()) {
            return ReportNarrative.rejectedBecause("nombres absents des donnees : "
                    + String.join(", ", invented.stream().distinct().limit(5).toList()), response.model());
        }
        return new ReportNarrative(summary, comments, risks, response.model(), false, null);
    }

    /**
     * Tous les nombres que le snapshot autorise a citer.
     *
     * <p>Construit depuis les chaines DEJA FORMATEES du document — ce que le
     * lecteur verra. Un commentaire ne peut donc citer qu'un chiffre visible
     * ailleurs dans le meme document : toute contradiction interne devient
     * impossible.</p>
     */
    private Set<String> allowedNumbers(ReportSnapshot snapshot) {
        final Set<String> allowed = new HashSet<>();
        final ReportMeta meta = snapshot.meta();
        allowed.add(normalize(String.valueOf(meta.scopeLabels().size())));
        addDate(allowed, meta.periodStart());
        addDate(allowed, meta.periodEnd());
        addDate(allowed, meta.lastYearPeriodStart());
        addDate(allowed, meta.lastYearPeriodEnd());

        for (ReportKpi kpi : snapshot.kpis()) {
            harvest(allowed, kpi.value());
            harvest(allowed, ReportFormats.signedPercent(kpi.deltaPreviousPct()));
            harvest(allowed, ReportFormats.signedPercent(kpi.deltaLastYearPct()));
        }
        for (ReportSection section : snapshot.sections()) {
            if (section.table() != null) {
                section.table().rows().forEach(row -> row.forEach(cell -> harvest(allowed, cell)));
                section.table().totals().forEach(cell -> harvest(allowed, cell));
            }
            section.notes().forEach(note -> {
                harvest(allowed, note.label());
                harvest(allowed, note.detail());
                harvest(allowed, note.impact());
            });
            harvest(allowed, section.body());
        }
        return allowed;
    }

    private void addDate(Set<String> allowed, LocalDate date) {
        if (date != null) {
            allowed.add(normalize(String.valueOf(date.getYear())));
            allowed.add(normalize(String.valueOf(date.getMonthValue())));
            allowed.add(normalize(String.valueOf(date.getDayOfMonth())));
        }
    }

    private void harvest(Set<String> allowed, String source) {
        if (source == null) {
            return;
        }
        final Matcher matcher = NUMBER.matcher(source);
        while (matcher.find()) {
            allowed.add(normalize(matcher.group()));
        }
    }

    private void collectInvented(String text, Set<String> allowed, List<String> invented) {
        if (text == null) {
            return;
        }
        final Matcher matcher = NUMBER.matcher(text);
        while (matcher.find()) {
            final String token = normalize(matcher.group());
            if (!token.isEmpty() && !allowed.contains(token)) {
                invented.add(matcher.group().trim());
            }
        }
    }

    /**
     * Forme comparable d'un nombre.
     *
     * <p>Separateurs de milliers et decimales retires, zeros de queue rognes :
     * « 17 133,00 € » et « 17133 » designent le meme montant, et l'un ne doit
     * pas faire rejeter l'autre.</p>
     */
    private String normalize(String raw) {
        String digits = raw.replaceAll("[\\s\\u00A0\\u202F.]", "").replace(',', '.');
        digits = digits.replaceAll("[^0-9.]", "");
        if (digits.contains(".")) {
            digits = digits.replaceAll("0+$", "").replaceAll("\\.$", "");
        }
        return digits.replaceFirst("^0+(?=\\d)", "");
    }

    private String text(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        final String value = node.asText("").trim();
        return value.isEmpty() ? null : value;
    }

    /** Le modele encadre parfois son JSON de texte : on ne garde que l'objet. */
    private String extractJson(String content) {
        if (content == null) {
            return null;
        }
        final int start = content.indexOf('{');
        final int end = content.lastIndexOf('}');
        return start >= 0 && end > start ? content.substring(start, end + 1) : null;
    }
}
