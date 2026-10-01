// Run against uninstrumented development/production builds and the actual backend.
const { chromium } = require(
  process.env.MISSION1_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("fs"),
  crypto = require("crypto"),
  dir = process.env.MISSION1_EVIDENCE_DIR || "/tmp/mission1-rendering-evidence";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  });
  const results = [];
  try {
    for (const port of [5173, 4173]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage(),
        row = {
          port,
          noQa: false,
          pageErrors: [],
          consoleErrors: [],
          requestFailures: [],
          scripts: [],
          fallbackResponses: [],
          handoffs: [],
          sources: [],
        };
      const pending = [];
      page.on("pageerror", (e) => row.pageErrors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") row.consoleErrors.push(m.text());
        if (m.text().startsWith("[approach] handoff"))
          row.handoffs.push(m.text());
      });
      page.on("requestfailed", (r) =>
        row.requestFailures.push({
          url: r.url(),
          failure: r.failure()?.errorText,
        }),
      );
      page.on("response", (r) => {
        if (/\/assets\/index-.*\.js$/.test(r.url()))
          pending.push(
            r
              .body()
              .then((b) =>
                row.scripts.push({
                  url: r.url(),
                  sha256: crypto.createHash("sha256").update(b).digest("hex"),
                }),
              ),
          );
        if (r.url().endsWith("/imagery/black-marble-2016-color.jpg"))
          row.fallbackResponses.push({ url: r.url(), status: r.status() });
      });
      await page.goto(`http://127.0.0.1:${port}/?approachDiagnostics`);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].find(
            (x) => x.textContent === "Inspect ISS",
          )?.disabled === false,
        null,
        { timeout: 60000 },
      );
      await page.waitForTimeout(1500);
      row.noQa = await page.evaluate(() => globalThis.__qa === undefined);
      row.body = await page.locator("body").innerText();
      await page.screenshot({ path: `${dir}/final-live-${port}-overview.png` });
      for (const source of ["MISSION1 GP/TLE", "NASA OEM"]) {
        const b = page.getByRole("button", { name: source, exact: true });
        if (await b.isDisabled()) throw Error(`${port}: ${source} unavailable`);
        await b.click();
        await page
          .getByRole("button", { name: "Inspect ISS", exact: true })
          .click();
        await page
          .getByText("Drag to orbit the ISS · Scroll to zoom", { exact: true })
          .waitFor(null, { timeout: 20000 });
        const result = {
          source,
          inspection: true,
          attitudeUnavailable: await page
            .locator("body")
            .innerText()
            .then((t) => t.includes("Attitude unavailable")),
          backRestored: false,
        };
        await page.screenshot({
          path: `${dir}/final-live-${port}-${source === "NASA OEM" ? "oem" : "gp"}-inspection.png`,
        });
        await page
          .getByRole("button", { name: "Back to Earth View", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll("button")].find(
              (x) => x.textContent === "Inspect ISS",
            )?.disabled === false,
          null,
          { timeout: 20000 },
        );
        result.backRestored = true;
        row.sources.push(result);
      }
      await page.waitForTimeout(1500);
      await Promise.all(pending);
      row.finalBody = await page.locator("body").innerText();
      row.providerErrors = row.consoleErrors.filter(
        (e) =>
          e.includes("https://gibs.earthdata.nasa.gov/") ||
          e === "Failed to load resource: net::ERR_FAILED",
      );
      row.unexpectedConsoleErrors = row.consoleErrors.filter(
        (e) => !row.providerErrors.includes(e),
      );
      const gibsFailure = row.requestFailures.some((r) =>
        r.url.startsWith("https://gibs.earthdata.nasa.gov/"),
      );
      row.localNightFallbackLoaded = row.fallbackResponses.some(
        (r) => r.status === 200,
      );
      if (
        !row.noQa ||
        row.pageErrors.length ||
        row.unexpectedConsoleErrors.length ||
        row.requestFailures.some(
          (r) => !r.url.startsWith("https://gibs.earthdata.nasa.gov/"),
        ) ||
        (gibsFailure && !row.localNightFallbackLoaded)
      )
        throw Error(
          "Unexpected application or fallback failure " + JSON.stringify(row),
        );
      results.push(row);
      console.log(
        JSON.stringify({
          port,
          sources: row.sources,
          noQa: row.noQa,
          pageErrors: row.pageErrors,
          providerErrorCount: row.providerErrors.length,
          localNightFallbackLoaded: row.localNightFallbackLoaded,
          scripts: row.scripts,
        }),
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    `${dir}/final-live-qa.json`,
    JSON.stringify(results, null, 2),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
