jest.mock('../../../src/scrapper/scraper', () => ({
  selectYearAndCycle: jest.fn().mockResolvedValue(),
  selectDistrict: jest.fn().mockResolvedValue(),
  selectCity: jest.fn().mockResolvedValue(),
  selectSchool: jest.fn().mockResolvedValue(),
  selectCourse: jest.fn().mockResolvedValue(),
  waitForLoadingToFinish: jest.fn().mockResolvedValue(),
  selectAllSubjects: jest.fn().mockResolvedValue(),
  goToBooks: jest.fn().mockResolvedValue(),
  extractBooks: jest.fn().mockResolvedValue([{ title: 'Manual X' }]),
}));

const scraper = require('../../../src/scrapper/scraper');
const SingleSchoolStrategy = require('../../../src/strategies/implementations/SingleSchoolStrategy');
const SingleSchoolStrategyTooltip = require('../../../src/strategies/implementations/SingleSchoolStrategyTooltip');


describe.each([
  ['SingleSchoolStrategy', SingleSchoolStrategy],
  ['SingleSchoolStrategyTooltip', SingleSchoolStrategyTooltip],
])('%s', (_name, Strategy) => {
  const baseParams = {
    year: '2026/2027',
    teaching_cycle: '3º Ciclo',
    district: 'Porto',
    city: 'Valongo',
    school: 'EB1 de Ermesinde',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scraper.extractBooks.mockResolvedValue([{ title: 'Manual X' }]);
  });

  describe('constructor / getTasks', () => {
    test('cria exatamente uma tarefa a partir dos parâmetros dados', () => {
      const strategy = new Strategy(baseParams);
      const tasks = strategy.getTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ school: 'EB1 de Ermesinde', city: 'Valongo' });
    });

    test('getTasks() devolve uma cópia, não a lista interna', () => {
      const strategy = new Strategy(baseParams);
      const tasks = strategy.getTasks();
      tasks.push('intruso');

      expect(strategy.getTasks()).toHaveLength(1);
    });

    test('lança erro logo no construtor se faltar um campo obrigatório (ex.: school)', () => {
      expect(() => new Strategy({ ...baseParams, school: undefined })).toThrow();
    });
  });

  describe('execute()', () => {
    test('segue a navegação completa: ano/ciclo, distrito, cidade, escola', async () => {
      const strategy = new Strategy(baseParams);
      const page = {};

      await strategy.execute(page, strategy.getTasks()[0]);

      expect(scraper.selectYearAndCycle).toHaveBeenCalledWith(page, {
        yearLabel: '2026/2027',
        teachingType: '3º Ciclo',
      });
      expect(scraper.selectDistrict).toHaveBeenCalledWith(page, 'Porto');
      expect(scraper.selectCity).toHaveBeenCalledWith(page, 'Valongo');
      expect(scraper.selectSchool).toHaveBeenCalledWith(page, 'EB1 de Ermesinde');
    });

    test('só chama selectCourse quando a tarefa tem um curso definido', async () => {
      const strategy = new Strategy({ ...baseParams, course: 'Ciências e Tecnologias' });
      const page = {};

      await strategy.execute(page, strategy.getTasks()[0]);

      expect(scraper.selectCourse).toHaveBeenCalledWith(page, 'Ciências e Tecnologias');
    });

    test('não chama selectCourse quando a tarefa não tem curso', async () => {
      const strategy = new Strategy(baseParams);
      const page = {};

      await strategy.execute(page, strategy.getTasks()[0]);

      expect(scraper.selectCourse).not.toHaveBeenCalled();
    });

    test('seleciona as disciplinas, avança para os livros e devolve o resultado de extractBooks', async () => {
      const strategy = new Strategy(baseParams);
      const page = {};

      const result = await strategy.execute(page, strategy.getTasks()[0]);

      expect(scraper.selectAllSubjects).toHaveBeenCalledWith(page);
      expect(scraper.goToBooks).toHaveBeenCalledWith(page);
      expect(result).toEqual([{ title: 'Manual X' }]);
    });
  });
});
