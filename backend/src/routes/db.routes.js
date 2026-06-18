const express = require('express');
const dbController = require('../controllers/db.controller');

const router = express.Router();

router.get('/tables', dbController.getTables);
router.get('/tables/:tableName', dbController.getTableData);
router.put('/tables/:tableName/:id', dbController.updateTableRow);
router.delete('/tables/:tableName/:id', dbController.deleteTableRow);

module.exports = router;
