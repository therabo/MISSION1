/* Reuse the accepted five-viewport Crew QA against an actual second backend.
 * Only HTTP transport is redirected; no response data or application code is substituted. */
const { chromium } = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const base = process.env.MISSION1_QA_BACKEND || 'http://127.0.0.1:8081';
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options);
  const createPage = browser.newPage.bind(browser);
  browser.newPage = async (pageOptions) => {
    const page = await createPage(pageOptions);
    await page.route('**/api/iss/**', async (route) => {
      const original = new URL(route.request().url());
      const response = await route.fetch({ url: base + original.pathname + original.search });
      await route.fulfill({ response });
    });
    return page;
  };
  return browser;
};
require('../../canonical-identity-validation/scripts/canonical-navigation.cjs');
