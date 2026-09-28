"""Independent offline reference for the frozen ISS fixture; not production code."""

from datetime import datetime
from pathlib import Path

from sgp4.api import Satrec, jday
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.framelib import itrs

lines = (Path(__file__).resolve().parents[1] / "src/test/resources/iss-2026-09-28.tle").read_text().splitlines()
line1, line2 = lines[1], lines[2]
sgp4 = Satrec.twoline2rv(line1, line2)
timescale = load.timescale(builtin=True)
satellite = EarthSatellite(line1, line2, lines[0].strip(), timescale)

for text in ("2026-09-28T03:24:39.835008+00:00", "2026-09-28T04:24:39.835008+00:00"):
    instant = datetime.fromisoformat(text)
    jd, fraction = jday(instant.year, instant.month, instant.day,
                        instant.hour, instant.minute, instant.second + instant.microsecond / 1e6)
    error, position_km, velocity_km_s = sgp4.sgp4(jd, fraction)
    if error:
        raise RuntimeError(f"SGP4 error {error} at {text}")
    position = satellite.at(timescale.from_datetime(instant))
    fixed = position.frame_xyz(itrs).km
    geographic = wgs84.geographic_position_of(position)
    print(text)
    print("TEME position m", [value * 1000 for value in position_km])
    print("TEME velocity m/s", [value * 1000 for value in velocity_km_s])
    print("ITRS position m", [value * 1000 for value in fixed])
    print("WGS84 latitude longitude degrees, altitude m",
          geographic.latitude.degrees, geographic.longitude.degrees, geographic.elevation.m)
