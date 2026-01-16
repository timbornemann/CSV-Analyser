import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { loadCsv, getTotalRows, getColumns, applySort, applyFilter } from './api';
import VirtualTable from './components/VirtualTable';
import './App.css';

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  async function handleSort(column: string) {
    const newDesc = sortCol === column ? !sortDesc : false;
    setSortCol(column);
    setSortDesc(newDesc);
    
    setLoading(true);
    await applySort(column, newDesc);
    setLoading(false);
  }

  async function handleFilter(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setFilterQuery(query);
    
    // Debounce this in production
    // For now, instant trigger
    await applyFilter(null, query);
    
    // Update count
    const total = await getTotalRows();
    setRowCount(total);
  }

  async function handleOpenFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (selected && typeof selected === 'string') {
        setLoading(true);
        setError(null);
        setFilePath(selected);
        
        // Reset state
        setSortCol(null);
        setFilterQuery("");
        
        // Load data in backend
        await loadCsv(selected);
        
        // Fetch metadata
        const total = await getTotalRows();
        const cols = await getColumns();
        
        setRowCount(total);
        setColumns(cols);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.toString());
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>CSV High Performance Analyzer</h1>
        <div className="controls">
            <input 
                type="text" 
                placeholder="Filter..." 
                className="filter-input"
                value={filterQuery}
                onChange={handleFilter}
                disabled={!filePath}
            />
            <button onClick={handleOpenFile} className="primary-btn">
                {filePath ? 'Change File' : 'Open CSV'}
            </button>
            {filePath && <span className="file-info">{rowCount.toLocaleString()} rows</span>}
        </div>
      </header>

      <main className="content-area">
        {loading && <div className="loading-overlay">Loading / Processing...</div>}
        
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && rowCount > 0 && (
            <VirtualTable columns={columns} totalRows={rowCount} onSort={handleSort} />
        )}

        {!loading && !filePath && (
            <div className="empty-state">
                <h2>No File Loaded</h2>
                <p>Open a CSV file to begin analysis (supports 3M+ rows).</p>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
