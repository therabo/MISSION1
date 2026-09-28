package org.mission1.orbital.application;

/** Deliberately short visual window; a full-orbit ground track is a separate future use case. */
public record OrbitalSampleWindow(int pastSeconds, int futureSeconds, int stepSeconds) {
    public static final int DEFAULT_PAST_SECONDS = 120;
    public static final int DEFAULT_FUTURE_SECONDS = 600;
    public static final int DEFAULT_STEP_SECONDS = 10;
    public static final int MAX_PAST_SECONDS = 300;
    public static final int MAX_FUTURE_SECONDS = 1200;
    public static final int MAX_TOTAL_SECONDS = 1200;
    public static final int MIN_STEP_SECONDS = 5;
    public static final int MAX_STEP_SECONDS = 30;
    public static final int MAX_SAMPLES = 181;

    public OrbitalSampleWindow {
        if (pastSeconds < 0 || pastSeconds > MAX_PAST_SECONDS) {
            throw new InvalidOrbitalSampleRequestException("pastSeconds must be 0..300");
        }
        if (futureSeconds < 30 || futureSeconds > MAX_FUTURE_SECONDS) {
            throw new InvalidOrbitalSampleRequestException("futureSeconds must be 30..1200");
        }
        if (stepSeconds < MIN_STEP_SECONDS || stepSeconds > MAX_STEP_SECONDS) {
            throw new InvalidOrbitalSampleRequestException("stepSeconds must be 5..30");
        }
        if (pastSeconds + futureSeconds > MAX_TOTAL_SECONDS) {
            throw new InvalidOrbitalSampleRequestException("Total window exceeds 1200 seconds");
        }
        if (pastSeconds % stepSeconds != 0 || futureSeconds % stepSeconds != 0) {
            throw new InvalidOrbitalSampleRequestException("pastSeconds and futureSeconds must be multiples of stepSeconds");
        }
        if (sampleCount(pastSeconds, futureSeconds, stepSeconds) > MAX_SAMPLES) {
            throw new InvalidOrbitalSampleRequestException("Window exceeds 181 samples");
        }
    }

    public int sampleCount() { return sampleCount(pastSeconds, futureSeconds, stepSeconds); }

    private static int sampleCount(int past, int future, int step) {
        return (past + future) / step + 1;
    }
}
