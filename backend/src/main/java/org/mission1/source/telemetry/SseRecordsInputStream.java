package org.mission1.source.telemetry;

import java.io.*;

/** Streams only the first complete records event. Never stores an SSE data line. */
final class SseRecordsInputStream extends InputStream {
    private final InputStream input;
    private final int maximumBytes;
    private int pending = -1, bytes;
    private boolean records, data, seenData, complete;

    SseRecordsInputStream(InputStream input, int maximumBytes) {
        this.input = new BufferedInputStream(input, 4096);
        this.maximumBytes = maximumBytes;
    }

    int bytes() { return bytes; }

    private int take() throws IOException {
        if (pending >= 0) { int result = pending; pending = -1; return result; }
        int result = input.read();
        if (result < 0) throw new EOFException("Truncated initial SSE event");
        if (++bytes > maximumBytes) throw new IOException("SenseData event byte limit exceeded");
        return result;
    }

    private void newline(int value) throws IOException {
        if (value == '\r') {
            int next = take();
            if (next != '\n') pending = next;
        }
    }

    @Override public int read() throws IOException {
        while (!complete) {
            if (data) {
                int value = take();
                if (value == '\n' || value == '\r') {
                    newline(value); data = false; return '\n';
                }
                return value;
            }
            int value = take();
            if (value == '\n' || value == '\r') {
                try { newline(value); }
                catch (EOFException end) { if (!(records && seenData)) throw end; }
                if (records && seenData) { complete = true; return -1; }
                records = false; seenData = false; continue;
            }
            var field = new StringBuilder();
            while (value != ':' && value != '\n' && value != '\r') {
                if (field.length() >= 64) throw new IOException("Oversized SSE field name");
                field.append((char) value); value = take();
            }
            if (value != ':') { newline(value); continue; }
            value = take();
            if (value != ' ') pending = value;
            if (field.toString().equals("data") && records) {
                data = true; seenData = true; continue;
            }
            var header = new StringBuilder();
            value = take();
            while (value != '\n' && value != '\r') {
                if (header.length() >= 256) throw new IOException("Oversized SSE header/preamble");
                header.append((char) value); value = take();
            }
            newline(value);
            if (field.toString().equals("event")) records = header.toString().equals("records");
            if (!records && bytes > 16384) throw new IOException("SenseData preamble limit exceeded");
        }
        return -1;
    }

    @Override public int read(byte[] target, int offset, int length) throws IOException {
        java.util.Objects.checkFromIndexSize(offset, length, target.length);
        if (length == 0) return 0;
        int count = 0;
        while (count < length) {
            int value = read();
            if (value < 0) return count == 0 ? -1 : count;
            target[offset + count++] = (byte) value;
        }
        return count;
    }

    @Override public void close() throws IOException { input.close(); }
}
