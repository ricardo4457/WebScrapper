'use strict';

/**
 * Builds the payload expected by the Laravel API.
 */

function buildImportPayload(task, books) {
  if (!task || !task.school) {
    throw new Error('buildImportPayload: task.school é obrigatório.');
  }

  return {
    school: {
      name: task.school,
      district: task.district,
      city: task.city,
    },
    items: books.map(book => ({
      title: book.title,
      publisher: book.publisher,
      authors: book.authors,
      cover_path: book.coverImage,
      price: book.price,
      discipline: book.discipline,
      type: book.type,
      year: task.year,
      teaching_cycle: task.teaching_cycle,
      course: task.course,
    })),
  };
}

/**
 * Builds the payload for multiple schools.
 */

function buildBatchPayload(entries) {
  return entries.map(({ task, books }) => buildImportPayload(task, books));
}

module.exports = {
  buildImportPayload,
  buildBatchPayload,
};