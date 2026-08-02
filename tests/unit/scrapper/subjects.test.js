// Mock human-like delays so tests run instantly and deterministically.
jest.mock("../../../src/scrapper/humanization", () => ({
  humanDelay: jest.fn().mockResolvedValue(),
}));

const {
  selectAllSubjects,
  selectAllSubjectsSequential,
} = require("../../../src/scrapper/subjects");

/**
 * subjectLabelSelector() is not exported, so these tests verify its behavior
 * indirectly through the selector passed to container.locator() and through
 * the labels returned and clicked by the public functions.
 */

// Creates a fake subject label element.
function makeLabel() {
  return {
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(),
    click: jest.fn().mockResolvedValue(),
  };
}

// Creates a fake subject container exposing locator().all().
function makeContainer(labels) {
  const locatorSpy = jest.fn(() => ({
    all: jest.fn().mockResolvedValue(labels),
  }));
  return {
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(),
    locator: locatorSpy,
  };
}

// Creates a fake page object and exposes the underlying container spy.
function makePage(labels) {
  const container = makeContainer(labels);
  return {
    page: { locator: jest.fn(() => container) },
    container,
  };
}

describe("subjects.selectAllSubjects — sem curso selecionado", () => {
  // Uses the generic selector and clicks every available subject.
  test("usa o seletor genérico de labels (sem filtro por curso) e clica em todas", async () => {
    const labels = [makeLabel(), makeLabel(), makeLabel()];
    const { page, container } = makePage(labels);

    const count = await selectAllSubjects(page, null);

    expect(count).toBe(3);
    for (const label of labels) {
      expect(label.click).toHaveBeenCalledTimes(1);
    }
    // Sem courseValues, o seletor passado a locator() não deve conter
    // nenhum filtro por atributo data-curso.
    const usedSelector = container.locator.mock.calls[0][0];
    expect(usedSelector).not.toMatch(/data-curso/);
  });
});

describe("subjects.selectAllSubjects — com curso selecionado", () => {
  // Includes both the selected course and the default/general course in the selector.
  test('filtra por data-curso do curso escolhido e pelo curso "Formação Geral" (default)', async () => {
    const labels = [makeLabel()];
    const { page, container } = makePage(labels);

    await selectAllSubjects(page, {
      value: "curso-101",
      defaultValue: "curso-geral",
    });

    const usedSelector = container.locator.mock.calls[0][0];
    expect(usedSelector).toContain('data-curso="curso-101"');
    expect(usedSelector).toContain('data-curso="curso-geral"');
  });

  test("não duplica o filtro quando defaultValue é igual ao value escolhido", async () => {
    // Avoids duplicating the same course value in the generated selector.
    const labels = [makeLabel()];
    const { page, container } = makePage(labels);

    await selectAllSubjects(page, {
      value: "curso-101",
      defaultValue: "curso-101",
    });

    const usedSelector = container.locator.mock.calls[0][0];
    const occurrences = usedSelector.split("curso-101").length - 1;
    expect(occurrences).toBe(1);
  });

  // Falls back to the generic selector when no selected course value exists.
  test('ignora defaultValue quando courseValues não tem "value" (usa seletor genérico)', async () => {
    const labels = [makeLabel()];
    const { page, container } = makePage(labels);

    await selectAllSubjects(page, { value: null, defaultValue: "curso-geral" });

    const usedSelector = container.locator.mock.calls[0][0];
    expect(usedSelector).not.toMatch(/data-curso/);
  });
});

describe("subjects.selectAllSubjects — comportamento geral", () => {
  // No labels means nothing is selected.
  test("devolve 0 e não clica em nada quando não há disciplinas", async () => {
    const { page } = makePage([]);
    const count = await selectAllSubjects(page, null);
    expect(count).toBe(0);
  });
  // Scrolls each label into view before clicking it.

  test("faz scroll antes de clicar em cada disciplina", async () => {
    const labels = [makeLabel(), makeLabel()];
    const { page } = makePage(labels);

    await selectAllSubjects(page, null);

    for (const label of labels) {
      expect(label.scrollIntoViewIfNeeded).toHaveBeenCalledTimes(1);
    }
  });
});

describe("subjects.selectAllSubjectsSequential", () => {
  // Continues processing remaining labels even if one click fails.

  test("continua a clicar nas restantes disciplinas mesmo que uma falhe", async () => {
    const okLabel1 = makeLabel();
    const failingLabel = makeLabel();
    failingLabel.click = jest
      .fn()
      .mockRejectedValue(new Error("elemento não clicável"));
    const okLabel2 = makeLabel();

    const { page } = makePage([okLabel1, failingLabel, okLabel2]);
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const selected = await selectAllSubjectsSequential(page, null);

    expect(selected).toBe(2);
    expect(okLabel1.click).toHaveBeenCalledTimes(1);
    expect(okLabel2.click).toHaveBeenCalledTimes(1);

    console.warn.mockRestore();
  });
  
  // Uses force:true because subject checkboxes can be visually covered by other elements.
  test("usa click com force: true (checkboxes por vezes cobertos por outros elementos)", async () => {
    const label = makeLabel();
    const { page } = makePage([label]);

    await selectAllSubjectsSequential(page, null);

    expect(label.click).toHaveBeenCalledWith({ force: true });
  });
});
