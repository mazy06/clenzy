package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import org.springframework.stereotype.Service;
import java.nio.file.Files;
import java.nio.file.Path;

/** Compatibilité de l'ancienne API interne. Aucun appel LibreOffice : lecture historique puis HTML. */
@Service
@Deprecated(forRemoval = true)
public class LibreOfficeConversionService {
    private final BaitlyPdfEngine engine;
    public LibreOfficeConversionService(BaitlyPdfEngine engine){this.engine=engine;}
    public byte[] convertToPdf(byte[] source,String filename){
        byte[] html = BaitlyLegacyOdtImporter.html(source);
        if (BaitlyLegacyOdtImporter.isOdt(source))
            html = BaitlyHtmlTemplates.render(html, java.util.Map.of("entreprise", java.util.Map.of("nom", "Baitly")));
        return engine.html(new String(html, java.nio.charset.StandardCharsets.UTF_8));
    }
    public byte[] convertToPdf(Path path){
        try{return convertToPdf(Files.readAllBytes(path),path.getFileName().toString());}
        catch(Exception e){throw new DocumentGenerationException("Lecture du document source impossible",e);}
    }
    public boolean isAvailable(){return engine.available();}
}
