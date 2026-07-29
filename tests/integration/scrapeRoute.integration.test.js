"use strict";

/**
 * Integration tests for the POST /scrape endpoint.
 *
 * Verifies that a request creates a real job in the BullMQ
 * queue backed by Redis.
 *
 * Requires a running Redis instance before executing the tests.
 */

process.env.SCRAPE_QUEUE_NAME = "book-scraper-route-test";

const request = require("supertest");
const app = require("../../src/app");
const scrapeQueue = require("../../src/queue/ScrapeQueue");

const queue = scrapeQueue.queue;

describe("POST /scrape (integração com BullMQ/Redis)", () => {
  afterEach(async () => {
    // Prevent jobs from one test affecting the next test.
    await queue.drain(true);
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
    expect(job.data).toEqual(
      expect.objectContaining({
        strategy: payload.strategy,
        school: payload.school,
        run_token: payload.run_token,
        callback_url: payload.callback_url,
      }),
    );
  });

  test("rejeita sincronamente um pedido sem callback_url, sem chegar a criar job", async () => {
    const payload = {
      strategy: "single_school",
      year: "5º Ano",
      district: "Porto",
      city: "Ermesinde",
      school: "Escola Teste",
      run_token: "run-token-teste-sem-callback",
      // callback_url intentionally omitted
    };

    const response = await request(app).post("/scrape").send(payload);

    expect(response.status).toBe(400);
    expect(response.body.details.join(" ")).toMatch(/callback_url/);

    // Ensure the request was rejected before reaching the queue.
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
  afterEach(async () => {
    await queue.drain(true);
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
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
  });
});

// Close the shared ScrapeQueue singleton after all tests finish.
afterAll(async () => {
  await queue.close();
});
