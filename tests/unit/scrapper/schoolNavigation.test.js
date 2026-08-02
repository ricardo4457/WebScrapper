jest.mock('../../../src/scrapper/navigation/comboNavigation', () => ({
  selectSchool: jest.fn().mockResolvedValue(),
  discoverCourses: jest.fn().mockResolvedValue([]),
  selectCourse: jest.fn().mockResolvedValue({ value: 'curso-1', defaultValue: 'curso-geral' }),
}));
jest.mock('../../../src/scrapper/subjects', () => ({
  selectAllSubjects: jest.fn().mockResolvedValue(3),
}));
jest.mock('../../../src/scrapper/books', () => ({
  goToBooks: jest.fn().mockResolvedValue(),
  extractBooks: jest.fn().mockResolvedValue([{ title: 'Manual X' }]),
}));
jest.mock('../../../src/scrapper/browser', () => ({
  waitForLoadingToFinish: jest.fn().mockResolvedValue(),
}));

const comboNavigation = require('../../../src/scrapper/navigation/comboNavigation');
const subjects = require('../../../src/scrapper/subjects');
const books = require('../../../src/scrapper/books');
const { scrapeSchool, returnToSchoolSelection } = require('../../../src/scrapper/navigation/schoolNavigation');

function makePage({ hasCourseStep = false } = {}) {
  return {
    isVisible: jest.fn().mockResolvedValue(hasCourseStep),
    locator: jest.fn(() => ({
      click: jest.fn().mockResolvedValue(),
    })),
    waitForSelector: jest.fn().mockResolvedValue(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  comboNavigation.selectCourse.mockResolvedValue({ value: 'curso-1', defaultValue: 'curso-geral' });
  books.extractBooks.mockResolvedValue([{ title: 'Manual X' }]);
});

describe('schoolNavigation.scrapeSchool — sem passo "Curso"', () => {
  test('não tenta descobrir nem selecionar curso quando o passo não existe', async () => {
    const page = makePage({ hasCourseStep: false });
    const task = { school: 'EB1 de Ermesinde', course: null };

    await scrapeSchool(page, task);

    expect(comboNavigation.discoverCourses).not.toHaveBeenCalled();
    expect(comboNavigation.selectCourse).not.toHaveBeenCalled();
  });

  test('chama selectAllSubjects com courseValues = null', async () => {
    const page = makePage({ hasCourseStep: false });
    await scrapeSchool(page, { school: 'EB1 de Ermesinde' });

    expect(subjects.selectAllSubjects).toHaveBeenCalledWith(page, null);
  });

  test('devolve os livros extraídos por extractBooks', async () => {
    const page = makePage({ hasCourseStep: false });
    const result = await scrapeSchool(page, { school: 'EB1 de Ermesinde' });

    expect(result).toEqual([{ title: 'Manual X' }]);
  });
});

describe('schoolNavigation.scrapeSchool — com passo "Curso"', () => {
  test('usa o curso indicado na tarefa em vez de o descobrir', async () => {
    const page = makePage({ hasCourseStep: true });
    const task = { school: 'Escola Secundária de Valongo', course: 'Ciências e Tecnologias' };

    await scrapeSchool(page, task);

    expect(comboNavigation.discoverCourses).not.toHaveBeenCalled();
    expect(comboNavigation.selectCourse).toHaveBeenCalledWith(page, 'Ciências e Tecnologias');
  });

  test('descobre o primeiro curso disponível quando a tarefa não especifica um', async () => {
    comboNavigation.discoverCourses.mockResolvedValue(['Artes Visuais', 'Ciências e Tecnologias']);
    const page = makePage({ hasCourseStep: true });
    const task = { school: 'Escola Secundária de Valongo', course: null };

    await scrapeSchool(page, task);

    expect(comboNavigation.discoverCourses).toHaveBeenCalledWith(page);
    expect(comboNavigation.selectCourse).toHaveBeenCalledWith(page, 'Artes Visuais');
  });

  test('passa os courseValues devolvidos por selectCourse a selectAllSubjects', async () => {
    comboNavigation.selectCourse.mockResolvedValue({ value: 'curso-101', defaultValue: 'curso-geral' });
    const page = makePage({ hasCourseStep: true });

    await scrapeSchool(page, { school: 'Escola Secundária', course: 'Ciências e Tecnologias' });

    expect(subjects.selectAllSubjects).toHaveBeenCalledWith(page, { value: 'curso-101', defaultValue: 'curso-geral' });
  });

  test('não chama selectCourse quando não há nenhum curso disponível para descobrir', async () => {
    comboNavigation.discoverCourses.mockResolvedValue([]);
    const page = makePage({ hasCourseStep: true });

    await scrapeSchool(page, { school: 'Escola Secundária', course: null });

    expect(comboNavigation.selectCourse).not.toHaveBeenCalled();
    expect(subjects.selectAllSubjects).toHaveBeenCalledWith(page, null);
  });

  test('quando isVisible falha (elemento não existe), trata como se não houvesse passo "Curso"', async () => {
    const page = makePage({ hasCourseStep: false });
    page.isVisible = jest.fn().mockRejectedValue(new Error('elemento não encontrado'));

    await scrapeSchool(page, { school: 'EB1 de Ermesinde', course: 'Algo' });

    expect(comboNavigation.selectCourse).not.toHaveBeenCalled();
  });
});

describe('schoolNavigation.returnToSchoolSelection', () => {
  test('clica no botão de voltar e espera pelo combo de escolas ficar visível', async () => {
    const backButton = { click: jest.fn().mockResolvedValue() };
    const page = {
      locator: jest.fn().mockReturnValue(backButton),
      waitForSelector: jest.fn().mockResolvedValue(),
    };

    await returnToSchoolSelection(page);

    expect(backButton.click).toHaveBeenCalledTimes(1);
    expect(page.waitForSelector).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: 'visible' }),
    );
  });
});
