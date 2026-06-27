const express = require('express');
const dbController = require('../controllers/db.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

router.get('/tables', dbController.getTables);
router.get('/tables/:tableName', dbController.getTableData);
router.put('/tables/:tableName/:id', dbController.updateTableRow);
router.delete('/tables/:tableName/:id', dbController.deleteTableRow);

module.exports = router;
