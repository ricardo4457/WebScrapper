// Mock human-like delays so tests stay deterministic and run instantly.
jest.mock("../../../src/scrapper/humanization", () => ({
  humanDelay: jest.fn().mockResolvedValue(),
}));

const {
  selectCourse,
  discoverCourses,
} = require("../../../src/scrapper/navigation/comboNavigation");

/**
 * These tests cover the "Curso" dropdown logic introduced for teaching
 * cycles that require an extra step before the subjects list appears.
 * The real DOM is simulated through page/locator mocks, following the same
 * pattern used in other scraper unit tests.
 */

// --- Mock factories ----------------------------------------------------------

// Creates one fake course option element.
function makeSingleOption({ text, value }) {
  return {
    getAttribute: jest.fn(async (name) =>
      name === "data-value" ? value : null,
    ),
    evaluate: jest.fn().mockResolvedValue(),
    waitFor: jest.fn().mockResolvedValue(),
    __text: text,
  };
}

// Creates a fake options locator that preserves element instances so tests
// can assert calls on the same mocked option after filter()/first().
function makeOptionsLocator(options, elements = options.map(makeSingleOption)) {
  return {
    first: () => elements[0] || makeSingleOption({ text: "", value: null }),
    filter: ({ hasText }) => {
      const filtered = elements.filter((el) => hasText.test(el.__text));
      return makeOptionsLocator(options, filtered);
    },
    count: jest.fn(async () => elements.length),
    allTextContents: jest.fn(async () => elements.map((el) => el.__text)),
    waitFor: jest.fn().mockResolvedValue(),
    __elements: elements,
  };
}

// Creates the locator for the hidden default-course input.
function makeDefaultLocator(defaultValue) {
  const hasDefault = defaultValue !== null && defaultValue !== undefined;
  return {
    count: jest.fn(async () => (hasDefault ? 1 : 0)),
    first: () => ({
      getAttribute: jest.fn(async () => defaultValue),
    }),
  };
}

// Creates a fake course dropdown button and its nested locators.
function makeCourseButton({
  ariaExpanded = "false",
  options = [],
  defaultValue = null,
  visible = true,
} = {}) {
  const optionsLocator = makeOptionsLocator(options);
  const defaultLocator = makeDefaultLocator(defaultValue);

  return {
    getAttribute: jest.fn(async (name) =>
      name === "aria-expanded" ? ariaExpanded : null,
    ),
    click: jest.fn().mockResolvedValue(),
    isVisible: jest.fn(async () => visible),
    locator: jest.fn((xpath) =>
      xpath.includes("cursoDefault") ? defaultLocator : optionsLocator,
    ),
  };
}

/**
 * Simulates the normal page state: course step visible and a single
 * #dropdownCursos instance in the DOM.
 */
function makePage({ wrapperVisible = true, button } = {}) {
  return {
    locator: jest.fn((selector) => {
      if (selector === ".dropdown.cursos") {
        return {
          first: () => ({ isVisible: jest.fn(async () => wrapperVisible) }),
        };
      }
      if (selector === "#dropdownCursos[data-value-selected]") {
        // Nenhum botão já com seleção neste cenário simples.
        return { count: jest.fn(async () => 0), first: () => button };
      }
      if (selector === "#dropdownCursos") {
        return {
          count: jest.fn(async () => 1),
          nth: () => button,
          first: () => button,
        };
      }
      throw new Error(`Selector inesperado no mock: ${selector}`);
    }),
  };
}

// --- discoverCourses ---------------------------------------------------------

