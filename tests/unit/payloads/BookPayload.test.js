const { buildImportPayload, buildBatchPayload } = require('../../../src/payloads/BookPayload');

const TASK = Object.freeze({
  school: 'EB1 de Ermesinde',
  district: 'Porto',
  city: 'Valongo',
  year: '5º Ano',
  teaching_cycle: '2º Ciclo',
});

function book(overrides = {}) {
  return {
    title: 'Manual de Português',
    publisher: 'Porto Editora',
    authors: ['Autor A', 'Autor B'],
    coverImage: 'https://cdn.wook.pt/cover-123.jpg',
    price: 19.9,
    discipline: 'Português',
    type: 'Manual',
    ...overrides,
  };
}

describe('BookPayload.buildImportPayload', () => {
  test('lança erro se task.school estiver ausente', () => {
    const taskSemSchool = { ...TASK, school: undefined };
    expect(() => buildImportPayload(taskSemSchool, [book()]))
      .toThrow(/task\.school é obrigatório/);
  });

  test('lança erro se task for null/undefined', () => {
    expect(() => buildImportPayload(null, [book()]))
      .toThrow(/task\.school é obrigatório/);
  });

  test('year/teaching_cycle ficam dentro de cada item de items[] (bug já identificado)', () => {
    const payload = buildImportPayload(TASK, [book(), book({ title: 'Manual de Matemática' })]);

    // Regressão: year/teaching_cycle NÃO devem existir na raiz do payload,
    // apenas dentro de cada item de items[].
    expect(payload.year).toBeUndefined();
    expect(payload.teaching_cycle).toBeUndefined();

    expect(payload.items).toHaveLength(2);
    for (const item of payload.items) {
      expect(item.year).toBe(TASK.year);
      expect(item.teaching_cycle).toBe(TASK.teaching_cycle);
    }
  });

  test('mapeia coverImage → cover_path corretamente', () => {
    const payload = buildImportPayload(TASK, [book({ coverImage: 'https://cdn.wook.pt/xyz.jpg' })]);
    expect(payload.items[0].cover_path).toBe('https://cdn.wook.pt/xyz.jpg');
    expect(payload.items[0].coverImage).toBeUndefined();
  });

  test('constrói corretamente o bloco school a partir da task', () => {
    const payload = buildImportPayload(TASK, [book()]);
    expect(payload.school).toEqual({
      name: TASK.school,
      district: TASK.district,
      city: TASK.city,
    });
  });

  test('lida com lista de livros vazia sem lançar erro', () => {
    const payload = buildImportPayload(TASK, []);
    expect(payload.items).toEqual([]);
  });
});

describe('BookPayload.buildBatchPayload', () => {
  test('constrói um payload por cada entrada { task, books }', () => {
    const outraTask = { ...TASK, school: 'EB1 de Alfena', city: 'Valongo' };
    const entries = [
      { task: TASK, books: [book()] },
      { task: outraTask, books: [book(), book()] },
    ];

    const payloads = buildBatchPayload(entries);

    expect(payloads).toHaveLength(2);
    expect(payloads[0].school.name).toBe(TASK.school);
    expect(payloads[1].school.name).toBe(outraTask.school);
    expect(payloads[1].items).toHaveLength(2);
  });

  test('propaga o erro de buildImportPayload quando uma entrada não tem school', () => {
    const entries = [{ task: { ...TASK, school: undefined }, books: [book()] }];
    expect(() => buildBatchPayload(entries))
      .toThrow(/task\.school é obrigatório/);
  });
});