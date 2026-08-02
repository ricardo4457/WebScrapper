// Mock human-like delays so tests run instantly and deterministically.
jest.mock('../../../src/scrapper/humanization', () => ({
  humanDelay: jest.fn().mockResolvedValue(),
}));

const { goToBooks, extractBooks } = require('../../../src/scrapper/books');

// --- goToBooks / resolveContinueButton --------------------------------------

// Creates a fake Playwright button locator.
function makeButton({ visible = true } = {}) {
  return {
    isVisible: jest.fn(async () => visible),
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(),
    click: jest.fn().mockResolvedValue(),
  };
}

// Creates a fake Playwright page with a configurable set of matching buttons.
function makePage({ buttons, waitForSelectorFails = false } = {}) {
  const matches = {
    count: jest.fn(async () => buttons.length),
    nth: jest.fn((i) => buttons[i]),
    first: jest.fn(() => buttons[0]),
  };

  return {
    locator: jest.fn(() => matches),
    waitForSelector: waitForSelectorFails
      ? jest.fn().mockRejectedValue(new Error('timeout'))
      : jest.fn().mockResolvedValue(),
  };
}

describe('books.goToBooks — desambiguação do botão "continuar"', () => {
    // Single-button case: click it normally.
  test('clica no único botão "continuar" quando só existe um', async () => {
    const button = makeButton();
    const page = makePage({ buttons: [button] });

    await goToBooks(page);

    expect(button.click).toHaveBeenCalledTimes(1);
  });
  // Reused-page case: click only the visible button.

  test('quando há dois botões (página reutilizada entre escolas), clica apenas no visível', async () => {
    const hiddenButton = makeButton({ visible: false });
    const visibleButton = makeButton({ visible: true });
    const page = makePage({ buttons: [hiddenButton, visibleButton] });

    await goToBooks(page);

    expect(hiddenButton.click).not.toHaveBeenCalled();
    expect(visibleButton.click).toHaveBeenCalledTimes(1);
  });
  // Fallback when visibility checks fail: use the first match.
  test('recai no primeiro botão se nenhum for reportado como visível', async () => {
    const button1 = makeButton({ visible: false });
    const button2 = makeButton({ visible: false });
    const page = makePage({ buttons: [button1, button2] });

    await goToBooks(page);

    expect(button1.click).toHaveBeenCalledTimes(1);
    expect(button2.click).not.toHaveBeenCalled();
  });

  // Fail fast if neither books nor the "no adoptions" state appears.
  test('lança erro claro se nem a lista de livros nem "sem adoções" aparecerem', async () => {
    const button = makeButton();
    const page = makePage({ buttons: [button], waitForSelectorFails: true });

    await expect(goToBooks(page)).rejects.toThrow(/goToBooks: nem a lista de livros adotados/);
  });
});

// --- extractBooks ------------------------------------------------------------

/**
 * extractBooks() runs inside page.evaluate() in the browser context.
 * These helpers provide a minimal fake DOM so the extraction logic can be
 * tested without launching a real browser.
 */

// Creates a minimal DOM element used by the fake document.
function makeElement({ text = '', src, attrs = {} } = {}) {
  return {
    textContent: text,
    src,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
  };
}

// Creates one fake book block matching the structure expected by extractBooks().
function makeBookBlock({ discipline, type, title, authors, publisher, cover, price, curso, nivel } = {}) {
  const fields = {
    '.col-xs-12.escolares_disciplina_flash_hidden': discipline !== undefined ? makeElement({ text: discipline }) : null,
    '.categoriaWeb .info-text': type !== undefined ? makeElement({ text: type }) : null,
    '.tituloAdocao': title !== undefined ? makeElement({ text: title }) : null,
    '.autores': authors !== undefined ? makeElement({ text: authors }) : null,
    '.editores': publisher !== undefined ? makeElement({ text: publisher }) : null,
    'img.cover': cover !== undefined ? makeElement({ src: cover }) : null,
    '.escolares_preco': price !== undefined ? makeElement({ attrs: { 'data-preco': String(price) } }) : null,
    '.escolares_quantidades_input':
      curso !== undefined || nivel !== undefined
        ? makeElement({ attrs: { 'data-curso': String(curso), 'data-nivel': String(nivel) } })
        : null,
    '.info-no-adotions .semAdocoes': title === undefined && discipline !== undefined
      ? makeElement({ text: 'Sem adoções nesta disciplina' })
      : null,
  };

  return { querySelector: (sel) => fields[sel] || null };
}

// Creates a fake Playwright page whose evaluate() receives the fake document.
function makeFakePage(blocks) {
  return {
    evaluate: async (fn, arg) => {
      const fakeDocument = {
        querySelectorAll: () => blocks,
      };
      const original = global.document;
      global.document = fakeDocument;
      try {
        return fn(arg);
      } finally {
        global.document = original;
      }
    },
  };
}

describe('books.extractBooks', () => {
  // Extracts all standard book fields from an adopted-book block.
  test('extrai título, disciplina, autores, editora, capa e preço de um livro adotado', async () => {
    const block = makeBookBlock({
      discipline: 'Português',
      type: 'Manual',
      title: 'Manual de Português',
      authors: 'Autor A, Autor B',
      publisher: 'Porto Editora',
      cover: 'https://cdn.wook.pt/cover.jpg',
      price: 19.9,
    });
    const page = makeFakePage([block]);

    const [book] = await extractBooks(page);

    expect(book).toMatchObject({
      discipline: 'Português',
      type: 'Manual',
      title: 'Manual de Português',
      authors: ['Autor A', 'Autor B'],
      publisher: 'Porto Editora',
      coverImage: 'https://cdn.wook.pt/cover.jpg',
      price: 19.9,
    });
  });

  // Extracts course/level metadata used later for course filtering.
  test('inclui course e level extraídos de data-curso/data-nivel (necessário para a filtragem por curso)', async () => {
    const block = makeBookBlock({
      discipline: 'Matemática',
      title: 'Manual de Matemática',
      curso: 101,
      nivel: 2,
    });
    const page = makeFakePage([block]);

    const [book] = await extractBooks(page);

    expect(book.course).toBe(101);
    expect(book.level).toBe(2);
  });

  // Missing course metadata should produce null values.
  test('course/level ficam null quando o bloco não tem o input de quantidade', async () => {
    const block = makeBookBlock({ discipline: 'Matemática', title: 'Manual de Matemática' });
    const page = makeFakePage([block]);

    const [book] = await extractBooks(page);

    expect(book.course).toBeNull();
    expect(book.level).toBeNull();
  });

  // Discipline blocks without books are represented as "no adoptions" entries.
  test('regista uma entrada "sem adoções" quando a disciplina não tem livro', async () => {
    const block = makeBookBlock({ discipline: 'Educação Física' });
    const page = makeFakePage([block]);

    const [entry] = await extractBooks(page);

    expect(entry.title).toBe('Sem adoções nesta disciplina');
    expect(entry.type).toBeNull();
    expect(entry.authors).toEqual([]);
  });
  
  // No book blocks means no extracted entries.
  test('devolve lista vazia quando não há blocos de livro na página', async () => {
    const page = makeFakePage([]);
    const result = await extractBooks(page);
    expect(result).toEqual([]);
  });
});
