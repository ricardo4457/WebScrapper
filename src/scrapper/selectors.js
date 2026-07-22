"use strict";

/**
 * Selectors for the Wook school books page.
 * Keep this file updated if the site's DOM changes.
 */
module.exports = {
  BASE_URL: "https://www.wook.pt/comprar-manuais-escolares",

  //Loading Modal
  LOADING_MODAL: '#managed-dialog.loading',

  // Cookie banner
  ACCEPT_COOKIES: 'button:has-text("ACEITAR")',

  // Step 1: Year
  YEAR_BUTTON_DATA: "button.ano-li",
  YEAR_BUTTON_DATA_VALUE: (year) => `button.ano-li[data-value="${year}"]`,

  // Step 1: Teaching cycle
  TEACHING_TYPE_WRAPPER: ".tiposEnsino-wrapper",
  TEACHING_TYPE_COMBO: "#combo-tipoEnsino",
  TEACHING_TYPE_LISTBOX: "#listbox-tipoEnsino",

  // Step 2: District and city
  DISTRICT_COMBO: "#combo-distrito",
  DISTRICT_LISTBOX: "#listbox-distrito",
  CITY_COMBO: "#combo-concelho",
  CITY_LISTBOX: "#listbox-concelho",

  // Alternative: SVG map
  CONTENT_MAP: "#content-map",
  CONTENT_MAP_SHAPES: "svg path, svg circle",
  MAP_TOOLTIP: "#mapTooltip-information",

  // Step 3: School
  SCHOOL_COMBO: "#combo-escola",
  SCHOOL_LISTBOX: "#listbox-escola",
  SCHOOL_OPTION: 'li[role="option"]',

  // Step 4: Subjects
  SUBJECTS_CONTAINER: ".disciplinas.checkbox",
  SUBJECTS_LABEL: "label",

  // Step 5: Continue
  CONTINUE_BUTTON: 'button.btnLivrosEscolares >> span:has-text("continuar")',

  // Step 6: Books
  ADOPTED_BOOKS_CONTAINER: ".col-xs-12.livrosAdotados",
  BOOK_BLOCK: ".col-xs-12.escolares_bloco_flash_principal",
  BOOK_DISCIPLINE: ".col-xs-12.escolares_disciplina_flash_hidden",
  BOOK_TYPE: ".categoriaWeb .info-text",
  BOOK_TITLE: ".tituloAdocao",
  BOOK_AUTHORS: ".autores",
  BOOK_PUBLISHER: ".editores",
  BOOK_COVER: "img.cover",
  BOOK_PRICE: ".escolares_preco",
  BOOK_QUANTITY_INPUT: ".escolares_quantidades_input",
  NO_BOOK_TEXT: ".info-no-adotions .semAdocoes",
  NO_BOOK_SHOW_ALL: ".semAdocoesVerTodos",

  // GO Back Button on Books
  NO_BOOK_TEXT: ".info-no-adotions .semAdocoes",
  NO_BOOK_SHOW_ALL: ".semAdocoesVerTodos",
  BACK_TO_SEARCH_BUTTON: ".btnAdocoesVoltar",

  // Generic option selector
  optionInList(listSelector) {
    return `${listSelector} li[role="option"]:not([hidden])`;
  },
};
