package com.clenzy.fiscal.einvoicing.francepdp;

import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.ls.DOMImplementationLS;
import javax.xml.XMLConstants;
import javax.xml.transform.Templates;
import javax.xml.transform.TransformerException;
import javax.xml.transform.dom.DOMResult;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Référentiel officiel versionné, exécuté localement ; aucun XML ni appel réseau sortant. */
@Component
public class BaitlyCiiValidator {
    public static final String VERSION="EN16931-CII-1.3.16+D16B";
    private static final String ROOT="/fiscal/cii/en16931-1.3.16/";
    private static final Set<String> SCHEMAS=Set.of("CrossIndustryInvoice_100pD16B.xsd",
        "CrossIndustryInvoice_QualifiedDataType_100pD16B.xsd", "CrossIndustryInvoice_UnqualifiedDataType_100pD16B.xsd",
        "CrossIndustryInvoice_ReusableAggregateBusinessInformationEntity_100pD16B.xsd");
    private final Schema schema;
    private final Templates rules;
    private final Templates franceRules;
    public static final String FR_VERSION="FNFE-RFE-1.4.0.04";
    public record Issue(String code,String message) {}

    public BaitlyCiiValidator() {
        try {
            var f=SchemaFactory.newDefaultInstance();f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
            f.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD,"");f.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
            var dom=(DOMImplementationLS)javax.xml.parsers.DocumentBuilderFactory.newDefaultInstance().newDocumentBuilder().getDOMImplementation().getFeature("LS","3.0");
            f.setResourceResolver((type,namespace,publicId,systemId,base)->{
                if(!SCHEMAS.contains(systemId))throw new IllegalArgumentException("Schéma externe interdit");
                var input=dom.createLSInput();input.setSystemId(systemId);input.setByteStream(resource(systemId));return input;
            });
            try(var xsd=resource("CrossIndustryInvoice_100pD16B.xsd")) {schema=f.newSchema(new StreamSource(xsd));}
            var transformer=new net.sf.saxon.TransformerFactoryImpl();
            transformer.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
            transformer.setAttribute("http://saxon.sf.net/feature/allowedProtocols","#none");
            transformer.setAttribute("http://saxon.sf.net/feature/allow-external-functions",false);
            transformer.setURIResolver((href,base)->{throw new TransformerException("Ressource externe interdite");});
            try(var xslt=resource("EN16931-CII-validation.xslt")) {rules=transformer.newTemplates(new StreamSource(xslt));}
            try(var xslt=Objects.requireNonNull(getClass().getResourceAsStream("/fiscal/cii/fr-1.4.0.04/BR-FR-Flux2-Schematron-CII.xslt"))) {
                franceRules=transformer.newTemplates(new StreamSource(xslt));
            }
        } catch(Exception e) {throw new IllegalStateException("Référentiel CII local indisponible",e);}
    }

    public List<Issue> validate(String xml) {
        return validate(xml,rules);
    }
    public List<Issue> validateFrance(String xml) {
        var base=validate(xml);return base.isEmpty()?validate(xml,franceRules):base;
    }
    private List<Issue> validate(String xml,Templates templates) {
        try {
            if(xml==null || xml.length()>2_000_000) return List.of(new Issue("XML_SIZE","Document absent ou trop volumineux."));
            var document=BaitlyCiiPreflight.parse(xml.getBytes(StandardCharsets.UTF_8));
            schema.newValidator().validate(new DOMSource(document));
            var transform=templates.newTransformer();var result=new DOMResult();
            transform.transform(new DOMSource(document),result);
            var failures=((org.w3c.dom.Document)result.getNode()).getElementsByTagNameNS("http://purl.oclc.org/dsdl/svrl","failed-assert");
            var issues=new ArrayList<Issue>();
            for(int n=0;n<Math.min(50,failures.getLength());n++) {
                var e=(Element)failures.item(n);var message=e.getElementsByTagNameNS("http://purl.oclc.org/dsdl/svrl","text").item(0).getTextContent().trim();
                issues.add(new Issue(e.getAttribute("id"),message.substring(0,Math.min(700,message.length()))));
            }
            return List.copyOf(issues);
        } catch(Exception e) {return List.of(new Issue("CII_SCHEMA","Le document ne respecte pas la structure CII attendue."));}
    }
    private static java.io.InputStream resource(String name) {
        return Objects.requireNonNull(BaitlyCiiValidator.class.getResourceAsStream(ROOT+name),"Référentiel absent : "+name);
    }
}
