package org.mission1.source.telemetry;

import com.lightstreamer.client.*;
import java.time.Clock;
import java.util.function.Consumer;
import org.mission1.telemetry.*;

/** Official SDK owns sessions, MERGE state reconstruction, snapshots and reconnection. */
public final class NativeTelemetrySource implements AutoCloseable {
    public static final String[] FIELDS={"TimeStamp","Value","Status.Class","Status.Indicator","Status.Color","CalibratedData"};
    private final LightstreamerClient client;
    private final Subscription subscription;
    public NativeTelemetrySource(String endpoint, String adapter, long retryMillis, TelemetryCatalog catalog,
            Clock clock, Consumer<TelemetryNormalizer.Raw> sink, TelemetryDiagnostics diagnostics) {
        client=new LightstreamerClient(endpoint,adapter);
        client.connectionOptions.setRetryDelay(retryMillis);
        client.addListener(new ClientListener() {
            public void onStatusChange(String state) { diagnostics.nativeStatus=state; }
            public void onServerError(int code,String message) { diagnostics.nativeStatus="SERVER_ERROR_"+code; }
            public void onListenStart() {} public void onListenEnd() {} public void onPropertyChange(String property) {}
        });
        subscription=new Subscription("MERGE",catalog.definitions().stream().map(TelemetryCatalog.Definition::rawItemId).toArray(String[]::new),FIELDS);
        subscription.setRequestedSnapshot("yes");
        subscription.addListener(new SubscriptionListener() {
            public void onItemUpdate(ItemUpdate update) {
                diagnostics.callbacks.incrementAndGet();
                try { sink.accept(copy(update,clock)); }
                catch (RuntimeException invalid) { diagnostics.parseRejects.incrementAndGet(); }
            }
            public void onSubscription() { diagnostics.subscriptionStatus="SUBSCRIBED"; }
            public void onSubscriptionError(int code,String message) { diagnostics.subscriptionStatus="ERROR_"+code; }
            public void onUnsubscription() { diagnostics.subscriptionStatus="UNSUBSCRIBED"; }
            public void onItemLostUpdates(String name,int pos,int lost) { diagnostics.serverLostUpdates.addAndGet(lost); }
            public void onClearSnapshot(String name,int pos) {} public void onEndOfSnapshot(String name,int pos) {}
            public void onCommandSecondLevelItemLostUpdates(int lost,String key) {}
            public void onCommandSecondLevelSubscriptionError(int code,String message,String key) {}
            public void onListenStart() {} public void onListenEnd() {} public void onRealMaxFrequency(String frequency) {}
        });
    }
    public static TelemetryNormalizer.Raw copy(ItemUpdate update, Clock clock) {
        for (var field:FIELDS) { String value=update.getValue(field);if (value!=null && value.length()>128) throw new IllegalArgumentException("Oversized native field"); }
        // getValue returns the SDK's complete MERGE state, including unchanged fields.
        // Status-only delivery preserves fields but has no new qualified record date.
        String changes=java.util.Arrays.stream(FIELDS).filter(update::isValueChanged).collect(java.util.stream.Collectors.joining(","));
        return new TelemetryNormalizer.Raw("NATIVE",update.getItemName(),update.getItemName(),update.getValue("Value"),update.getValue("TimeStamp"),
                clock.instant(),update.isSnapshot(),update.getValue("Status.Class"),update.getValue("Status.Indicator"),update.getValue("Status.Color"),update.getValue("CalibratedData"),null,changes);
    }
    public void start() { client.subscribe(subscription);client.connect(); }
    @Override public void close() { client.unsubscribe(subscription);client.disconnect(); }
}
