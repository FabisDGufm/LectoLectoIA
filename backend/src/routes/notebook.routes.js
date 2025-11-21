const express = require('express');
const router = express.Router();
const {
  getActiveNotebook,
  createNotebook,
  addPagesToNotebook,
  addBlankPage,
  reorderPages,
  deletePage,
  toggleBookMode,
  movePage
} = require('../controllers/notebook.controller');

router.get('/active', getActiveNotebook);

router.post('/', createNotebook);

router.post('/:id/pages', addPagesToNotebook);

router.post('/:id/blank', addBlankPage);

router.put('/:id/reorder', reorderPages);

router.put('/:id/move', movePage);

router.put('/:id/book-mode', toggleBookMode);

router.delete('/:id/pages/:pageId', deletePage);

module.exports = router;
