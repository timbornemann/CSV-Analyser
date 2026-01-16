import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { loadCsv, getTotalRows, getColumns, applySort, applyFilter, applyAdvancedFilter, applyGroupBy, getCurrentState } from './api';
import VirtualTable from './components/VirtualTable';
import Sidebar from './components/Sidebar';
import { FilterNode, AggregationType } from './types';
import './App.css';

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start loading to check state
  const [error, setError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [activeFilterNode, setActiveFilterNode] = useState<FilterNode | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const skipNextFilterRef = useRef(false);
  const filterDebounceMs = 400;

  // Check for existing state on mount (persist across reload)
  useEffect(() => {
      async function checkState() {
          try {
              const state = await getCurrentState();
              if (state.filePath) {
                  setFilePath(state.filePath);
                  setRowCount(state.rowCount);
                  setColumns(state.columns);
              }
          } catch (e) {
              console.error("Failed to restore state:", e);
          } finally {
              setLoading(false);
          }
      }
      checkState();
  }, []);

  async function handleSort(column: string) {
    const newDesc = sortCol === column ? !sortDesc : false;
    setSortCol(column);
    setSortDesc(newDesc);
    
    setLoading(true);
    await applySort(column, newDesc);
    setLoading(false);
  }

  async function runSimpleFilter(query: string) {
      setLoading(true);
      setIsFiltering(true);
      try {
          await applyFilter(null, query);
          const total = await getTotalRows();
          setRowCount(total);
      } catch (err: any) {
          setError(err.toString());
      } finally {
          setIsFiltering(false);
          setLoading(false);
      }
  }

  function handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
      const query = e.target.value;
      setFilterQuery(query);
      setActiveFilterNode(null);
  }

  async function handleClearFilter() {
      if (!filePath) {
          setFilterQuery("");
          return;
      }

      skipNextFilterRef.current = true;
      setFilterQuery("");

      if (activeFilterNode) {
          setIsFiltering(true);
          try {
              await handleAdvancedFilter(null);
          } finally {
              setIsFiltering(false);
          }
          return;
      }

      setActiveFilterNode(null);
      await runSimpleFilter("");
  }

  async function handleAdvancedFilter(node: FilterNode | null) {
      console.log("handleAdvancedFilter called with:", node);
      setLoading(true);
      setActiveFilterNode(node);
      try {
          if (!node) {
              console.log("Clearing filter...");
              setFilterQuery(""); 
              await applyFilter(null, "");
          } else {
            console.log("Applying advanced filter...");
            // Clear simple filter input visually
            setFilterQuery(""); 
            await applyAdvancedFilter(node);
          }
          console.log("Filter applied, fetching total rows...");
          const total = await getTotalRows();
          console.log("Total rows:", total);
          setRowCount(total);
      } catch (err: any) {
          console.error("Error in handleAdvancedFilter:", err);
          setError(err.toString());
      } finally {
          console.log("handleAdvancedFilter finally block");
          setLoading(false);
      }
  }

  useEffect(() => {
      if (!filePath || activeFilterNode) {
          return;
      }

      if (skipNextFilterRef.current) {
          skipNextFilterRef.current = false;
          return;
      }

      const timeout = window.setTimeout(() => {
          runSimpleFilter(filterQuery);
      }, filterDebounceMs);

      return () => window.clearTimeout(timeout);
  }, [filterQuery, filePath, activeFilterNode]);

  async function handleGroup(column: string, agg: AggregationType) {
      setLoading(true);
      try {
          // The backend updates current_df to the grouped result.
          await applyGroupBy(column, agg);
          // Fetch new counts/columns?
          // The grouped DF has specific columns. We should re-fetch columns.
          
          // But wait, the backend `apply_group_by` returns a String message? 
          // Yes, currently returns string. 
          // Ideally it should behave like filter and just update state.
          
          // Refresh data
          const cols = await getColumns();
          const total = await getTotalRows();
          
          setColumns(cols);
          setRowCount(total);
          
      } catch (err: any) {
          setError(err.toString());
      } finally {
          setLoading(false);
      }
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
        setActiveFilterNode(null);
        setIsFiltering(false);
        
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
            <div className="filter-control">
                <div className="filter-input-wrapper">
                    <input 
                        type="text" 
                        placeholder="Quick Filter..." 
                        className="filter-input"
                        value={filterQuery}
                        onChange={handleFilterChange}
                        disabled={!filePath}
                    />
                    {filterQuery.length > 0 && (
                        <button
                            type="button"
                            className="clear-filter-btn"
                            onClick={handleClearFilter}
                            aria-label="Clear filter"
                        >
                            ×
                        </button>
                    )}
                </div>
                {isFiltering && <span className="filter-status">Filtering…</span>}
            </div>
            <button onClick={handleOpenFile} className="primary-btn">
                {filePath ? 'Change File' : 'Open CSV'}
            </button>
            {filePath && <span className="file-info">{rowCount.toLocaleString()} rows</span>}
        </div>
      </header>

      <main className="content-area">
        {filePath && (
            <Sidebar 
                columns={columns} 
                onGroup={handleGroup} 
                activeFilterNode={activeFilterNode}
                onApplyFilter={handleAdvancedFilter}
            />
        )}

        <div className="table-wrapper" style={{ flex: 1 }}>
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
        </div>
      </main>
    </div>
  );
}

export default App;
