jest.mock('../../../src/utils/LaneContext', () => ({
  withLaneContext: jest.fn((browserManager, fn) => fn({ __fakeContext: true })),
}));

const DiscoveryRunner = require('../../../src/runner/DiscoveryRunner');

function makeBrowserManager(pages) {
  let index = 0;
  return {
    openPageInContext: jest.fn(async () => pages[index++] || makePage()),
  };
}

function makePage() {
  return { close: jest.fn().mockResolvedValue() };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
});

describe('DiscoveryRunner.run — validação de argumentos', () => {
  test('lança erro se não receber um browserManager', async () => {
    await expect(DiscoveryRunner.run(['A'], { discoverUnit: jest.fn() }))
      .rejects.toThrow(/browserManager is required/);
  });

  test('lança erro se não receber discoverUnit', async () => {
    await expect(DiscoveryRunner.run(['A'], { browserManager: {} }))
      .rejects.toThrow(/discoverUnit is required/);
  });

  test('devolve lista vazia se não houver unidades a descobrir', async () => {
    const result = await DiscoveryRunner.run([], {
      browserManager: {},
      discoverUnit: jest.fn(),
    });
    expect(result).toEqual([]);
  });
});

describe('DiscoveryRunner.run — distribuição por lanes', () => {
  test('reparte as unidades pelas lanes disponíveis, sem exceder o número de unidades', async () => {
    const browserManager = makeBrowserManager([makePage(), makePage()]);
    const discoverUnit = jest.fn(async (page, unit) => [`resultado-${unit}`]);

    // 2 unidades, mas laneCount pedido é 4 -> só 2 lanes com trabalho.
    const results = await DiscoveryRunner.run(['A', 'B'], {
      browserManager,
      discoverUnit,
      laneCount: 4,
    });

    expect(results.sort()).toEqual(['resultado-A', 'resultado-B']);
    expect(browserManager.openPageInContext).toHaveBeenCalledTimes(2);
  });

  test('junta os resultados de todas as lanes (flat)', async () => {
    const browserManager = makeBrowserManager([makePage(), makePage()]);
    const discoverUnit = jest.fn(async (page, unit) => [`${unit}-1`, `${unit}-2`]);

    const results = await DiscoveryRunner.run(['A', 'B'], {
      browserManager,
      discoverUnit,
      laneCount: 2,
    });

    expect(results.sort()).toEqual(['A-1', 'A-2', 'B-1', 'B-2']);
  });

  test('chama setupLane uma vez por lane antes de descobrir as unidades', async () => {
    const browserManager = makeBrowserManager([makePage()]);
    const setupLane = jest.fn().mockResolvedValue();
    const discoverUnit = jest.fn().mockResolvedValue([]);

    await DiscoveryRunner.run(['A'], { browserManager, setupLane, discoverUnit, laneCount: 1 });

    expect(setupLane).toHaveBeenCalledTimes(1);
  });

  test('não falha se setupLane não for fornecido', async () => {
    const browserManager = makeBrowserManager([makePage()]);
    const discoverUnit = jest.fn().mockResolvedValue([]);

    await expect(
      DiscoveryRunner.run(['A'], { browserManager, discoverUnit, laneCount: 1 }),
    ).resolves.toEqual([]);
  });

  test('ignora unidades cujo discoverUnit devolve lista vazia', async () => {
    const browserManager = makeBrowserManager([makePage()]);
    const discoverUnit = jest.fn().mockResolvedValue([]);

    const results = await DiscoveryRunner.run(['A', 'B'], {
      browserManager,
      discoverUnit,
      laneCount: 1,
    });

    expect(results).toEqual([]);
  });

  test('fecha sempre a página da lane no final, mesmo que discoverUnit falhe', async () => {
    const page = makePage();
    const browserManager = makeBrowserManager([page]);
    const discoverUnit = jest.fn().mockRejectedValue(new Error('falha na descoberta'));

    await expect(
      DiscoveryRunner.run(['A'], { browserManager, discoverUnit, laneCount: 1 }),
    ).rejects.toThrow('falha na descoberta');

    expect(page.close).toHaveBeenCalledTimes(1);
  });
});
