'use strict';

/**
 * Selectors centralizados para o site wook.pt/comprar-manuais-escolares.
 * Extraídos e validados a partir de index_combo.js, script_json.js e index_tooltips.js.
 * Manter isto num único ficheiro evita "magic strings" espalhadas pelas steps/strategies.
 */
module.exports = {
  BASE_URL: 'https://www.wook.pt/comprar-manuais-escolares',

  // Cookies / pop-ups
  ACCEPT_COOKIES: 'button:has-text("ACEITAR")',

  // Passo 1: Ano / Ciclo
  ANO_BUTTON: '.anoEscolar',          // usado em index_combo.js (clique direto por texto)
  ANO_BUTTON_DATA: 'button.ano-li',   // usado em script_json.js (tem data-value, mais robusto)
  CICLO_BUTTON: '.cicloEscolar',

  // Passo 1b: Tipo de Ensino (nem sempre visível, depende do ano)
  TIPO_ENSINO_WRAPPER: '.tiposEnsino-wrapper',
  COMBO_TIPO_ENSINO: '#combo-tipoEnsino',
  LISTBOX_TIPO_ENSINO: '#listbox-tipoEnsino',

  // Passo 2: Distrito / Concelho (via combos - script_json.js/index_combo.js)
  COMBO_DISTRITO: '#combo-distrito',
  LISTBOX_DISTRITO: '#listbox-distrito',
  COMBO_CONCELHO: '#combo-concelho',
  LISTBOX_CONCELHO: '#listbox-concelho',

  // Passo 2 (alternativa): Distrito / Cidade via mapa SVG com tooltip (index_tooltips.js)
  CONTENT_MAP: '#content-map',
  CONTENT_MAP_SHAPES: 'svg path, svg circle',
  MAP_TOOLTIP: '#mapTooltip-information',

  // Passo 3: Escola
  COMBO_ESCOLA: '#combo-escola',
  LISTBOX_ESCOLA: '#listbox-escola',
  ESCOLA_OPTION: 'li[role="option"]',

  // Passo 4: Disciplinas
  DISCIPLINAS_CONTAINER: '.disciplinas.checkbox',
  DISCIPLINAS_LABEL: 'label',

  // Passo 5: Continuar
  CONTINUAR_BUTTON: 'button.btnLivrosEscolares >> span:text("continuar")',

  // Passo 6: Livros adotados
  LIVROS_ADOTADOS_CONTAINER: '.col-xs-12.livrosAdotados',
  BOOK_BLOCK: '.col-xs-12.escolares_bloco_flash_principal',
  BOOK_DISCIPLINE: '.col-xs-12.escolares_disciplina_flash_hidden',
  BOOK_TYPE: '.categoriaWeb .info-text',
  BOOK_TITLE: '.tituloAdocao',
  BOOK_AUTHORS: '.autores',
  BOOK_PUBLISHER: '.editores',
  BOOK_COVER: 'img.cover',
  BOOK_PRICE: '.escolares_preco',
  BOOK_QUANTITY_INPUT: '.escolares_quantidades_input',
  NO_BOOK_TEXT: '.info-no-adotions .semAdocoes',
  NO_BOOK_SHOW_ALL: '.semAdocoesVerTodos',

  // Genérico: opção de qualquer listbox (usado por getOptions/pickOption)
  optionInList(listSel) {
    return `${listSel} li[role="option"]:not([hidden])`;
  },
};