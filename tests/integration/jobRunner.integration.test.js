"use strict";

/**

Integration test for the production worker flow.


Verifies the complete worker path using the real JobRunner implementation,
from a queued job to the HTTP callback sent to the Laravel API.


StrategyRunner.run and axios are mocked because this test validates the
orchestration flow (Worker -> ScraperJob -> completed/failed events ->
callback payload), not the scraping logic or the real HTTP delivery.


A dedicated queue is used to keep this test isolated from the production
queue and from other integration tests.


Requires a running Redis instance before executing the tests.
*/

process.env.SCRAPE_QUEUE_NAME = "book-scraper-jobrunner-test";

const { Queue } = require("bullmq");
const redisConfig = require("../../src/config/redis");
const StrategyRunner = require("../../src/runner/StrategyRunner");

jest.mock("../../src/runner/StrategyRunner");
jest.mock("axios");
const axios = require("axios");

describe("JobRunner (integração real: Worker + callback para o Laravel)", () => {
  let queue;
  let jobRunnerWorker;

  beforeAll(() => {
    queue = new Queue("book-scraper-jobrunner-test", { connection: redisConfig });
    // Carregar o JobRunner real arranca logo o Worker de produção sobre a
    // fila isolada acima (side effect do require - não há require.main
    // guard neste ficheiro, ao contrário de app.js).
    jobRunnerWorker = require("../../src/runner/JobRunner");
  });

  afterEach(async () => {
    await queue.drain(true);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await jobRunnerWorker.close();
    await queue.close();
  });

  function waitForCallback() {
    return new Promise((resolve) => {
      axios.post.mockImplementationOnce((url, payload) => {
        resolve({ url, payload });
        return Promise.resolve({ data: {} });
      });
    });
  }

  test("job concluído sem falhas -> callback com status 'completed'", async () => {
    StrategyRunner.run.mockResolvedValue({ sentCount: 3, failedEntries: [] });
    const callbackReceived = waitForCallback();

    await queue.add(
      "scrape-job",
      {
        strategy: "single_school",
        school: "Escola Teste",
        callback_url: "http://host.docker.internal:8000/api/book-scraper/callback",
        run_token: "run-token-jobrunner-sucesso",
      },
      { attempts: 1 },
    );

    const { url, payload } = await callbackReceived;

    expect(url).toBe("http://host.docker.internal:8000/api/book-scraper/callback");
    expect(payload).toEqual(
      expect.objectContaining({
        status: "completed",
        books: [],
        final: true,
        run_token: "run-token-jobrunner-sucesso",
      }),
    );
  });

  test("job concluído com escolas falhadas -> callback com status 'failed' e detalhe do erro", async () => {
    const failedEntries = [{ school: { name: "Escola Falhada" }, error: "timeout", items: [] }];
    StrategyRunner.run.mockResolvedValue({ sentCount: 1, failedEntries });
    const callbackReceived = waitForCallback();

    await queue.add(
      "scrape-job",
      {
        strategy: "single_school",
        school: "Escola Teste",
        callback_url: "http://host.docker.internal:8000/api/book-scraper/callback",
        run_token: "run-token-jobrunner-parcial",
      },
      { attempts: 1 },
    );

    const { payload } = await callbackReceived;

    expect(payload.status).toBe("failed");
    expect(payload.books).toEqual(failedEntries);
    expect(payload.error).toMatch(/Escola Falhada: timeout/);
  });

  test("StrategyRunner.run rejeita na última tentativa -> callback de falha permanente", async () => {
    StrategyRunner.run.mockRejectedValue(new Error("Browser crashed"));
    const callbackReceived = waitForCallback();

    // attempts: 1 força que a primeira falha seja já a tentativa final,
    // evitando esperar pelo backoff exponencial de um retry.
    await queue.add(
      "scrape-job",
      {
        strategy: "single_school",
        school: "Escola Teste",
        callback_url: "http://host.docker.internal:8000/api/book-scraper/callback",
        run_token: "run-token-jobrunner-falha-permanente",
      },
      { attempts: 1 },
    );

    const { payload } = await callbackReceived;

    expect(payload.status).toBe("failed");
    expect(payload.final).toBe(true);
    expect(payload.error).toBe("Browser crashed");
  });
});