describe("comboNavigation.discoverCourses", () => {
  // No course step -> no available courses.
  test('devolve lista vazia quando o passo "Curso" não está presente', async () => {
    const page = makePage({ wrapperVisible: false });
    const result = await discoverCourses(page);
    expect(result).toEqual([]);
  });
  // Trims surrounding whitespace from course labels.
  test("devolve os nomes dos cursos disponíveis, sem espaços extra", async () => {
    const button = makeCourseButton({
      options: [
        { text: "  Ciências e Tecnologias  ", value: "1" },
        { text: "Artes Visuais", value: "2" },
      ],
    });
    const page = makePage({ button });

    const result = await discoverCourses(page);

    expect(result).toEqual(["Ciências e Tecnologias", "Artes Visuais"]);
  });

  // Expands the dropdown only when it is still collapsed.
  test("expande o dropdown com um clique apenas se ainda não estiver expandido", async () => {
    const button = makeCourseButton({
      ariaExpanded: "false",
      options: [{ text: "Curso A", value: "1" }],
    });
    const page = makePage({ button });

    await discoverCourses(page);

    expect(button.click).toHaveBeenCalledTimes(1);
  });

  // Avoids double-toggling an already expanded dropdown.
  test('não clica novamente se o dropdown já estiver expandido (aria-expanded="true")', async () => {
    const button = makeCourseButton({
      ariaExpanded: "true",
      options: [{ text: "Curso A", value: "1" }],
    });
    const page = makePage({ button });

    await discoverCourses(page);

    expect(button.click).not.toHaveBeenCalled();
  });

  // Discovery failures are swallowed and treated as no courses available.
  test("devolve lista vazia (em vez de rebentar) se algo falhar ao expandir", async () => {
    const button = makeCourseButton({
      options: [{ text: "Curso A", value: "1" }],
    });
    button.click = jest.fn().mockRejectedValue(new Error("falha ao clicar"));
    const page = makePage({ button });

    const result = await discoverCourses(page);

    expect(result).toEqual([]);
  });
});

// --- selectCourse -------------------------------------------------------------

// Missing course parameter is a no-op.
describe("comboNavigation.selectCourse", () => {
  test("devolve null sem tentar nada quando não é passado nenhum curso", async () => {
    const page = makePage({ button: makeCourseButton() });
    const result = await selectCourse(page, undefined);
    expect(result).toBeNull();
  });

  // No course step on the page -> nothing to select.
  test('devolve null quando o passo "Curso" não está presente na página', async () => {
    const page = makePage({ wrapperVisible: false });
    const result = await selectCourse(page, "Ciências e Tecnologias");
    expect(result).toBeNull();
  });

  // Selects the exact course label and returns both selected value and default value.
  test("seleciona a opção com correspondência exata de texto e devolve value/defaultValue", async () => {
    const button = makeCourseButton({
      options: [
        { text: "Ciências e Tecnologias", value: "curso-101" },
        { text: "Artes Visuais", value: "curso-102" },
      ],
      defaultValue: "curso-default-1",
    });
    const page = makePage({ button });

    const result = await selectCourse(page, "Ciências e Tecnologias");

    expect(result).toEqual({
      value: "curso-101",
      defaultValue: "curso-default-1",
    });
  });
  // Missing hidden default input should yield defaultValue = null.
  test("defaultValue fica null quando não existe o input #cursoDefault", async () => {
    const button = makeCourseButton({
      options: [{ text: "Ciências e Tecnologias", value: "curso-101" }],
      defaultValue: null,
    });
    const page = makePage({ button });

    const result = await selectCourse(page, "Ciências e Tecnologias");

    expect(result.defaultValue).toBeNull();
  });

  // Unknown course names produce a clear error.
  test("lança erro quando o curso pedido não existe entre as opções", async () => {
    const button = makeCourseButton({
      options: [{ text: "Artes Visuais", value: "2" }],
    });
    const page = makePage({ button });

    await expect(selectCourse(page, "Curso Inexistente")).rejects.toThrow(
      /selectCourse: option not found -> "Curso Inexistente"/,
    );
  });

  // Matching is exact, not partial, even for similar course names.
  test("não confunde cursos com nomes parecidos (correspondência é exata, não parcial)", async () => {
    const button = makeCourseButton({
      options: [
        { text: "Ciências", value: "1" },
        { text: "Ciências e Tecnologias", value: "2" },
      ],
    });
    const page = makePage({ button });

    const result = await selectCourse(page, "Ciências");

    expect(result.value).toBe("1");
  });
  // Uses a native DOM click via evaluate() instead of Playwright's click pipeline.
  test("clica na opção via evaluate() em vez do clique normal do Playwright", async () => {
    const button = makeCourseButton({
      options: [{ text: "Curso A", value: "1" }],
    });
    const page = makePage({ button });

    await selectCourse(page, "Curso A");

    const optionsLocator = button.locator(
      "xpath=ancestor::div//li[@data-value]",
    );
    const [optionMock] = optionsLocator.__elements;
    expect(optionMock.evaluate).toHaveBeenCalledTimes(1);
    expect(optionMock.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });
});
