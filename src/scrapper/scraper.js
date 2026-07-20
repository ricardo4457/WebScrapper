"use strict";

const comboNavigation = require("./navigation/comboNavigation");
const mapNavigation = require("./navigation/Mapnavigation");
const subjects = require("./subjects");
const books = require("./books");
const { mergeExclusive } = require("../utils/MergeExclusive");

const modules = { comboNavigation, Mapnavigation, subjects, books };

mergeExclusive(modules);

module.exports = {
  ...comboNavigation,
  ...Mapnavigation,
  ...subjects,
  ...books,
};