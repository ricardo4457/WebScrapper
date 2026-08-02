jest.mock('../../../src/scrapper/humanization', () => ({
  humanDelay: jest.fn().mockResolvedValue(),
}));

const {
  clickMapShapeByTooltip,
  discoverMapLabels,
  readTooltipText,
} = require('../../../src/scrapper/navigation/Mapnavigation');



function makeShape(tooltipText) {
  return {
    boundingBox: jest.fn().mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 }),
    click: jest.fn().mockResolvedValue(),
    __tooltipText: tooltipText,
  };
}

function makePage(shapes) {
  let cursor = 0;
  return {
    mouse: { move: jest.fn().mockResolvedValue() },
    waitForTimeout: jest.fn().mockResolvedValue(),
    waitForSelector: jest.fn().mockResolvedValue(),
    locator: jest.fn(() => ({
      locator: jest.fn(() => ({ elementHandles: jest.fn().mockResolvedValue(shapes) })),
    })),

    evaluate: jest.fn(async () => shapes[cursor++]?.__tooltipText ?? null),
  };
}

describe('Mapnavigation.clickMapShapeByTooltip', () => {
  test('clica na forma cujo tooltip corresponde ao nome pedido (ignora maiúsculas/minúsculas)', async () => {
    const shapes = [makeShape('Braga'), makeShape('Porto'), makeShape('Aveiro')];
    const page = makePage(shapes);

    await clickMapShapeByTooltip(page, 'porto');

    expect(shapes[0].click).not.toHaveBeenCalled();
    expect(shapes[1].click).toHaveBeenCalledTimes(1);
    expect(shapes[2].click).not.toHaveBeenCalled();
  });

  test('lança erro claro quando nenhuma forma corresponde ao nome pedido', async () => {
    const shapes = [makeShape('Braga'), makeShape('Aveiro')];
    const page = makePage(shapes);

    await expect(clickMapShapeByTooltip(page, 'Distrito Inexistente'))
      .rejects
      .toThrow(/não encontrado entre 2 elementos do mapa/);
  });

  test('ignora formas sem bounding box (elementos invisíveis) sem lhes chamar evaluate', async () => {
    const invisibleShape = {
      boundingBox: jest.fn().mockResolvedValue(null),
      click: jest.fn(),
    };
    const page = makePage([invisibleShape]);

    await expect(clickMapShapeByTooltip(page, 'Porto')).rejects.toThrow(/não encontrado/);
    expect(invisibleShape.click).not.toHaveBeenCalled();
  });
});

describe('Mapnavigation.discoverMapLabels', () => {
  test('devolve apenas os tooltips não vazios encontrados nas formas do mapa', async () => {
    const shapes = [makeShape('Porto'), makeShape(null), makeShape('Braga')];
    const page = makePage(shapes);

    const labels = await discoverMapLabels(page);

    expect(labels).toEqual(['Porto', 'Braga']);
  });

  test('devolve lista vazia quando a única forma não tem tooltip', async () => {
    const shapes = [makeShape(null)];
    const page = makePage(shapes);

    const labels = await discoverMapLabels(page);

    expect(labels).toEqual([]);
  }, 10000);
});

describe('Mapnavigation.readTooltipText', () => {
  test('devolve null quando page.evaluate não encontra nenhum tooltip', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue(null) };
    const result = await readTooltipText(page);
    expect(result).toBeNull();
  });

  test('devolve o texto do tooltip quando encontrado', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue('Porto') };
    const result = await readTooltipText(page);
    expect(result).toBe('Porto');
  });
});
