package org.mission1.orbital.propagation;

import org.orekit.data.ClasspathCrawler;
import org.orekit.data.LazyLoadedDataContext;
import org.orekit.frames.EOPHistory;
import org.orekit.frames.Frame;
import org.orekit.frames.ITRFVersion;
import org.orekit.time.AbsoluteDate;
import org.orekit.time.UTCScale;
import org.orekit.time.TimeScales;
import org.orekit.utils.IERSConventions;
import org.mission1.orbital.domain.OrbitalQualityReason;

/** Private Orekit context: packaged UTC–TAI and EOP only; no machine-global data path. */
public final class OrekitData {
    private static final IERSConventions CONVENTIONS = IERSConventions.IERS_2010;
    private final LazyLoadedDataContext context;
    private final UTCScale utc;
    private final Frame teme;
    private final Frame eme2000;
    private final Frame earthFixed;
    private final EOPHistory eop;

    public OrekitData() {
        this("orekit-data/tai-utc.dat", "orekit-data/finals2000A.all");
    }

    // Also permits an isolated missing-resource test without changing process-global Orekit state.
    OrekitData(String leapSecondsResource, String eopResource) {
        try {
            context = new LazyLoadedDataContext();
            context.getDataProvidersManager().addProvider(new ClasspathCrawler(
                    OrekitData.class.getClassLoader(), leapSecondsResource, eopResource));
            utc = context.getTimeScales().getUTC();
            eop = context.getFrames().getEOPHistory(CONVENTIONS, false);
            if (eop == null || eop.getEntries().isEmpty()) {
                throw new IllegalStateException("Bundled Earth orientation data is empty");
            }
            teme = context.getFrames().getTEME();
            eme2000 = context.getFrames().getEME2000();
            earthFixed = context.getFrames().getITRF(ITRFVersion.ITRF_2020, CONVENTIONS, false);
        } catch (RuntimeException failure) {
            throw new IllegalStateException("Required bundled Orekit UTC/EOP data unavailable", failure);
        }
    }

    public UTCScale utc() { return utc; }
    public TimeScales timeScales() { return context.getTimeScales(); }
    public Frame teme() { return teme; }
    public Frame eme2000() { return eme2000; }
    public Frame earthFixed() { return earthFixed; }

    public void requireEopCoverage(AbsoluteDate date) {
        if (date.compareTo(eop.getStartDate()) < 0 || date.compareTo(eop.getEndDate()) > 0) {
            throw new OrbitalCalculationException(OrbitalQualityReason.EOP_DATA_UNAVAILABLE,
                    "Propagation time is outside bundled EOP coverage: " + date.toString(utc));
        }
    }
}
