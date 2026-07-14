const ScrapeRunRepository = require("../repository/ScrapeRunRepository");
const StrategyRunner = require("../runner/StrategyRunner");

module.exports = {
  key: "ScraperJob",

  async handle({ data }) {
    // Safely extract the runId
    const runId = data ? data.runId : null;

    try {
      // Defensive validation of the payload
      if (!runId) {
        throw new Error(
          'Critical Failure: "runId" was not provided in the Job payload.',
        );
      }

      //console.log(`[ScraperJob] Starting processing for Run ID: ${runId}`);

      // 1. Update the global execution status to 'processing'
      await ScrapeRunRepository.updateStatus(runId, "processing");

      // 2. Forward the data to the Runner, which selects the correct strategy
      const result = await StrategyRunner.run(data);

      // 3. On success, update status to 'completed' and store the output
      await ScrapeRunRepository.updateStatus(
        runId,
        "completed",
        JSON.stringify(result),
      );

      //console.log(`[ScraperJob] Run ID ${runId} finalized successfully.`);
      return result;
    } catch (e) {
      console.error(`[ScraperJob] Fatal error detected: ${e.message}`);

      // Safety guard: Only attempt to update the DB if runId exists and is valid
      if (runId) {
        try {
          await ScrapeRunRepository.updateStatus(runId, "failed", e.message);
        } catch (dbError) {
          console.error(
            `[ScraperJob] Unable to update failure status in DB for Run ${runId}:`,
            dbError,
          );
        }
      }

      // Re-throw the error so Bull Queue registers it as failed and triggers automatic retries
      throw e;
    }
  },
};
