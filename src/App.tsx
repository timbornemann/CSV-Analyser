import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { loadCsv, getTotalRows, getColumns, applySort, applyFilter, applyAdvancedFilter, applyGroupBy, resetGrouping, getCurrentState } from './api';
import VirtualTable from './components/VirtualTable';
import Sidebar from './components/Sidebar';
import { FilterNode, AggregationType, GroupingInfo } from './types';
import './App.css';

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start loading to check state
  const [error, setError] = useState<string | null>(null);
  const [groupingInfo, setGroupingInfo] = useState<GroupingInfo | null>(null);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [activeFilterNode, setActiveFilterNode] = useState<FilterNode | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedFilterMode, setSelectedFilterMode] = useState<'quick' | 'advanced'>('quick');
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const skipNextFilterRef = useRef(false);
  const filterDebounceMs = 400;
  const activeFilterMode = activeFilterNode ? 'advanced' : (filterQuery.trim().length > 0 ? 'quick' : 'none');
  const isQuickFilterOverridden = activeFilterMode === 'advanced';

  // Check for existing state on mount (persist across reload)
  useEffect(() => {
      async function checkState() {
          try {
              const state = await getCurrentState();
              if (state.filePath) {
                  setFilePath(state.filePath);
                  setRowCount(state.rowCount);
                  setColumns(state.columns);
                  setGroupingInfo(state.grouping);
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
    let nextSortCol: string | null = column;
    let nextSortDesc = false;

    if (sortCol === column) {
      if (!sortDesc) {
        nextSortDesc = true;
      } else {
        nextSortCol = null;
      }
    }

    setSortCol(nextSortCol);
    setSortDesc(nextSortDesc);

    setLoading(true);
    await applySort(nextSortCol, nextSortDesc);
    setLoading(false);
  }

  async function runSimpleFilter(query: string) {
      setLoading(true);
      setIsFiltering(true);
      try {
          await applyFilter(null, query);
          const total = await getTotalRows();
          setRowCount(total);
          setGroupingInfo(null);
      } catch (err: any) {
          setError(err.toString());
      } finally {
          setIsFiltering(false);
          setLoading(false);
      }
  }

  function handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
      const query = e.target.value;
      if (activeFilterNode) {
          setFilterNotice("Advanced-Filter wurde deaktiviert, weil der Quick Filter geändert wurde.");
      }
      setFilterQuery(query);
      setActiveFilterNode(null);
      setSelectedFilterMode('quick');
  }

  async function handleClearFilter() {
      if (!filePath) {
          setFilterQuery("");
          setActiveFilterNode(null);
          setFilterNotice(null);
          return;
      }

      skipNextFilterRef.current = true;
      setFilterQuery("");
      setFilterNotice(null);
      setSelectedFilterMode('quick');

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
            if (filterQuery.trim().length > 0) {
                setFilterNotice("Quick Filter wurde deaktiviert, weil ein Advanced-Filter aktiv ist.");
            }
            setFilterQuery(""); 
            await applyAdvancedFilter(node);
          }
          console.log("Filter applied, fetching total rows...");
          const total = await getTotalRows();
          console.log("Total rows:", total);
          setRowCount(total);
          setGroupingInfo(null);
          if (node) {
              setSelectedFilterMode('advanced');
          } else if (!filterQuery.trim()) {
              setSelectedFilterMode('quick');
          }
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

  async function handleFilterModeToggle(nextMode: 'quick' | 'advanced') {
      if (selectedFilterMode === nextMode) {
          return;
      }

      const switchingFromQuick = activeFilterMode === 'quick' && nextMode === 'advanced';
      const switchingFromAdvanced = activeFilterMode === 'advanced' && nextMode === 'quick';

      if (switchingFromQuick || switchingFromAdvanced) {
          const confirmed = window.confirm("Beim Wechsel des Filtermodus wird der aktive Filter gelöscht. Fortfahren?");
          if (!confirmed) {
              return;
          }
      }

      if (switchingFromQuick) {
          setFilterNotice("Quick Filter wurde deaktiviert, weil auf Advanced-Filter gewechselt wurde.");
          await runSimpleFilter("");
          setFilterQuery("");
      }

      if (switchingFromAdvanced) {
          setFilterNotice("Advanced-Filter wurde deaktiviert, weil auf Quick Filter gewechselt wurde.");
          await handleAdvancedFilter(null);
      }

      if (!switchingFromQuick && !switchingFromAdvanced) {
          setFilterNotice(`Filtermodus gewechselt: ${nextMode === 'quick' ? 'Quick Filter' : 'Advanced Filter'}.`);
      }

      setSelectedFilterMode(nextMode);
  }

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
          setGroupingInfo({ column, aggregation: agg });
          
      } catch (err: any) {
          setError(err.toString());
      } finally {
          setLoading(false);
      }
  }

  async function handleClearSort() {
      if (!filePath || !sortCol) {
          setSortCol(null);
          setSortDesc(false);
          return;
      }

      setLoading(true);
      try {
          setSortCol(null);
          setSortDesc(false);
          await applySort(null, false);
      } catch (err: any) {
          setError(err.toString());
      } finally {
          setLoading(false);
      }
  }

  async function handleResetGrouping() {
      setLoading(true);
      try {
          await resetGrouping();
          const total = await getTotalRows();
          const cols = await getColumns();
          setRowCount(total);
          setColumns(cols);
          setGroupingInfo(null);
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
        setGroupingInfo(null);
        
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
                <div className="filter-toggle" role="group" aria-label="Filtermodus">
                    <button
                        type="button"
                        className={`filter-toggle-btn ${selectedFilterMode === 'quick' ? 'active' : ''}`}
                        onClick={() => handleFilterModeToggle('quick')}
                        disabled={!filePath}
                    >
                        Quick Filter
                    </button>
                    <button
                        type="button"
                        className={`filter-toggle-btn ${selectedFilterMode === 'advanced' ? 'active' : ''}`}
                        onClick={() => handleFilterModeToggle('advanced')}
                        disabled={!filePath}
                    >
                        Advanced Filter
                    </button>
                </div>
                <div className="filter-input-wrapper">
                    <input 
                        type="text" 
                        placeholder="Quick Filter..." 
                        className={`filter-input ${isQuickFilterOverridden ? 'filter-input-overridden' : ''}`}
                        value={filterQuery}
                        onChange={handleFilterChange}
                        disabled={!filePath || isQuickFilterOverridden}
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
                {isQuickFilterOverridden && (
                    <span className="filter-override">Quick Filter überschrieben</span>
                )}
                {isFiltering && <span className="filter-status">Filtering…</span>}
            </div>
            <button onClick={handleOpenFile} className="primary-btn">
                {filePath ? 'Change File' : 'Open CSV'}
            </button>
            {filePath && <span className="file-info">{rowCount.toLocaleString()} rows</span>}
        </div>
      </header>

      {filePath && (
        <div className="status-strip" role="status" aria-live="polite">
          <div className="status-chip status-chip-neutral">
            <span>
              Filtermodus: {activeFilterMode === 'quick' ? 'Quick Filter' : activeFilterMode === 'advanced' ? 'Advanced Filter' : 'Keiner'}
            </span>
          </div>
          {filterNotice && (
            <div className="status-chip status-chip-warning">
              <span>{filterNotice}</span>
              <button
                type="button"
                className="status-chip-clear"
                onClick={() => setFilterNotice(null)}
                aria-label="Hinweis schließen"
                title="Hinweis schließen"
              >
                ×
              </button>
            </div>
          )}
          {sortCol && (
            <div className="status-chip">
              <span>Sort: {sortCol} {sortDesc ? "↓" : "↑"}</span>
              <button
                type="button"
                className="status-chip-clear"
                onClick={handleClearSort}
                aria-label="Clear sort"
                title="Clear sort"
              >
                ×
              </button>
            </div>
          )}
          {(filterQuery.trim().length > 0 || activeFilterNode) && (
            <div className="status-chip">
              <span>
                Filter: {activeFilterNode ? "Advanced Filter aktiv" : `Quick Filter "${filterQuery}"`}
              </span>
              <button
                type="button"
                className="status-chip-clear"
                onClick={handleClearFilter}
                aria-label="Clear filters"
                title="Clear filters"
              >
                ×
              </button>
            </div>
          )}
          {groupingInfo && (
            <div className="status-chip">
              <span>
                Grouping: {groupingInfo.column} ({groupingInfo.aggregation})
              </span>
              <button
                type="button"
                className="status-chip-clear"
                onClick={handleResetGrouping}
                aria-label="Reset grouping"
                title="Reset grouping"
              >
                ×
              </button>
            </div>
          )}
          {!sortCol && !filterQuery.trim() && !activeFilterNode && !groupingInfo && !filterNotice && (
            <span className="status-empty">No active sort, filters, or grouping.</span>
          )}
        </div>
      )}

      <main className="content-area">
        {filePath && (
            <Sidebar 
                columns={columns} 
                onGroup={handleGroup} 
                groupingInfo={groupingInfo}
                onResetGrouping={handleResetGrouping}
                activeFilterNode={activeFilterNode}
                onApplyFilter={handleAdvancedFilter}
            />
        )}

        <div className="table-wrapper" style={{ flex: 1 }}>
            {loading && <div className="loading-overlay">Loading / Processing...</div>}
            
            {error && <div className="error-banner">{error}</div>}

            {!loading && !error && rowCount > 0 && (
                <VirtualTable
                    columns={columns}
                    totalRows={rowCount}
                    onSort={handleSort}
                    sortColumn={sortCol}
                    sortDescending={sortDesc}
                />
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
