const {
  createScrapeTask,
  uniqueTasks,
  sortTasksByLocation,
  partitionTasksIntoLanes,
} = require('../../../src/strategies/ScrapeTask');

// Fixture base válida, usada e sobrescrita em cada teste para forçar campos em falta.
const VALID = Object.freeze({
  year: '5º Ano',
  teaching_cycle: '2º Ciclo',
  district: 'Porto',
  city: 'Valongo',
  school: 'EB1 de Ermesinde',
});

function without(field) {
  const clone = { ...VALID };
  delete clone[field];
  return clone;
}

function task(overrides = {}) {
  return { ...VALID, ...overrides };
}

describe('ScrapeTask.createScrapeTask', () => {
  test('cria a task quando todos os campos obrigatórios estão presentes', () => {
    const result = createScrapeTask(VALID);
    expect(result.school).toBe(VALID.school);
    expect(result.district).toBe(VALID.district);
    expect(result.city).toBe(VALID.city);
    expect(result.year).toBe(VALID.year);
  });

  test('rejeita task sem school', () => {
    expect(() => createScrapeTask(without('school')))
      .toThrow(/school' is required/);
  });

  test('rejeita task sem district', () => {
    expect(() => createScrapeTask(without('district')))
      .toThrow(/district' is required/);
  });

  test('rejeita task sem city', () => {
    expect(() => createScrapeTask(without('city')))
      .toThrow(/city' is required/);
  });

  test('rejeita task sem year', () => {
    expect(() => createScrapeTask(without('year')))
      .toThrow(/year' is required/);
  });

  test('rejeita quando o valor do campo é apenas espaços em branco', () => {
    expect(() => createScrapeTask(task({ school: '   ' })))
      .toThrow(/school' is required/);
  });

  test('teaching_cycle é opcional e fica null quando ausente', () => {
    const clone = without('teaching_cycle');
    const result = createScrapeTask(clone);
    expect(result.teaching_cycle).toBeNull();
  });
});

describe('ScrapeTask.uniqueTasks', () => {
  test('remove duplicados com a mesma chave (year, cycle, district, city, school)', () => {
    const a = task();
    const duplicateOfA = task(); // mesmos valores => mesma chave
    const differentSchool = task({ school: 'EB1 de Alfena' });

    const result = uniqueTasks([a, duplicateOfA, differentSchool]);

    expect(result).toHaveLength(2);
    expect(result).toEqual([a, differentSchool]);
  });

  test('mantém tasks distintas apenas por teaching_cycle', () => {
    const cycle1 = task({ teaching_cycle: '1º Ciclo' });
    const cycle2 = task({ teaching_cycle: '2º Ciclo' });

    const result = uniqueTasks([cycle1, cycle2]);

    expect(result).toHaveLength(2);
  });

  test('lista vazia devolve lista vazia', () => {
    expect(uniqueTasks([])).toEqual([]);
  });
});

describe('ScrapeTask.sortTasksByLocation', () => {
  test('agrupa tasks da mesma localização mesmo quando intercaladas', () => {
    const escolaA1 = task({ school: 'Escola A', city: 'Valongo' });
    const escolaB1 = task({ school: 'Escola B', city: 'Ermesinde' });
    const escolaA2 = task({ school: 'Escola A2', city: 'Valongo' });
    const escolaB2 = task({ school: 'Escola B2', city: 'Ermesinde' });

    const result = sortTasksByLocation([escolaA1, escolaB1, escolaA2, escolaB2]);

    // As duas tasks de Valongo devem ficar adjacentes, e o mesmo para Ermesinde,
    // preservando a ordem relativa de primeira ocorrência entre grupos.
    expect(result.map(t => t.school)).toEqual([
      'Escola A', 'Escola A2', 'Escola B', 'Escola B2'
    ]);
  });

  test('não altera o número total de tasks', () => {
    const tasks = [task({ school: '1' }), task({ school: '2', city: 'Ermesinde' })];
    expect(sortTasksByLocation(tasks)).toHaveLength(2);
  });
});

describe('ScrapeTask.partitionTasksIntoLanes', () => {
  test('nunca separa tasks da mesma locationKey por lanes diferentes', () => {
    const cidadeGrande = [1, 2, 3, 4, 5].map(n =>
      task({ school: `Escola Grande ${n}`, city: 'Valongo' })
    );
    const cidadePequena = [1, 2].map(n =>
      task({ school: `Escola Pequena ${n}`, city: 'Ermesinde' })
    );

    const lanes = partitionTasksIntoLanes([...cidadeGrande, ...cidadePequena], 3);

    for (const lane of lanes) {
      const cities = new Set(lane.map(t => t.city));
      // Cada lane só pode conter tasks de UMA localização (year/cycle/district/city).
      expect(cities.size).toBe(1);
    }

    // Todas as tasks continuam presentes, sem perdas nem duplicações.
    const totalTasks = lanes.reduce((sum, lane) => sum + lane.length, 0);
    expect(totalTasks).toBe(cidadeGrande.length + cidadePequena.length);
  });

  test('lanes vazias são descartadas quando há menos localizações do que lanes', () => {
    const tasks = [task({ city: 'Valongo' }), task({ city: 'Valongo', school: 'Outra' })];
    const lanes = partitionTasksIntoLanes(tasks, 5);
    expect(lanes).toHaveLength(1);
  });

  test('distribui grupos de localizações diferentes por lanes distintas quando possível', () => {
    const valongo = [1, 2].map(n => task({ school: `V${n}`, city: 'Valongo' }));
    const ermesinde = [1, 2].map(n => task({ school: `E${n}`, city: 'Ermesinde' }));
    const maia = [1, 2].map(n => task({ school: `M${n}`, city: 'Maia' }));

    const lanes = partitionTasksIntoLanes([...valongo, ...ermesinde, ...maia], 3);

    expect(lanes).toHaveLength(3);
  });
});