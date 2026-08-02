jest.mock('../../../src/strategies', () => ({
  createStrategy: jest.fn(),
}));
jest.mock('../../../src/scrapper/browser', () => ({
  BrowserManager: jest.fn(),
}));
jest.mock('../../../src/payloads/BookPayload', () => ({
  buildImportPayload: jest.fn((task, books) => ({ school: task.school, books })),
}));
jest.mock('../../../src/scrapper/humanization', () => ({
  humanDelay: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../src/services/ResultBatchService');
jest.mock('../../../src/utils/LaneContext', () => ({
  withLaneContext: jest.fn((browserManager, fn) => fn({ __fakeContext: true })),
}));

const { createStrategy } = require('../../../src/strategies');
const { BrowserManager } = require('../../../src/scrapper/browser');
const bookPayload = require('../../../src/payloads/BookPayload');
const { humanDelay } = require('../../../src/scrapper/humanization');
const ResultBatchService = require('../../../src/services/ResultBatchService');
const { withLaneContext } = require('../../../src/utils/LaneContext');
const { BlockDetectedError } = require('../../../src/scrapper/blockDetection');
const StrategyRunner = require('../../../src/runner/StrategyRunner');

function makeTask(overrides = {}) {
  return {
    year: '2026/2027', teaching_cycle: '3º Ciclo', course: null,
    district: 'Porto', city: 'Valongo', school: 'Escola A',
    ...overrides,
  };
}

function makePage() {
  return { close: jest.fn().mockResolvedValue() };
}

function makeBrowserManagerInstance({ tasks = [], pages } = {}) {
  const openedPages = pages || tasks.map(() => makePage());
  let idx = 0;
  const instance = {
    launch: jest.fn().mockResolvedValue(),
    openBasePage: jest.fn().mockResolvedValue(makePage()),
    openPageInContext: jest.fn(async () => openedPages[idx++] || makePage()),
    resetToBasePage: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue(),
  };
  return instance;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('StrategyRunner.run — sem tarefas', () => {
  test('devolve sentCount 0 e não corre nenhuma lane quando getTasks devolve []', async () => {
    const strategy = { getTasks: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    const browserManagerInstance = makeBrowserManagerInstance();
    BrowserManager.mockImplementation(() => browserManagerInstance);

    const result = await StrategyRunner.run({ strategy: 'single_school', district: 'Porto' });

    expect(result).toEqual({ sentCount: 0, failedEntries: [] });
    expect(withLaneContext).not.toHaveBeenCalled();
  });

  test('fecha sempre o browser, mesmo sem tarefas', async () => {
    const strategy = { getTasks: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    const browserManagerInstance = makeBrowserManagerInstance();
    BrowserManager.mockImplementation(() => browserManagerInstance);

    await StrategyRunner.run({ strategy: 'single_school' });

    expect(browserManagerInstance.close).toHaveBeenCalledTimes(1);
  });
});

describe('StrategyRunner.run — orquestração geral', () => {
  test('lança o browser, descobre as tarefas com a página de discovery, e fecha-a depois', async () => {
    const tasks = [makeTask({ school: 'Escola A' })];
    const strategy = { getTasks: jest.fn().mockResolvedValue(tasks), execute: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    const discoveryPage = makePage();
    const browserManagerInstance = makeBrowserManagerInstance();
    browserManagerInstance.openBasePage.mockResolvedValue(discoveryPage);
    BrowserManager.mockImplementation(() => browserManagerInstance);

    ResultBatchService.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(),
      flush: jest.fn().mockResolvedValue(),
      getSentCount: jest.fn().mockReturnValue(1),
      getFailedEntries: jest.fn().mockReturnValue([]),
    }));

    await StrategyRunner.run({ strategy: 'single_school', district: 'Porto' });

    expect(browserManagerInstance.launch).toHaveBeenCalledTimes(1);
    expect(strategy.getTasks).toHaveBeenCalledWith(discoveryPage, { browserManager: browserManagerInstance });
    expect(discoveryPage.close).toHaveBeenCalledTimes(1);
  });

  test('devolve sentCount/failedEntries a partir do ResultBatchService, e chama flush("partial") no final', async () => {
    const tasks = [makeTask()];
    const strategy = { getTasks: jest.fn().mockResolvedValue(tasks), execute: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    BrowserManager.mockImplementation(() => makeBrowserManagerInstance());

    const flush = jest.fn().mockResolvedValue();
    ResultBatchService.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(),
      flush,
      getSentCount: jest.fn().mockReturnValue(5),
      getFailedEntries: jest.fn().mockReturnValue([{ school: { name: 'Escola X' } }]),
    }));

    const result = await StrategyRunner.run({ strategy: 'single_school' });

    expect(flush).toHaveBeenCalledWith('partial');
    expect(result).toEqual({ sentCount: 5, failedEntries: [{ school: { name: 'Escola X' } }] });
  });

  test('fecha sempre o browser, mesmo que uma lane rebente com um erro inesperado', async () => {
    const tasks = [makeTask()];
    const strategy = {
      getTasks: jest.fn().mockResolvedValue(tasks),
      execute: jest.fn().mockRejectedValue(new Error('erro inesperado')),
    };
    createStrategy.mockReturnValue(strategy);
    const browserManagerInstance = makeBrowserManagerInstance();
    BrowserManager.mockImplementation(() => browserManagerInstance);
    ResultBatchService.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(),
      flush: jest.fn().mockResolvedValue(),
      getSentCount: jest.fn().mockReturnValue(0),
      getFailedEntries: jest.fn().mockReturnValue([]),
    }));

    await StrategyRunner.run({ strategy: 'single_school' });

    expect(browserManagerInstance.close).toHaveBeenCalledTimes(1);
  });

  test('reporta o progresso com o total de tarefas descobertas', async () => {
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B' })];
    const strategy = { getTasks: jest.fn().mockResolvedValue(tasks), execute: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    BrowserManager.mockImplementation(() => makeBrowserManagerInstance());
    ResultBatchService.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(),
      flush: jest.fn().mockResolvedValue(),
      getSentCount: jest.fn().mockReturnValue(2),
      getFailedEntries: jest.fn().mockReturnValue([]),
    }));

    const onProgress = jest.fn().mockResolvedValue();
    await StrategyRunner.run({ strategy: 'single_school', concurrency: 1 }, { onProgress });

    expect(onProgress).toHaveBeenCalledWith(expect.any(Number), 2);
  });

  test('uma falha no callback onProgress não interrompe o scraping', async () => {
    const tasks = [makeTask()];
    const strategy = { getTasks: jest.fn().mockResolvedValue(tasks), execute: jest.fn().mockResolvedValue([]) };
    createStrategy.mockReturnValue(strategy);
    BrowserManager.mockImplementation(() => makeBrowserManagerInstance());
    ResultBatchService.mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(),
      flush: jest.fn().mockResolvedValue(),
      getSentCount: jest.fn().mockReturnValue(1),
      getFailedEntries: jest.fn().mockReturnValue([]),
    }));

    const onProgress = jest.fn().mockRejectedValue(new Error('falha no progresso'));

    await expect(
      StrategyRunner.run({ strategy: 'single_school' }, { onProgress }),
    ).resolves.toEqual({ sentCount: 1, failedEntries: [] });
  });
});

