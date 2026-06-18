'use client';

import { useState, useEffect } from 'react';
import { Database, Table as TableIcon, LayoutGrid, Loader2, AlertCircle, Eye, X } from 'lucide-react';
import styles from './page.module.css';
import { API_URL } from '../../config/api';

export default function DatabaseViewer() {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Editing state
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName, value }
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewingJson, setViewingJson] = useState(null); // stores the json string to view

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (activeTable) {
      fetchTableData(activeTable);
    }
  }, [activeTable]);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/api/db/tables`);
      const data = await response.json();
      
      if (data.success) {
        setTables(data.tables);
        if (data.tables.length > 0) {
          setActiveTable(data.tables[0].name);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch tables. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableData = async (tableName) => {
    setIsDataLoading(true);
    setEditingCell(null);
    try {
      const response = await fetch(`${API_URL}/api/db/tables/${tableName}`);
      const data = await response.json();
      
      if (data.success) {
        setTableData(data.data);
        const tableSchema = tables.find(t => t.name === tableName);
        if (tableSchema) {
          setColumns(tableSchema.columns.map(c => c.name));
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(`Failed to fetch data for ${tableName}`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleUpdateCell = async (rowIndex, colName, newValue) => {
    const row = tableData[rowIndex];
    if (row[colName] == newValue) {
      setEditingCell(null);
      return; // No change
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/db/tables/${activeTable}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [colName]: newValue })
      });
      const data = await response.json();
      if (data.success) {
        const newData = [...tableData];
        newData[rowIndex][colName] = newValue;
        setTableData(newData);
      } else {
        setError(data.error || 'Failed to update');
      }
    } catch (err) {
      setError('Connection to backend failed during update.');
    } finally {
      setIsUpdating(false);
      setEditingCell(null);
    }
  };

  const handleDeleteRow = async (id) => {
    if (!confirm('Are you sure you want to delete this row?')) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/db/tables/${activeTable}/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setTableData(tableData.filter(row => row.id !== id));
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Connection to backend failed during delete.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container} style={{display:'flex', justifyContent:'center', alignItems:'center'}}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Database size={32} style={{display:'inline', marginRight:'12px', verticalAlign:'bottom'}}/>
          Database Viewer
        </h1>
        <p style={{color: '#9ca3af', marginTop: '0.5rem'}}>
          Inspect internal SQLite tables and extraction logs.
        </p>
      </header>

      {error && (
        <div style={{ color: 'var(--error)', marginBottom: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid var(--error)' }}>
          <AlertCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {error}
        </div>
      )}

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h3 style={{color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', marginLeft: '0.5rem'}}>Tables</h3>
          <ul className={styles.tableList}>
            {tables.map(table => (
              <li 
                key={table.name}
                className={`${styles.tableItem} ${activeTable === table.name ? styles.tableItemActive : ''}`}
                onClick={() => setActiveTable(table.name)}
              >
                <TableIcon size={16} />
                {table.name}
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className={styles.content}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableName}>{activeTable || 'Select a table'}</h2>
            <span style={{color: '#9ca3af', fontSize: '0.9rem'}}>
              {tableData.length} row(s)
            </span>
          </div>

          {isDataLoading ? (
            <div className={styles.loader}>
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : tableData.length > 0 ? (
            <div className={styles.dataGridContainer}>
              <table className={styles.dataGrid}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => {
                        let val = row[col];
                        
                        const isEditing = editingCell?.rowIndex === i && editingCell?.colName === col;
                        
                        if (isEditing) {
                          return (
                            <td key={col}>
                              <input 
                                autoFocus
                                className={styles.editInput}
                                value={editingCell.value}
                                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                onBlur={() => handleUpdateCell(i, col, editingCell.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateCell(i, col, editingCell.value);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            </td>
                          );
                        }

                        let displayVal = val !== null ? val.toString() : 'NULL';
                        if (displayVal.length > 50) {
                          displayVal = displayVal.substring(0, 50) + '...';
                        }
                        
                        return (
                          <td 
                            key={col} 
                            onDoubleClick={() => setEditingCell({ rowIndex: i, colName: col, value: val || '' })}
                            style={{ cursor: col !== 'id' ? 'text' : 'default', color: val === null ? '#6b7280' : 'inherit' }}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                      <td style={{ display: 'flex', gap: '8px' }}>
                        {activeTable === 'reports' && row.extracted_json && (
                          <button 
                            className={styles.actionButton}
                            onClick={() => setViewingJson(row.extracted_json)}
                            title="View Extracted JSON"
                            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleDeleteRow(row.id)}
                          title="Delete row"
                          disabled={isUpdating}
                        >
                          <AlertCircle size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <LayoutGrid size={48} className={styles.emptyIcon} />
              <h3>No Data Found</h3>
              <p>This table is currently empty.</p>
            </div>
          )}
        </main>
      </div>

      {/* JSON Viewer Modal */}
      {viewingJson && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div className={styles['glass-panel']} style={{
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Extracted JSON Data</h3>
              <button onClick={() => setViewingJson(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.3)',
              padding: '1rem',
              borderRadius: '8px',
              flex: 1
            }}>
              <pre style={{ margin: 0, color: '#e5e7eb', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(viewingJson), null, 2);
                  } catch (e) {
                    return viewingJson; // Fallback if not valid JSON
                  }
                })()}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
