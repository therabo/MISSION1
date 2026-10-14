package org.mission1.source.telemetry;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;

/** Bounded TLS-verifying transport. Deadline covers streamed body after response headers. */
public final class TelemetryHttp implements AutoCloseable {
    private final HttpClient client;
    private final ScheduledExecutorService deadlines=Executors.newSingleThreadScheduledExecutor(r -> {
        var t=new Thread(r,"telemetry-http-deadline"); t.setDaemon(true); return t;
    });
    private final Duration timeout;
    public TelemetryHttp(Duration timeout) {
        this.timeout=timeout;
        client=HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    public String get(URI uri, boolean initialSse, int maxBytes) throws IOException, InterruptedException {
        var request=HttpRequest.newBuilder(uri).timeout(timeout).header("Accept",initialSse?"text/event-stream":"application/json")
                .header("User-Agent","MISSION1/0.1 public-telemetry-bootstrap").GET().build();
        var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
        try (var input=response.body()) {
            if (response.statusCode()!=200) throw new IOException("HTTP " + response.statusCode());
            if (initialSse && !response.headers().firstValue("content-type").orElse("").startsWith("text/event-stream")) throw new IOException("Expected SSE");
            var deadline=deadlines.schedule(() -> { try { input.close(); } catch(IOException ignored) {} },timeout.toMillis(),TimeUnit.MILLISECONDS);
            try {
                var output=new ByteArrayOutputStream(); int next;
                boolean event=false; StringBuilder line=new StringBuilder();
                while ((next=input.read())!=-1) {
                    if (output.size()>=maxBytes) throw new IOException("Oversized telemetry body");
                    output.write(next);
                    if (initialSse) {
                        if (next=='\n') {
                            String text=line.toString().trim();
                            if (text.equals("event: records")) event=true;
                            if (text.isEmpty() && event) break;
                            line.setLength(0);
                        } else line.append((char)next);
                    }
                }
                return output.toString(java.nio.charset.StandardCharsets.UTF_8);
            } finally { deadline.cancel(false); }
        }
    }
    @Override public void close() { deadlines.shutdownNow(); client.close(); }
}
