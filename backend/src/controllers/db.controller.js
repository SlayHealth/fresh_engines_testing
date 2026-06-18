const { db } = require('../services/storage/sqlite.service');
const { z } = require('zod');

// Schema for updating a single row column dynamically
const updateRowSchema = z.record(z.string(), z.any()).refine(data => Object.keys(data).length === 1, {
  message: "Updates must contain exactly one column-value pair"
});

function getTables(req, res, next) {
  try {
    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = tablesQuery.all();
    
    const schemaData = tables.map(t => {
      const columnsQuery = db.prepare(`PRAGMA table_info('${t.name}')`);
      return {
        name: t.name,
        columns: columnsQuery.all()
      };
    });

    res.json({ success: true, tables: schemaData });
  } catch (error) {
    next(error);
  }
}

function getTableData(req, res, next) {
  try {
    const { tableName } = req.params;
    
    // Prevent SQL injection by validating table name against schema
    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
    const tableExists = tablesQuery.get(tableName);
    
    if (!tableExists) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    const dataQuery = db.prepare(`SELECT * FROM "${tableName}" ORDER BY rowid DESC LIMIT 100`);
    const data = dataQuery.all();

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function updateTableRow(req, res, next) {
  try {
    const { tableName, id } = req.params;
    
    // Validate request body using Zod
    const validation = updateRowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0].message 
      });
    }

    const updates = validation.data;

    // Validate table name
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    if (!tableExists) return res.status(404).json({ success: false, error: 'Table not found' });

    const columnName = Object.keys(updates)[0];
    const value = updates[columnName];

    const updateQuery = db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE id = ?`);
    const info = updateQuery.run(value, id);

    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }

    res.json({ success: true, message: 'Row updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function deleteTableRow(req, res, next) {
  try {
    const { tableName, id } = req.params;

    // Validate table name
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    if (!tableExists) return res.status(404).json({ success: false, error: 'Table not found' });

    const deleteQuery = db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`);
    const info = deleteQuery.run(id);

    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }

    res.json({ success: true, message: 'Row deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTables,
  getTableData,
  updateTableRow,
  deleteTableRow
};
