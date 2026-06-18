const { db } = require('../services/storage/postgres.service');
const { z } = require('zod');

// Schema for updating a single row column dynamically
const updateRowSchema = z.record(z.string(), z.any()).refine(data => Object.keys(data).length === 1, {
  message: "Updates must contain exactly one column-value pair"
});

async function getTables(req, res, next) {
  try {
    const tablesResult = await db.query(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'"
    );
    const tables = tablesResult.rows;
    
    const schemaData = [];
    for (const t of tables) {
      const columnsResult = await db.query(
        `SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_name = $1`,
        [t.name]
      );
      schemaData.push({
        name: t.name,
        columns: columnsResult.rows.map(c => ({
          name: c.name,
          type: c.type
        }))
      });
    }

    res.json({ success: true, tables: schemaData });
  } catch (error) {
    next(error);
  }
}

async function getTableData(req, res, next) {
  try {
    const { tableName } = req.params;
    
    // Prevent SQL injection by validating table name against schema
    const tableExistsRes = await db.query(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_name = $1",
      [tableName]
    );
    const tableExists = tableExistsRes.rows[0];
    
    if (!tableExists) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    // Check if created_at column exists for ordering
    const colsRes = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'created_at'",
      [tableName]
    );
    const orderCol = colsRes.rows.length > 0 ? 'created_at' : 'id';

    const dataRes = await db.query(`SELECT * FROM "${tableName}" ORDER BY "${orderCol}" DESC LIMIT 100`);
    const data = dataRes.rows;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateTableRow(req, res, next) {
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
    const tableExists = (await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = $1",
      [tableName]
    )).rows[0];
    
    if (!tableExists) return res.status(404).json({ success: false, error: 'Table not found' });

    const columnName = Object.keys(updates)[0];
    const value = updates[columnName];

    const result = await db.query(
      `UPDATE "${tableName}" SET "${columnName}" = $1 WHERE id = $2`,
      [value, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }

    res.json({ success: true, message: 'Row updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function deleteTableRow(req, res, next) {
  try {
    const { tableName, id } = req.params;

    // Validate table name
    const tableExists = (await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = $1",
      [tableName]
    )).rows[0];
    
    if (!tableExists) return res.status(404).json({ success: false, error: 'Table not found' });

    const result = await db.query(`DELETE FROM "${tableName}" WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
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
