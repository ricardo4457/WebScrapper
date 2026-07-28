const { createStrategy, isValidStrategy, STRATEGY_NAMES } = require('../../../src/strategies/StrategyFactory');
const SingleSchoolStrategy = require('../../../src/strategies/implementations/SingleSchoolStrategy');

// Parâmetros mínimos válidos para instanciar uma SingleSchoolStrategy
// (createScrapeTask exige year/district/city/school).
const SINGLE_SCHOOL_PARAMS = Object.freeze({
  year: '5º Ano',
  district: 'Porto',
  city: 'Valongo',
  school: 'EB1 de Ermesinde',
});

describe('StrategyFactory.createStrategy', () => {
  test("createStrategy('single_school') devolve instância correta", () => {
    const strategy = createStrategy('single_school', SINGLE_SCHOOL_PARAMS);
    expect(strategy).toBeInstanceOf(SingleSchoolStrategy);
    expect(typeof strategy.execute).toBe('function');
    expect(typeof strategy.getTasks).toBe('function');
  });

  test("createStrategy('inexistente') lança erro", () => {
    expect(() => createStrategy('inexistente'))
      .toThrow(/Unknown scraping strategy 'inexistente'/);
  });

  test('full_curriculum/all_years já não existem na factory', () => {
    expect(isValidStrategy('full_curriculum')).toBe(false);
    expect(isValidStrategy('all_years')).toBe(false);
    expect(STRATEGY_NAMES).not.toContain('full_curriculum');
    expect(STRATEGY_NAMES).not.toContain('all_years');

    expect(() => createStrategy('full_curriculum'))
      .toThrow(/Unknown scraping strategy/);
    expect(() => createStrategy('all_years'))
      .toThrow(/Unknown scraping strategy/);
  });

  test('apenas as estratégias suportadas atualmente estão registadas', () => {
    const expectedStrategies = ['full_city', 'full_district', 'single_school', 'single_school_tooltip'];
    expect([...STRATEGY_NAMES].sort()).toEqual(expectedStrategies.sort());
  });
});