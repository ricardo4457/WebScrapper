jest.mock('../../../src/scrapper/scraper', () => ({
  selectYearAndCycle: jest.fn().mockResolvedValue(),
  selectDistrict: jest.fn().mockResolvedValue(),
  selectCity: jest.fn().mockResolvedValue(),
  discoverSchools: jest.fn().mockResolvedValue(['Escola A', 'Escola B']),
  waitForLoadingToFinish: jest.fn().mockResolvedValue(),
  returnToSchoolSelection: jest.fn().mockResolvedValue(),
  scrapeSchool: jest.fn().mockResolvedValue([{ title: 'Manual X' }]),
  navigateToLocation: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../src/scrapper/blockDetection', () => {
  const actual = jest.requireActual('../../../src/scrapper/blockDetection');
  return {
    ...actual,
    assertNotBlocked: jest.fn().mockResolvedValue(),
  };
});

const scraper = require('../../../src/scrapper/scraper');
const { assertNotBlocked, BlockDetectedError } = require('../../../src/scrapper/blockDetection');
const FullCityStrategy = require('../../../src/strategies/implementations/FullCityStrategy');

function makePage() {
  return { goto: jest.fn().mockResolvedValue({ status: () => 200 }) };
}

const baseParams = { year: '2026/2027', teaching_cycle: '3º Ciclo', district: 'Porto', city: 'Valongo' };

beforeEach(() => {
  jest.clearAllMocks();
  scraper.discoverSchools.mockResolvedValue(['Escola A', 'Escola B']);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FullCityStrategy — constructor', () => {
  test('exige district e city obrigatórios', () => {
    expect(() => new FullCityStrategy({ year: '2026/2027' })).toThrow();
    expect(() => new FullCityStrategy({ ...baseParams, city: undefined })).toThrow();
  });
});

describe('FullCityStrategy.getTasks', () => {
  test('exige uma page para descobrir as escolas', async () => {
    const strategy = new FullCityStrategy(baseParams);
    await expect(strategy.getTasks(null)).rejects.toThrow(/a live page is required/);
  });

  test('descobre as escolas da cidade e cria uma tarefa por escola', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = makePage();

    const tasks = await strategy.getTasks(page);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.school)).toEqual(['Escola A', 'Escola B']);
  });

  test('segue a sequência esperada: ano/ciclo, distrito, verificação de bloqueio, cidade', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = makePage();
    const order = [];
    scraper.selectYearAndCycle.mockImplementation(async () => order.push('yearAndCycle'));
    scraper.selectDistrict.mockImplementation(async () => order.push('district'));
    assertNotBlocked.mockImplementation(async () => order.push('assertNotBlocked'));
    scraper.selectCity.mockImplementation(async () => order.push('city'));

    await strategy.getTasks(page);

    expect(order).toEqual(['yearAndCycle', 'district', 'assertNotBlocked', 'city', 'assertNotBlocked', 'assertNotBlocked']);
  });

  test('propaga BlockDetectedError se o site bloquear durante a descoberta', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = makePage();
    assertNotBlocked.mockRejectedValueOnce(new BlockDetectedError('HTTP 403'));

    await expect(strategy.getTasks(page)).rejects.toThrow(BlockDetectedError);
  });

  test('não repete a descoberta em chamadas seguintes (usa cache)', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = makePage();

    await strategy.getTasks(page);
    await strategy.getTasks(page);

    expect(scraper.discoverSchools).toHaveBeenCalledTimes(1);
  });

  test('remove tarefas duplicadas quando discoverSchools devolve escolas repetidas', async () => {
    scraper.discoverSchools.mockResolvedValue(['Escola A', 'Escola A', 'Escola B']);
    const strategy = new FullCityStrategy(baseParams);
    const page = makePage();

    const tasks = await strategy.getTasks(page);

    expect(tasks).toHaveLength(2);
  });
});

describe('FullCityStrategy.execute', () => {
  test('sem sameLocation, navega para o local antes de raspar a escola', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola A', city: 'Valongo', district: 'Porto' };

    await strategy.execute(page, task, { sameLocation: false });

    expect(scraper.navigateToLocation).toHaveBeenCalledWith(page, task);
    expect(scraper.scrapeSchool).toHaveBeenCalledWith(page, task);
    expect(scraper.returnToSchoolSelection).not.toHaveBeenCalled();
  });

  test('com sameLocation, tenta primeiro o caminho rápido (returnToSchoolSelection)', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola B', city: 'Valongo', district: 'Porto' };

    await strategy.execute(page, task, { sameLocation: true });

    expect(scraper.returnToSchoolSelection).toHaveBeenCalledWith(page);
    expect(scraper.navigateToLocation).not.toHaveBeenCalled();
    expect(scraper.scrapeSchool).toHaveBeenCalledWith(page, task);
  });

  test('se o caminho rápido falhar com um erro normal, recorre à navegação completa', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola B', city: 'Valongo', district: 'Porto' };
    scraper.returnToSchoolSelection.mockRejectedValueOnce(new Error('botão de voltar não encontrado'));

    await strategy.execute(page, task, { sameLocation: true });

    expect(scraper.navigateToLocation).toHaveBeenCalledWith(page, task);
    expect(scraper.scrapeSchool).toHaveBeenCalledWith(page, task);
  });

  test('se o caminho rápido detetar bloqueio, propaga o erro sem recorrer à navegação completa', async () => {
    const strategy = new FullCityStrategy(baseParams);
    const page = {};
    const task = { school: 'Escola B', city: 'Valongo', district: 'Porto' };
    scraper.returnToSchoolSelection.mockRejectedValueOnce(new BlockDetectedError('HTTP 429'));

    await expect(strategy.execute(page, task, { sameLocation: true })).rejects.toThrow(BlockDetectedError);
    expect(scraper.navigateToLocation).not.toHaveBeenCalled();
  });
});