// --- StrategyRunner._runLane -------------------------------------------------

function makeState(batchServiceOverrides = {}) {
  return {
    completedCount: 0,
    blocked: null,
    batchService: {
      add: jest.fn().mockResolvedValue(),
      ...batchServiceOverrides,
    },
  };
}

describe('StrategyRunner._runLane', () => {
  test('não chama humanDelay antes da primeira tarefa da lane', async () => {
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn() };
    const reportProgress = jest.fn().mockResolvedValue();

    await StrategyRunner._runLane([makeTask()], { strategy, browserManager, state, totalTasks: 1, reportProgress, timings: null });

    expect(humanDelay).not.toHaveBeenCalled();
  });

  test('chama humanDelay(800, 2000) entre a 1ª e a 2ª tarefa da lane', async () => {
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn().mockResolvedValue() };
    const reportProgress = jest.fn().mockResolvedValue();
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B', city: 'Gondomar' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 2, reportProgress, timings: null });

    expect(humanDelay).toHaveBeenCalledWith(800, 2000);
  });

  test('reutiliza a navegação (não chama resetToBasePage) quando a tarefa seguinte é da mesma localização', async () => {
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn().mockResolvedValue() };
    const reportProgress = jest.fn().mockResolvedValue();
    // Mesma localização (district/city/year/teaching_cycle/course iguais), escolas diferentes.
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 2, reportProgress, timings: null });

    expect(browserManager.resetToBasePage).not.toHaveBeenCalled();
  });

  test('reinicia a navegação (chama resetToBasePage) ao mudar de localização', async () => {
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn().mockResolvedValue() };
    const reportProgress = jest.fn().mockResolvedValue();
    const tasks = [makeTask({ school: 'A', city: 'Valongo' }), makeTask({ school: 'B', city: 'Gondomar' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 2, reportProgress, timings: null });

    expect(browserManager.resetToBasePage).toHaveBeenCalledTimes(1);
  });

  test('converte os livros extraídos em payload e adiciona-os ao ResultBatchService', async () => {
    const books = [{ title: 'Manual X' }];
    const strategy = { execute: jest.fn().mockResolvedValue(books) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn() };
    const reportProgress = jest.fn().mockResolvedValue();
    const task = makeTask({ school: 'A' });

    await StrategyRunner._runLane([task], { strategy, browserManager, state, totalTasks: 1, reportProgress, timings: null });

    expect(bookPayload.buildImportPayload).toHaveBeenCalledWith(task, books);
    expect(state.batchService.add).toHaveBeenCalledWith({ school: 'A', books });
    expect(state.completedCount).toBe(1);
  });

  test('quando o site bloqueia (BlockDetectedError), marca state.blocked e aborta as restantes tarefas da lane', async () => {
    const strategy = {
      execute: jest.fn()
        .mockResolvedValueOnce([]) // 1ª tarefa OK
        .mockRejectedValueOnce(new BlockDetectedError('HTTP 403')), // 2ª bloqueada
    };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn().mockResolvedValue() };
    const reportProgress = jest.fn().mockResolvedValue();
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B' }), makeTask({ school: 'C' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 3, reportProgress, timings: null });

    expect(state.blocked).toBe('HTTP 403');
    // A 3ª tarefa (C) nunca chegou a ser executada, mas conta como abortada.
    expect(strategy.execute).toHaveBeenCalledTimes(2);
    expect(state.batchService.add).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Batch aborted due to site blocking') }),
      { isError: true },
    );
  });

  test('outra lane já ter marcado state.blocked interrompe esta lane sem executar mais nada', async () => {
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    state.blocked = 'HTTP 429 (detetado noutra lane)';
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(makePage()), resetToBasePage: jest.fn() };
    const reportProgress = jest.fn().mockResolvedValue();
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 2, reportProgress, timings: null });

    expect(strategy.execute).not.toHaveBeenCalled();
    expect(state.batchService.add).toHaveBeenCalledTimes(2);
  });

  test('um erro normal (não bloqueio) numa tarefa não interrompe a lane: recria a página e continua', async () => {
    const strategy = {
      execute: jest.fn()
        .mockRejectedValueOnce(new Error('falha ao extrair livros'))
        .mockResolvedValueOnce([{ title: 'Manual Y' }]),
    };
    const state = makeState();
    const pages = [makePage(), makePage()];
    let idx = 0;
    const browserManager = {
      openPageInContext: jest.fn(async () => pages[idx++]),
      resetToBasePage: jest.fn().mockResolvedValue(),
    };
    const reportProgress = jest.fn().mockResolvedValue();
    const tasks = [makeTask({ school: 'A' }), makeTask({ school: 'B' })];

    await StrategyRunner._runLane(tasks, { strategy, browserManager, state, totalTasks: 2, reportProgress, timings: null });

    expect(strategy.execute).toHaveBeenCalledTimes(2);
    expect(pages[0].close).toHaveBeenCalled();
    expect(state.batchService.add).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'falha ao extrair livros' }),
      { isError: true },
    );
    expect(state.completedCount).toBe(2);
  });

  test('fecha sempre a página da lane no final', async () => {
    const page = makePage();
    const strategy = { execute: jest.fn().mockResolvedValue([]) };
    const state = makeState();
    const browserManager = { openPageInContext: jest.fn().mockResolvedValue(page), resetToBasePage: jest.fn() };
    const reportProgress = jest.fn().mockResolvedValue();

    await StrategyRunner._runLane([makeTask()], { strategy, browserManager, state, totalTasks: 1, reportProgress, timings: null });

    expect(page.close).toHaveBeenCalledTimes(1);
  });
});
