"use strict";

/**

Integration test for the BullMQ worker.

Verifies that a job added to the book-scraper queue is consumed by a
BullMQ Worker and that StrategyRunner.run is called with the correct
job data and execution options.

StrategyRunner.run is mocked because this test validates the integration
between Redis, BullMQ, the Worker and StrategyRunner, not the scraping
logic itself.

Requires a running Redis instance before executing the tests.
*/

const { Queue, Worker } = require("bullmq");
const redisConfig = require("../../src/config/redis");
const StrategyRunner = require("../../src/runner/StrategyRunner");
const ScraperJob = require("../../src/jobs/ScraperJob");

jest.mock("../../src/runner/StrategyRunner");

describe("Worker BullMQ (integração com Redis)", () => {
  let queue;
  let worker;
  const TEST_QUEUE = (process.env.SCRAPE_QUEUE_NAME =
    "book-scraper-route-test");
  beforeAll(() => {
    queue = new Queue("book-scraper-route-test", { connection: redisConfig });
  });

  afterEach(async () => {
    // Close the worker created by the test to avoid interference with
    // subsequent tests.
    if (worker) {
      await worker.close();
      worker = null;
    }
    await queue.drain(true);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await queue.close();
  });

  test("consome o job pendente e chama StrategyRunner.run com os dados e as opções corretas", async () => {
    StrategyRunner.run.mockResolvedValue({ sentCount: 1, failedEntries: [] });

    const scraperJob = new ScraperJob();
    let processedJob;

    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        const result = await scraperJob.perform(job);
        processedJob = job;
        return result;
      },
      { connection: redisConfig, concurrency: 1 },
    );

    const jobData = {
      strategy: "single_school",
      year: "5º Ano",
      district: "Porto",
      city: "Ermesinde",
      school: "Escola Teste",
      callback_url:
        "http://host.docker.internal:8000/api/book-scraper/callback",
      run_token: "run-token-worker-teste",
    };

    const completed = new Promise((resolve) => worker.on("completed", resolve));

    const job = await queue.add("scrape-job", jobData);
    await completed;

    expect(StrategyRunner.run).toHaveBeenCalledTimes(1);

    const [calledInput, calledOptions] = StrategyRunner.run.mock.calls[0];
    expect(calledInput).toEqual(
      expect.objectContaining({
        strategy: "single_school",
        school: "Escola Teste",
        run_token: "run-token-worker-teste",
      }),
    );
    expect(calledOptions).toEqual(
      expect.objectContaining({
        jobToken: job.id,
        attempt: 0, // primeira tentativa, sem retries
        onProgress: expect.any(Function),
      }),
    );

    expect(processedJob.data.run_token).toBe("run-token-worker-teste");
  });

  test("resumo devolvido por StrategyRunner.run (sentCount/failedEntries) chega intacto ao evento 'completed'", async () => {
    const summary = {
      sentCount: 2,
      failedEntries: [
        { school: { name: "Escola Falhada" }, error: "timeout", items: [] },
      ],
    };

    StrategyRunner.run.mockResolvedValue(summary);

    const scraperJob = new ScraperJob();

    worker = new Worker(TEST_QUEUE, (job) => scraperJob.perform(job), {
      connection: redisConfig,
      concurrency: 1,
    });

    const completedPromise = new Promise((resolve, reject) => {
      worker.once("completed", (_job, returnValue) => resolve(returnValue));
      worker.once("failed", (_job, err) => reject(err));
    });

    await queue.add("scrape-job", {
      strategy: "single_school",
      school: "Escola Teste",
      callback_url:
        "http://host.docker.internal:8000/api/book-scraper/callback",
      run_token: "run-token-summary-teste",
    });

    const returnValue = await completedPromise;

    expect(returnValue).toEqual(summary);
  }, 15000);
});
