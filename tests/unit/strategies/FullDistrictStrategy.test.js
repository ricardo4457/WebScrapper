jest.mock('../../../src/scrapper/scraper', () => ({
  selectYearAndCycle: jest.fn().mockResolvedValue(),
  selectDistrict: jest.fn().mockResolvedValue(),
  selectCity: jest.fn().mockResolvedValue(),
  discoverCities: jest.fn().mockResolvedValue(['Valongo', 'Gondomar']),
  discoverSchools: jest.fn().mockResolvedValue(['Escola A']),
  waitForLoadingToFinish: jest.fn().mockResolvedValue(),
  returnToSchoolSelection: jest.fn().mockResolvedValue(),
  scrapeSchool: jest.fn().mockResolvedValue([{ title: 'Manual X' }]),
  navigateToLocation: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../src/scrapper/blockDetection', () => {
  const actual = jest.requireActual('../../../src/scrapper/blockDetection');
  return { ...actual, assertNotBlocked: jest.fn().mockResolvedValue() };
});
jest.mock('../../../src/runner/DiscoveryRunner', () => ({
  run: jest.fn(),
}));

const scraper = require('../../../src/scrapper/scraper');
const { BlockDetectedError } = require('../../../src/scrapper/blockDetection');
const DiscoveryRunner = require('../../../src/runner/DiscoveryRunner');
const FullDistrictStrategy = require('../../../src/strategies/implementations/FullDistrictStrategy');

const baseParams = { year: '2026/2027', teaching_cycle: '3º Ciclo', district: 'Porto' };

function makePage() {
  return { goto: jest.fn().mockResolvedValue({ status: () => 200 }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  scraper.discoverCities.mockResolvedValue(['Valongo', 'Gondomar']);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FullDistrictStrategy — constructor', () => {
  test('exige district obrigatório', () => {
    expect(() => new FullDistrictStrategy({ year: '2026/2027' })).toThrow();
  });
});

describe('FullDistrictStrategy.getTasks', () => {
  test('exige uma page', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    await expect(strategy.getTasks(null, { browserManager: {} }))
      .rejects.toThrow(/a live page is required/);
  });

  test('exige um browserManager', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    await expect(strategy.getTasks(makePage(), {}))
      .rejects.toThrow(/a browserManager is required/);
  });

  test('descobre as cidades do distrito e delega a descoberta de escolas ao DiscoveryRunner', async () => {
    DiscoveryRunner.run.mockResolvedValue([
      { year: '2026/2027', teaching_cycle: '3º Ciclo', district: 'Porto', city: 'Valongo', school: 'Escola A' },
    ]);
    const strategy = new FullDistrictStrategy(baseParams);
    const page = makePage();
    const browserManager = {};

    const tasks = await strategy.getTasks(page, { browserManager });

    expect(scraper.discoverCities).toHaveBeenCalledWith(page);
    expect(DiscoveryRunner.run).toHaveBeenCalledWith(
      ['Valongo', 'Gondomar'],
      expect.objectContaining({ browserManager, laneCount: 4 }),
    );
    expect(tasks).toHaveLength(1);
  });

  test('remove tarefas duplicadas devolvidas pelo DiscoveryRunner', async () => {
    const duplicated = {
      year: '2026/2027', teaching_cycle: '3º Ciclo', district: 'Porto', city: 'Valongo', school: 'Escola A',
    };
    DiscoveryRunner.run.mockResolvedValue([duplicated, { ...duplicated }]);
    const strategy = new FullDistrictStrategy(baseParams);

    const tasks = await strategy.getTasks(makePage(), { browserManager: {} });

    expect(tasks).toHaveLength(1);
  });

  test('não repete a descoberta em chamadas seguintes (usa cache)', async () => {
    DiscoveryRunner.run.mockResolvedValue([]);
    const strategy = new FullDistrictStrategy(baseParams);
    const page = makePage();

    await strategy.getTasks(page, { browserManager: {} });
    await strategy.getTasks(page, { browserManager: {} });

    expect(scraper.discoverCities).toHaveBeenCalledTimes(1);
    expect(DiscoveryRunner.run).toHaveBeenCalledTimes(1);
  });

  test('o discoverUnit passado ao DiscoveryRunner seleciona a cidade e devolve uma tarefa por escola', async () => {
    let capturedDiscoverUnit;
    DiscoveryRunner.run.mockImplementation(async (cities, options) => {
      capturedDiscoverUnit = options.discoverUnit;
      return [];
    });
    const strategy = new FullDistrictStrategy(baseParams);
    await strategy.getTasks(makePage(), { browserManager: {} });

    const lanePage = {};
    scraper.discoverSchools.mockResolvedValue(['Escola X', 'Escola Y']);
    const result = await capturedDiscoverUnit(lanePage, 'Valongo');

    expect(scraper.selectCity).toHaveBeenCalledWith(lanePage, 'Valongo');
    expect(result.map((t) => t.school)).toEqual(['Escola X', 'Escola Y']);
    expect(result.every((t) => t.city === 'Valongo')).toBe(true);
  });
});

describe('FullDistrictStrategy.execute', () => {
  test('sem sameLocation, navega para o local antes de raspar a escola', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola A', city: 'Valongo', district: 'Porto' };

    await strategy.execute(page, task, { sameLocation: false });

    expect(scraper.navigateToLocation).toHaveBeenCalledWith(page, task);
    expect(scraper.scrapeSchool).toHaveBeenCalledWith(page, task);
  });

  test('com sameLocation, usa o caminho rápido e não navega de novo', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola A', city: 'Valongo', district: 'Porto' };

    await strategy.execute(page, task, { sameLocation: true });

    expect(scraper.returnToSchoolSelection).toHaveBeenCalledWith(page);
    expect(scraper.navigateToLocation).not.toHaveBeenCalled();
  });

  test('recorre à navegação completa se o caminho rápido falhar com um erro normal', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola A', city: 'Valongo', district: 'Porto' };
    scraper.returnToSchoolSelection.mockRejectedValueOnce(new Error('falha'));

    await strategy.execute(page, task, { sameLocation: true });

    expect(scraper.navigateToLocation).toHaveBeenCalledWith(page, task);
  });

  test('propaga BlockDetectedError do caminho rápido sem recorrer à navegação completa', async () => {
    const strategy = new FullDistrictStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola A', city: 'Valongo', district: 'Porto' };
    scraper.returnToSchoolSelection.mockRejectedValueOnce(new BlockDetectedError('HTTP 403'));

    await expect(strategy.execute(page, task, { sameLocation: true })).rejects.toThrow(BlockDetectedError);
    expect(scraper.navigateToLocation).not.toHaveBeenCalled();
  });
});
