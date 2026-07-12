'use strict';

/**
 * Centralized selectors for wook.pt/comprar-manuais-escolares.
 * Extracted and validated from index_combo.js, script_json.js and index_tooltips.js.
 * Keeping these in one file avoids "magic strings" scattered across steps/strategies.
 *
 * Note: the selector VALUES are literal DOM hooks from the target site (class names,
 * ids) and cannot be translated - only the JS identifiers referencing them are English.
 */
module.exports = {
  BASE_URL: 'https://www.wook.pt/comprar-manuais-escolares',

  // Cookie banner
  ACCEPT_COOKIES: 'button:has-text("ACEITAR")',

  // Step 1: Year / Cycle
  YEAR_BUTTON: '.anoEscolar',            // used in index_combo.js (click by text)
  YEAR_BUTTON_DATA: 'button.ano-li',     // used in script_json.js (has data-value, more robust)
  CYCLE_BUTTON: '.cicloEscolar',

  // Step 1b: Teaching type / cycle (not always visible, depends on the year)
  TEACHING_TYPE_WRAPPER: '.tiposEnsino-wrapper',
  TEACHING_TYPE_COMBO: '#combo-tipoEnsino',
  TEACHING_TYPE_LISTBOX: '#listbox-tipoEnsino',

  // Step 2: District / City (via combos - script_json.js/index_combo.js)
  DISTRICT_COMBO: '#combo-distrito',
  DISTRICT_LISTBOX: '#listbox-distrito',
  CITY_COMBO: '#combo-concelho',
  CITY_LISTBOX: '#listbox-concelho',

  // Step 2 (alternative): District / City via SVG map with tooltip (index_tooltips.js)
  CONTENT_MAP: '#content-map',
  CONTENT_MAP_SHAPES: 'svg path, svg circle',
  MAP_TOOLTIP: '#mapTooltip-information',

  // Step 3: School
  SCHOOL_COMBO: '#combo-escola',
  SCHOOL_LISTBOX: '#listbox-escola',
  SCHOOL_OPTION: 'li[role="option"]',

  // Step 4: Subjects
  SUBJECTS_CONTAINER: '.disciplinas.checkbox',
  SUBJECTS_LABEL: 'label',

  // Step 5: Continue
  CONTINUE_BUTTON: 'button.btnLivrosEscolares >> span:text("continuar")',

  // Step 6: Adopted books
  ADOPTED_BOOKS_CONTAINER: '.col-xs-12.livrosAdotados',
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

  // Generic: option inside any listbox (used by getOptions/pickOption)
  optionInList(listSelector) {
    return `${listSelector} li[role="option"]:not([hidden])`;
  },
};