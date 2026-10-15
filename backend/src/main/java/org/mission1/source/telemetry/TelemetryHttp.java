package org.mission1.source.telemetry;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;

/** Bounded TLS-verifying transport. Deadline covers streamed body after response headers. */
public final class TelemetryHttp implements AutoCloseable {
    private final HttpClient client;
    private final java.util.Set<InputStream> active=ConcurrentHashMap.newKeySet();
    private volatile boolean closed;
    private final ScheduledExecutorService deadlines=Executors.newSingleThreadScheduledExecutor(r -> {
        var t=new Thread(r,"telemetry-http-deadline"); t.setDaemon(true); return t;
    });
    private final Duration timeout;
    public TelemetryHttp(Duration timeout) {
        this.timeout=timeout;
        client=HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    @FunctionalInterface public interface StreamReader<T> { T read(InputStream input) throws IOException; }
    public <T> T initialSse(URI uri, Duration readTimeout, StreamReader<T> reader) throws IOException, InterruptedException {
        if (closed) throw new IOException("Telemetry transport closed");
        var request=HttpRequest.newBuilder(uri).timeout(timeout).header("Accept","text/event-stream")
                .header("Accept-Encoding","identity").header("User-Agent","MISSION1/0.1 public-telemetry").GET().build();
        var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
        try (var input=response.body()) {
            active.add(input);
            if (closed) throw new IOException("Telemetry transport closed");
            if (response.statusCode()!=200) throw new IOException("HTTP " + response.statusCode());
            if (!response.headers().firstValue("content-type").orElse("").startsWith("text/event-stream")) throw new IOException("Expected SSE");
            var deadline=deadlines.schedule(() -> { try { input.close(); } catch(IOException ignored) {} },readTimeout.toMillis(),TimeUnit.MILLISECONDS);
            try { return reader.read(input); }
            finally { deadline.cancel(false); }
        } finally {active.remove(response.body());}
    }
    public String get(URI uri, int maxBytes) throws IOException, InterruptedException {
        if (closed) throw new IOException("Telemetry transport closed");
        var request=HttpRequest.newBuilder(uri).timeout(timeout).header("Accept","application/json")
                .header("User-Agent","MISSION1/0.1 public-telemetry").GET().build();
        var response=client.send(request,HttpResponse.BodyHandlers.ofInputStream());
        try (var input=response.body()) {
            active.add(input);
            if (closed) throw new IOException("Telemetry transport closed");
            if (response.statusCode()!=200) throw new IOException("HTTP " + response.statusCode());
            var deadline=deadlines.schedule(() -> { try { input.close(); } catch(IOException ignored) {} },timeout.toMillis(),TimeUnit.MILLISECONDS);
            try {
                var output=new ByteArrayOutputStream(); int next;
                while ((next=input.read())!=-1) {
                    if (output.size()>=maxBytes) throw new IOException("Oversized telemetry body");
                    output.write(next);
                }
                return output.toString(java.nio.charset.StandardCharsets.UTF_8);
            } finally { deadline.cancel(false); }
        } finally {active.remove(response.body());}
    }
    @Override public void close() {
        closed=true;
        active.forEach(input -> {try {input.close();}catch(IOException ignored) {}});
        deadlines.shutdownNow();client.shutdownNow();
    }
}
