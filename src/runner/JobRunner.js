const { getBrowser } = require("../scrapper/browser"); // Import your browser manager
const StrategyFactory = require("../strategies/StrategyFactory"); // Strategy Factory

class JobRunner {
  static async run(taskData) {
    let browser = null;
    let page = null;
    const { strategy: strategyName } = taskData;

    try {
      // 1. Instantiate the correct strategy via the Factory
      const strategy = StrategyFactory.get(strategyName);
      if (!strategy) {
        throw new Error(
          `Strategy "${strategyName}" is not supported by the system.`,
        );
      }

      // 2. Get the shared/central Puppeteer browser instance
      browser = await getBrowser();

      // 3. Open an isolated page (Tab) for this specific task
      page = await browser.newPage();

      // Recommended settings for resilience and performance on the tab
      await page.setDefaultNavigationTimeout(35000);
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      console.log(`[JobRunner] Running strategy [${strategyName}]...`);

      // 4. Execute the strategy-specific logic (SingleSchool or FullDistrict)
      const result = await strategy.execute(page, taskData);
      return result;
    } catch (error) {
      console.error(
        `[JobRunner] Error during execution of strategy [${strategyName}]:`,
        error,
      );
      throw error;
    } finally {
      // THE FINALLY BLOCK IS SACRED: Always closes the page to prevent RAM/Chromium process leaks
      if (page) {
        console.log("[JobRunner] Closing the Puppeteer page safely...");
        await page
          .close()
          .catch((err) =>
            console.error("[JobRunner] Error closing page:", err),
          );
      }
    }
  }
}

module.exports = JobRunner;
