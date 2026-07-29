"use strict";

/**
 * Integration tests for the POST /scrape endpoint.
 *
 * Verifies that a request creates a real job in the BullMQ
 * book-scraper queue backed by Redis.
 *
 * Requires a running Redis instance before executing the tests.
 */

const request = require("supertest");
const { Queue } = require("bullmq");
const redisConfig = require("../../src/config/redis");
const app = require("../../src/app");
// ScrapeQueue is a singleton that opens its own Redis connection when
// the application is loaded. The connection must be closed after the tests
// to avoid open handles in Jest.
const scrapeQueue = require("../../src/queue/ScrapeQueue");

describe("POST /scrape (integração com BullMQ/Redis)", () => {
  let queue;

  beforeAll(() => {
    queue = new Queue("book-scraper", { connection: redisConfig });
  });

  afterEach(async () => {
    // Prevent jobs from one test affecting the next test.
    await queue.drain(true);
  });

  afterAll(async () => {
    await queue.close();
  });

  test("cria um job na fila book-scraper com os dados do pedido", async () => {
    const payload = {
      strategy: "single_school",
      year: "5º Ano",
      teaching_cycle: "2º Ciclo",
      district: "Porto",
      city: "Ermesinde",
      school: "Escola Teste",
      callback_url:
        "http://host.docker.internal:8000/api/book-scraper/callback",
      run_token: "run-token-teste-123",
    };

    const response = await request(app).post("/scrape").send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty("job_tokens");
    expect(Array.isArray(response.body.job_tokens)).toBe(true);
    expect(response.body.job_tokens.length).toBeGreaterThan(0);

    // Verify that the job exists in Redis, not only in the HTTP response.
    const jobId = response.body.job_tokens[0];
    const job = await queue.getJob(jobId);

    expect(job).not.toBeNull();
    expect(job.data.strategy).toBe(payload.strategy);
    expect(job.data.school).toBe(payload.school);
    expect(job.data.run_token).toBe(payload.run_token);
    expect(job.data.callback_url).toBe(payload.callback_url);
  });

  test("rejeita sincronamente um pedido sem callback_url, sem chegar a criar job", async () => {
    const payload = {
      strategy: "single_school",
      year: "5º Ano",
      district: "Porto",
      city: "Ermesinde",
      school: "Escola Teste",
      run_token: "run-token-teste-sem-callback",
      // callback_url em falta de propósito
    };

    const response = await request(app).post("/scrape").send(payload);

    expect(response.status).toBe(400);
    expect(response.body.details.join(" ")).toMatch(/callback_url/);

    // callback_url intentionally omitted

    // Ensure the request was rejected before reaching the queue.
    // Search for the specific run token instead of checking the total
    // queue size to keep the assertion isolated from other tests.
    const pendingJobs = await queue.getJobs(["waiting", "active"]);
    const leakedJob = pendingJobs.find(
      (job) => job.data.run_token === payload.run_token,
    );
    expect(leakedJob).toBeUndefined();
  });

  test("rejeita uma estratégia desconhecida", async () => {
    const response = await request(app).post("/scrape").send({
      strategy: "estrategia_inexistente",
      callback_url:
        "http://host.docker.internal:8000/api/book-scraper/callback",
      run_token: "run-token-teste-invalido",
    });

    expect(response.status).toBe(400);
    expect(response.body.details.join(" ")).toMatch(/Unknown 'strategy' value/);
  });
});

describe("GET /scrape/:id (integração com BullMQ/Redis)", () => {
  let queue;

  beforeAll(() => {
    queue = new Queue("book-scraper", { connection: redisConfig });
  });

  afterEach(async () => {
    await queue.drain(true);
  });

  afterAll(async () => {
    await queue.close();
  });

  test("devolve o estado e progresso de um job existente", async () => {
    const job = await queue.add(
      "scrape-job",
      {
        strategy: "single_school",
        school: "Escola Teste",
        callback_url:
          "http://host.docker.internal:8000/api/book-scraper/callback",
        run_token: "run-token-status-teste",
      },
      // Without a worker consuming the queue, the job remains in waiting state.
      {},
    );

    const response = await request(app).get(`/scrape/${job.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: job.id.toString(),
        state: "waiting",
      }),
    );
  });

  test("devolve 404 para um job inexistente", async () => {
    const response = await request(app).get("/scrape/id-que-nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

// Close the shared ScrapeQueue singleton after all tests finish.
// It is used by both test suites, so closing it earlier would leave
// subsequent tests without a Redis connection.
afterAll(async () => {
  await scrapeQueue.queue.close();
});
