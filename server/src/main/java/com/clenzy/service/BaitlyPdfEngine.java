package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.utils.PdfMerger;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Point unique de production et contrôle des PDF Baitly. Les modules ne fournissent que le contenu. */
@Service
public class BaitlyPdfEngine {
    private final String url;
    private final RestTemplate http;

    public BaitlyPdfEngine(
            @Value("${clenzy.libreoffice.url:http://clenzy-libreoffice:3000}") String url,
            @Qualifier("restTemplate") RestTemplate http) {
        this.url = url;
        // Client général avec délais bornés, indépendant des clients Channex et Cloudflare.
        this.http = http;
    }
    @FunctionalInterface public interface Edit { void write(PdfDocument document) throws Exception; }

    @CircuitBreaker(name="gotenberg") @Retry(name="gotenberg")
    public byte[] html(String html) {
        BaitlyHtmlTemplates.validateResources(html);
        var document = org.jsoup.Jsoup.parse(html);
        BaitlyDocumentPresentation.apply(document);
        document.outputSettings().prettyPrint(false);
        document.head().prependElement("meta").attr("http-equiv", "Content-Security-Policy")
                .attr("content", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'");
        var body=body(document.outerHtml().getBytes(StandardCharsets.UTF_8),"index.html");
        for(String side:List.of("Top","Bottom","Left","Right")) body.add("margin"+side,side.equals("Top")||side.equals("Bottom")?"0.6":"0.5");
        body.add("paperWidth","8.27");body.add("paperHeight","11.69");body.add("printBackground","true");
        return convert("/forms/chromium/convert/html",body);
    }
    /** Les rapports utilisent le même convertisseur HTML que les autres documents. */
    public byte[] reportHtml(String html) {
        return html(html);
    }
    /** Produit une nouvelle version ; la source et son empreinte ne sont jamais réécrites. */
    public byte[] edit(byte[] source,Edit edit) {
        validate(source);
        try(var out=new ByteArrayOutputStream()) {
            try(var pdf=new PdfDocument(new PdfReader(new ByteArrayInputStream(source)),new PdfWriter(out))){edit.write(pdf);}
            return validate(out.toByteArray());
        } catch(Exception e){throw failure(e);}
    }
    public byte[] merge(List<byte[]> sources) {
        if(sources==null || sources.isEmpty())throw new IllegalArgumentException("PDF source requis");
        try(var out=new ByteArrayOutputStream()) {
            try(var pdf=new PdfDocument(new PdfWriter(out))){
                var merger=new PdfMerger(pdf);
                for(var source:sources)try(var input=new PdfDocument(new PdfReader(new ByteArrayInputStream(validate(source))))){merger.merge(input,1,input.getNumberOfPages());}
            }
            return validate(out.toByteArray());
        } catch(Exception e){throw failure(e);}
    }
    public boolean available(){try{return http.getForEntity(url+"/health",String.class).getStatusCode().is2xxSuccessful();}catch(Exception e){return false;}}
    public static byte[] validate(byte[] bytes) {
        if(bytes==null || bytes.length<6 || !new String(bytes,0,5,StandardCharsets.US_ASCII).equals("%PDF-"))throw new DocumentGenerationException("Le moteur n'a pas produit un PDF");
        try(var pdf=new PdfDocument(new PdfReader(new ByteArrayInputStream(bytes)))){
            if(pdf.getNumberOfPages()<1)throw new DocumentGenerationException("Le PDF ne contient aucune page");
        }catch(Exception e){throw failure(e);}
        return bytes;
    }
    private LinkedMultiValueMap<String,Object> body(byte[] bytes,String filename){
        if(bytes==null || bytes.length==0)throw new IllegalArgumentException("Contenu à convertir requis");
        var body=new LinkedMultiValueMap<String,Object>();body.add("files",new ByteArrayResource(bytes){@Override public String getFilename(){return filename;}});return body;
    }
    private byte[] convert(String path,LinkedMultiValueMap<String,Object> body){
        try {
            var headers=new HttpHeaders();headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            var response=http.exchange(url+path,HttpMethod.POST,new HttpEntity<>(body,headers),byte[].class);
            if(!response.getStatusCode().is2xxSuccessful() || response.getHeaders().getContentType()!=null && !MediaType.APPLICATION_PDF.isCompatibleWith(response.getHeaders().getContentType()))throw new DocumentGenerationException("Réponse PDF invalide");
            return validate(response.getBody());
        }catch(Exception e){throw failure(e);}
    }
    private static DocumentGenerationException failure(Exception e){return new DocumentGenerationException("Production du PDF impossible",e);}
}
