const { BlockDetectedError, assertNotBlocked } = require('../../../src/scrapper/blockDetection');

/**
 * blockDetection.js só exporta `BlockDetectedError` e `assertNotBlocked`.
 * As funções internas `assertResponseNotBlocked` e `assertContentNotBlocked`
 * não são exportadas individualmente, pelo que estes testes exercitam-nas
 * através da função pública `assertNotBlocked`, isolando cada verificação
 * através dos mocks de `response` e `page` fornecidos.
 */

// --- Mocks -----------------------------------------------------------------

function mockResponse({ status, headers = {}, body = '' } = {}) {
  return {
    status: () => status,
    headers: () => headers,
    text: async () => body,
  };
}

function mockPage({ title = '', bodyText = '' } = {}) {
  return {
    title: async () => title,
    locator: () => ({
      innerText: async () => bodyText,
    }),
  };
}

// --- assertResponseNotBlocked (via assertNotBlocked) ------------------------

describe('blockDetection — assertResponseNotBlocked (status HTTP)', () => {
  const cleanPage = mockPage({ title: 'wook.pt', bodyText: 'Página normal, sem bloqueios.' });

  for (const status of [403, 429, 503]) {
    test(`lança BlockDetectedError para status ${status}`, async () => {
      const response = mockResponse({ status, body: 'Bloqueado' });

      await expect(assertNotBlocked(cleanPage, response))
        .rejects
        .toMatchObject({
          name: 'BlockDetectedError',
          reason: `HTTP ${status}`,
        });
    });
  }

  test('não lança erro para status 200', async () => {
    const response = mockResponse({ status: 200, body: 'OK' });
    await expect(assertNotBlocked(cleanPage, response)).resolves.not.toThrow();
  });

  test('não lança erro quando response é null/undefined (ex.: navegação sem resposta)', async () => {
    await expect(assertNotBlocked(cleanPage, null)).resolves.not.toThrow();
  });

  test('outros status de erro (ex.: 500) não são tratados como bloqueio', async () => {
    const response = mockResponse({ status: 500, body: 'Internal Server Error' });
    await expect(assertNotBlocked(cleanPage, response)).resolves.not.toThrow();
  });
});

// --- assertContentNotBlocked (via assertNotBlocked) --------------------------

describe('blockDetection — assertContentNotBlocked (texto de bloqueio)', () => {
  const okResponse = mockResponse({ status: 200 });

  test('deteta texto de bloqueio no título (ex.: "checking your browser")', async () => {
    const page = mockPage({ title: 'Just a moment... Checking your browser', bodyText: '' });

    await expect(assertNotBlocked(page, okResponse))
      .rejects
      .toMatchObject({
        name: 'BlockDetectedError',
        reason: 'checking your browser',
      });
  });

  test('deteta texto de bloqueio no corpo da página (case-insensitive)', async () => {
    const page = mockPage({ title: 'wook.pt', bodyText: 'SORRY, YOU HAVE BEEN BLOCKED from accessing this site.' });

    await expect(assertNotBlocked(page, okResponse))
      .rejects
      .toMatchObject({
        name: 'BlockDetectedError',
        reason: 'sorry, you have been blocked',
      });
  });

  test('deteta qualquer um dos sinais de bloqueio conhecidos', async () => {
    const sinais = [
      'attention required! | cloudflare',
      'access denied',
      'verifying you are human',
      'unusual traffic',
    ];

    for (const sinal of sinais) {
      const page = mockPage({ title: '', bodyText: `Conteúdo da página: ${sinal}` });
      await expect(assertNotBlocked(page, okResponse)).rejects.toThrow(BlockDetectedError);
    }
  });

  test('não lança erro para conteúdo normal, sem sinais de bloqueio', async () => {
    const page = mockPage({ title: 'wook.pt — Manuais Escolares', bodyText: 'Bem-vindo ao portal de manuais escolares.' });
    await expect(assertNotBlocked(page, okResponse)).resolves.not.toThrow();
  });

  test('ignora erros de leitura de título/corpo em vez de rebentar', async () => {
    const page = {
      title: async () => { throw new Error('falha ao ler título'); },
      locator: () => ({
        innerText: async () => { throw new Error('falha ao ler corpo'); },
      }),
    };
    await expect(assertNotBlocked(page, okResponse)).resolves.not.toThrow();
  });
});