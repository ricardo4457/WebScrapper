// Mock the HTTP callback layer so tests stay fully local and deterministic.
jest.mock("../../src/services/ScrapeCallback", () => ({
  send: jest.fn().mockResolvedValue(),
}));

const scrapeCallback = require("../../src/services/ScrapeCallback");
const ResultBatchService = require("../../src/services/ResultBatchService");

// Creates a ResultBatchService instance with sensible defaults for tests.
function makeService(overrides = {}) {
  return new ResultBatchService({
    callbackUrl: "https://laravel.local/callback",
    runToken: "run-token-123",
    jobToken: "job-1",
    ...overrides,
  });
}

beforeEach(() => {
  // Isolate call history between tests.
  scrapeCallback.send.mockClear();
});

describe("ResultBatchService.add", () => {
  // Items stay buffered until the batch threshold is reached.
  test("não envia nada enquanto o buffer não atinge o batchSize", async () => {
    const service = makeService({ batchSize: 3 });
    await service.add({ school: "A" });
    await service.add({ school: "B" });

    expect(scrapeCallback.send).not.toHaveBeenCalled();
  });

  // Reaching batchSize triggers an automatic partial flush.
  test("faz flush automático assim que o buffer atinge o batchSize", async () => {
    const service = makeService({ batchSize: 2 });
    await service.add({ school: "A" });
    await service.add({ school: "B" });

    expect(scrapeCallback.send).toHaveBeenCalledTimes(1);
    const [, payload] = scrapeCallback.send.mock.calls[0];
    expect(payload.books).toHaveLength(2);
    expect(payload.status).toBe("partial");
  });

  // Failed entries are tracked separately from the normal batch buffer.
  test("guarda entradas marcadas como erro em getFailedEntries, sem afetar o buffer normal", async () => {
    const service = makeService({ batchSize: 10 });
    const entradaOk = { school: "A" };
    const entradaErro = { school: "B", error: "falhou" };

    await service.add(entradaOk);
    await service.add(entradaErro, { isError: true });

    expect(service.getFailedEntries()).toEqual([entradaErro]);
  });

  // getFailedEntries() must return a defensive copy, not the internal array.
  test("getFailedEntries devolve uma cópia, não a referência interna", async () => {
    const service = makeService({ batchSize: 10 });
    await service.add({ school: "A", error: "x" }, { isError: true });

    const failed = service.getFailedEntries();
    failed.push({ school: "intruso" });

    expect(service.getFailedEntries()).toHaveLength(1);
  });
});

describe("ResultBatchService.flush", () => {
  // Flushing an empty buffer should be a no-op.
  test("não chama o callback quando o buffer está vazio", async () => {
    const service = makeService();
    await service.flush("final");
    expect(scrapeCallback.send).not.toHaveBeenCalled();
  });

  // Flush payload must include the identifiers required by the Laravel callback.
  test("envia o job_token, attempt e run_token corretos no payload", async () => {
    const service = makeService({
      jobToken: "job-42",
      attempt: 1,
      batchSize: 10,
    });
    await service.add({ school: "A" });
    await service.flush("final");

    const [url, payload, runToken] = scrapeCallback.send.mock.calls[0];
    expect(url).toBe("https://laravel.local/callback");
    expect(payload.job_token).toBe("job-42");
    expect(payload.attempt).toBe(1);
    expect(payload.status).toBe("final");
    expect(runToken).toBe("run-token-123");
  });

  // After a flush, the buffer is cleared and entries are not resent.
  test("esvazia o buffer após o flush, sem reenviar as mesmas entradas", async () => {
    const service = makeService({ batchSize: 10 });
    await service.add({ school: "A" });
    await service.flush("partial");
    await service.flush("partial");

    expect(scrapeCallback.send).toHaveBeenCalledTimes(1);
  });

  // sentCount tracks how many entries were actually delivered across flushes.
  test("incrementa getSentCount a cada flush", async () => {
    const service = makeService({ batchSize: 10 });
    await service.add({ school: "A" });
    await service.flush("partial");
    await service.add({ school: "B" });
    await service.add({ school: "C" });
    await service.flush("final");

    expect(service.getSentCount()).toBe(3);
  });
});

describe("ResultBatchService — batchSize inválido", () => {
  // Invalid batch sizes fall back to the default value (100).
  test("usa o valor por omissão (100) quando batchSize é 0 ou negativo", () => {
    const serviceZero = makeService({ batchSize: 0 });
    const serviceNegativo = makeService({ batchSize: -5 });

    expect(serviceZero.batchSize).toBe(100);
    expect(serviceNegativo.batchSize).toBe(100);
  });
});
