"use strict";

const comboNavigation = require("./navigation/comboNavigation");
const mapNavigation = require("./navigation/mapNavigation");
const subjects = require("./subjects");
const books = require("./books");
const { mergeExclusive } = require("../utils/MergeExclusive");

const modules = { comboNavigation, mapNavigation, subjects, books };

mergeExclusive(modules);

module.exports = {
  ...comboNavigation,
  ...mapNavigation,
  ...subjects,
  ...books,
};