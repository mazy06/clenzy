package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le logo du prestataire arrive-t-il VRAIMENT dans le document rendu ?
 *
 * <p>Le rendu d'images etait le maillon manquant : {@code TagType.IMAGE}
 * existait, les tags etaient detectes au parsing, mais {@code fillTemplate} ne
 * declarait aucun champ image a XDocReport — un tag logo ne produisait rien.
 * Ce test verrouille la chaine complete : cadre nomme dans le .odt, champ
 * declare via {@code FieldsMetadata}, octets injectes.</p>
 */
class DocumentTemplateLogoRenderingTest {

    /** Le nom du cadre dans les .odt, apparie par XDocReport. */
    private static final String LOGO_FIELD = "logo_prestataire";

    private final DocumentTemplateRenderer renderer = new DocumentTemplateRenderer(null);

    /** PNG 4x4 rouge — reconnaissable a l'octet pres dans la sortie. */
    private static byte[] redPng() throws Exception {
        var image = new java.awt.image.BufferedImage(4, 4, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(java.awt.Color.RED);
        g.fillRect(0, 0, 4, 4);
        g.dispose();
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static byte[] templateBytes(String name) throws Exception {
        try (InputStream is = DocumentTemplateLogoRenderingTest.class.getClassLoader()
                .getResourceAsStream("seed/document-templates/" + name)) {
            if (is == null) throw new IllegalStateException("Template introuvable : " + name);
            return is.readAllBytes();
        }
    }

    /** Contenu d'une entree du zip ODT rendu. */
    private static byte[] entry(byte[] odt, String path) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(odt))) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                if (e.getName().equals(path)) return zip.readAllBytes();
            }
        }
        return null;
    }

    /** Toutes les images du document, par chemin. */
    private static Map<String, byte[]> pictures(byte[] odt) throws Exception {
        Map<String, byte[]> found = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(odt))) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                if (e.getName().startsWith("Pictures/")) {
                    found.put(e.getName(), zip.readAllBytes());
                }
            }
        }
        return found;
    }

    /**
     * Contexte minimal COMPLET : chaque groupe de tags reference par le
     * template recoit une map permissive. Freemarker echoue sur toute reference
     * absente — ce test verifie le logo, pas la resolution metier.
     */
    private static Map<String, Object> contextFor(byte[] template) throws Exception {
        String xml = new String(entry(template, "content.xml"), java.nio.charset.StandardCharsets.UTF_8);

        // Les sources de `<#list groupe.champ as x>` doivent etre des
        // collections : le template itere ses lignes de facturation.
        java.util.Set<String> listKeys = new java.util.HashSet<>();
        java.util.regex.Matcher lists = java.util.regex.Pattern
                .compile("#list\\s+[a-zA-Z0-9_]+\\.([a-zA-Z0-9_]+)\\s+as").matcher(xml);
        while (lists.find()) {
            listKeys.add(lists.group(1));
        }

        Map<String, Object> context = new LinkedHashMap<>();
        java.util.regex.Matcher refs = java.util.regex.Pattern
                .compile("[$#]\\{?\\s*([a-zA-Z0-9_]+)\\.[a-zA-Z0-9_]+").matcher(xml);
        while (refs.find()) {
            context.computeIfAbsent(refs.group(1), k -> new PermissiveMap(listKeys));
        }
        return context;
    }

    /** Rend n'importe quelle cle : le template en reference des dizaines. */
    private static final class PermissiveMap extends java.util.HashMap<String, Object> {
        private final java.util.Set<String> listKeys;

        PermissiveMap(java.util.Set<String> listKeys) { this.listKeys = listKeys; }

        @Override public Object get(Object key) {
            return listKeys.contains(String.valueOf(key)) ? java.util.List.of() : "";
        }

        @Override public boolean containsKey(Object key) { return true; }
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "bon-intervention-clenzy.odt",
            "validation-fin-mission-clenzy.odt",
            "justificatif-remboursement-clenzy.odt",
    })
    void whenLogoProvided_thenTemplateEmbedsIt(String template) throws Exception {
        byte[] logo = redPng();
        byte[] odt = templateBytes(template);
        Map<String, Object> context = contextFor(odt);
        context.put(LOGO_FIELD, logo);

        byte[] rendered = renderer.fillTemplate(odt, context);

        // XDocReport ajoute l'image sous un nom genere et reecrit le href du
        // cadre : nos octets doivent se retrouver parmi les images du rendu.
        assertThat(pictures(rendered).values())
                .as("octets du logo injectes dans %s", template)
                .anyMatch(bytes -> java.util.Arrays.equals(bytes, logo));
    }

    @Test
    void whenNoLogo_thenRenderingStillSucceeds() throws Exception {
        // Sans logo, le cadre garde son placeholder transparent : la generation
        // ne doit ni echouer ni afficher quoi que ce soit.
        byte[] odt = templateBytes("bon-intervention-clenzy.odt");

        byte[] rendered = renderer.fillTemplate(odt, contextFor(odt));

        assertThat(rendered).isNotEmpty();
        assertThat(entry(rendered, "content.xml")).isNotNull();
    }
}
