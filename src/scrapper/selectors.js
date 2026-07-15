'use strict';

/**
 * Centralized selectors for wook.pt/comprar-manuais-escolares.
 *
 * Status legend (checked 2026-07-15 against live HTML):
 *   [OK]      confirmed present in current DOM
 *   [LEGACY]  no longer exists on the page - kept only for reference, do not use
 *   [UNVERIFIED] not yet seen in captured HTML (likely injected via AJAX later in the flow)
 *
 * Note: the selector VALUES are literal DOM hooks from the target site (class names,
 * ids) and cannot be translated - only the JS identifiers referencing them are English.
 */
module.exports = {
  BASE_URL: 'https://www.wook.pt/comprar-manuais-escolares',

  // Cookie banner
  ACCEPT_COOKIES: 'button:has-text("ACEITAR")', // [OK]

  // Step 1: Year selection
  // [LEGACY] '.anoEscolar' / '.cicloEscolar' no longer exist on the page.
  // The site now uses direct radio-style buttons for year, and the teaching-type
  // combo self-fills based on the chosen year (manual interaction only needed
  // when a year maps to more than one teaching type).
  YEAR_BUTTON_DATA: 'button.ano-li', // [OK] e.g. button.ano-li[data-value="4"]
  YEAR_BUTTON_DATA_VALUE: (year) => `button.ano-li[data-value="${year}"]`,

  // Step 1b: Teaching type / cycle (auto-filled by year; only touch if year has >1 option)
  TEACHING_TYPE_WRAPPER: '.tiposEnsino-wrapper', // [OK]
  TEACHING_TYPE_COMBO: '#combo-tipoEnsino',      // [OK]
  TEACHING_TYPE_LISTBOX: '#listbox-tipoEnsino',  // [OK]

  // Step 2: District / City (via combos - script_json.js/index_combo.js)
  DISTRICT_COMBO: '#combo-distrito',     // [OK]
  DISTRICT_LISTBOX: '#listbox-distrito', // [OK]
  CITY_COMBO: '#combo-concelho',         // [UNVERIFIED] not present before district is picked; confirm via AJAX capture
  CITY_LISTBOX: '#listbox-concelho',     // [UNVERIFIED] same as above

  // Step 2 (alternative): District / City via SVG map with tooltip (index_tooltips.js)
  CONTENT_MAP: '#content-map',              // [OK]
  CONTENT_MAP_SHAPES: 'svg path, svg circle', // [OK]
  MAP_TOOLTIP: '#mapTooltip-information',   // [OK]

  // Step 3: School
  SCHOOL_COMBO: '#combo-escola',     // [UNVERIFIED] confirm after district+city selected
  SCHOOL_LISTBOX: '#listbox-escola', // [UNVERIFIED] same as above
  SCHOOL_OPTION: 'li[role="option"]', // [OK] generic pattern, matches district listbox structure

  // Step 4: Subjects
  SUBJECTS_CONTAINER: '.disciplinas.checkbox', // [UNVERIFIED] not seen yet, appears after "continuar"
  SUBJECTS_LABEL: 'label',                     // [UNVERIFIED]

  // Step 5: Continue
  CONTINUE_BUTTON: 'button.btnLivrosEscolares >> span:has-text("continuar")', // [UNVERIFIED] switched :text() to :has-text() for safety against nested markup

  // Step 6: Adopted books
  ADOPTED_BOOKS_CONTAINER: '.col-xs-12.livrosAdotados',        // [UNVERIFIED]
  BOOK_BLOCK: '.col-xs-12.escolares_bloco_flash_principal',    // [UNVERIFIED]
  BOOK_DISCIPLINE: '.col-xs-12.escolares_disciplina_flash_hidden', // [UNVERIFIED]
  BOOK_TYPE: '.categoriaWeb .info-text',                       // [UNVERIFIED]
  BOOK_TITLE: '.tituloAdocao',                                 // [UNVERIFIED]
  BOOK_AUTHORS: '.autores',                                    // [UNVERIFIED]
  BOOK_PUBLISHER: '.editores',                                 // [UNVERIFIED]
  BOOK_COVER: 'img.cover',                                     // [UNVERIFIED]
  BOOK_PRICE: '.escolares_preco',                              // [UNVERIFIED]
  BOOK_QUANTITY_INPUT: '.escolares_quantidades_input',         // [UNVERIFIED]
  NO_BOOK_TEXT: '.info-no-adotions .semAdocoes',               // [UNVERIFIED]
  NO_BOOK_SHOW_ALL: '.semAdocoesVerTodos',                     // [UNVERIFIED]

  // Generic: option inside any listbox (used by getOptions/pickOption)
  // The placeholder option (e.g. "Selecione o Distrito") carries the `hidden`
  // attribute, confirmed in the district listbox markup.
  optionInList(listSelector) {
    return `${listSelector} li[role="option"]:not([hidden])`;
  },
};