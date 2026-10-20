package com.clenzy.marketplace.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.springframework.stereotype.Component;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.zip.ZipInputStream;

/** Replaceable stock adapter. Official stable resource identifiers, no caller-controlled URLs. */
@Component
public class BaitlyNationalDirectorySource {
    public static final String ESTABLISHMENTS="0651fb76-bcf3-4f6a-a38d-bc04fa708576";
    public static final String UNITS="825f4199-cadd-486c-ac46-a65a8ea1a047";
    private static final Set<String> HOSTS=Set.of("www.data.gouv.fr","static.data.gouv.fr");
    public record Resources(String establishments,String units,String establishmentsEtag,String unitsEtag) {
        public Resources(String establishments,String units){this(establishments,units,null,null);}
    }
    private record Resource(String url,String etag) {}
    public static class SourceChangedException extends IOException {public SourceChangedException(){super("Sirene stock changed during processing");}}
    public Resources resolve() throws IOException {
        var establishments=resolve(ESTABLISHMENTS);var units=resolve(UNITS);
        var pattern=java.util.regex.Pattern.compile("/(20[0-9]{4})[0-9]{2}-");
        var e=pattern.matcher(establishments.url());var u=pattern.matcher(units.url());
        if(!e.find()||!u.find()||!e.group(1).equals(u.group(1)))throw new IOException("Sirene stock editions are not aligned");
        return new Resources(establishments.url(),units.url(),establishments.etag(),units.etag());
    }
    private Resource resolve(String resource) throws IOException {
        String url="https://www.data.gouv.fr/api/1/datasets/r/"+resource;
        for(int redirects=0;redirects<5;redirects++) {
            var connection=connection(url);connection.setRequestMethod("HEAD");
            try {
                int status=connection.getResponseCode();
                if(status>=300&&status<400){url=URI.create(url).resolve(connection.getHeaderField("Location")).toString();continue;}
                if(status!=200||!URI.create(url).getHost().equals("static.data.gouv.fr"))throw new IOException("Sirene stock unavailable");
                String etag=connection.getHeaderField("ETag");
                if(etag==null||etag.isBlank()||etag.length()>255)throw new IOException("Sirene stock has no version fingerprint");
                return new Resource(url,etag);
            } finally {connection.disconnect();}
        }
        throw new IOException("Sirene resource redirect limit");
    }
    public CSVParser open(String url) throws IOException {
        return open(url,null);
    }
    public CSVParser open(String url,String etag) throws IOException {
        var connection=connection(url);
        if(etag!=null)connection.setRequestProperty("If-Match",etag);
        if(connection.getResponseCode()==412||(etag!=null&&!etag.equals(connection.getHeaderField("ETag")))){connection.disconnect();throw new SourceChangedException();}
        if(connection.getResponseCode()!=200){connection.disconnect();throw new IOException("Sirene stock unavailable");}
        var zip=new ZipInputStream(new BufferedInputStream(connection.getInputStream(),65536));
        try {
            var entry=zip.getNextEntry();
            if(entry==null||entry.isDirectory()||!entry.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".csv"))throw new IOException("Unexpected Sirene archive");
            // The stream is never extracted. The ceiling protects against malformed/compressed-bomb input.
            InputStream bounded=new FilterInputStream(zip) {
                long remaining=80L*1024*1024*1024;
                @Override public int read(byte[] b,int off,int len) throws IOException {int n=super.read(b,off,(int)Math.min(len,remaining));if(n>0)remaining-=n;if(remaining<=0)throw new IOException("Sirene stock size limit");return n;}
                @Override public int read() throws IOException {int n=super.read();if(n>=0&&--remaining<=0)throw new IOException("Sirene stock size limit");return n;}
                @Override public void close() throws IOException {try{super.close();}finally{connection.disconnect();}}
            };
            return CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(new InputStreamReader(bounded,StandardCharsets.UTF_8));
        } catch(Exception error){zip.close();connection.disconnect();throw error;}
    }
    private HttpURLConnection connection(String url) throws IOException {
        URI uri=URI.create(url);
        if(!"https".equals(uri.getScheme())||!HOSTS.contains(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1)throw new IOException("Untrusted Sirene source");
        var result=(HttpURLConnection)uri.toURL().openConnection();
        result.setInstanceFollowRedirects(false);result.setConnectTimeout(15000);result.setReadTimeout(60000);
        result.setRequestProperty("User-Agent","Baitly-Directory/1.0");return result;
    }
}
