import { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getRows, DataRow } from '../api';
import '../App.css';

interface VirtualTableProps {
  columns: string[];
  totalRows: number;
  onSort: (column: string) => void;
  sortColumn: string | null;
  sortDescending: boolean;
}

export default function VirtualTable({
  columns,
  totalRows,
  onSort,
  sortColumn,
  sortDescending,
}: VirtualTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Record<number, DataRow>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const [dataVersion, setDataVersion] = useState(0); // Force re-render trigger

  // Reset data cache when row count changes (filter applied)
  useEffect(() => {
    setData({});
    fetchingRef.current.clear();
    setDataVersion(0);
  }, [totalRows]);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 20,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    console.log(`VirtualTable useEffect triggered. items.length=${items.length}, totalRows=${totalRows}, dataVersion=${dataVersion}`);
    if (items.length === 0) return;

    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    
    const start = firstItem.index;
    const end = lastItem.index;
    const limit = end - start + 1;
    
    const fetchKey = `${start}-${end}`;
    
    // Check if we need to fetch
    let needsFetch = false;
    for (let i = start; i <= end; i++) {
        if (!data[i]) {
            needsFetch = true;
            break;
        }
    }

    if (needsFetch && !fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        console.log(`VirtualTable: Fetching rows ${start} to ${end} (limit ${limit})`);
        getRows(start, limit).then(rows => {
            console.log(`VirtualTable: Received ${rows.length} rows for request ${start}-${end}`);
            fetchingRef.current.delete(fetchKey);
            
            if (rows.length === 0) {
                 console.warn("VirtualTable: Received 0 rows! Stopping fetch loop for this range.");
                 return; 
            }
            setData(prev => {
                const newData = { ...prev };
                rows.forEach((row, i) => {
                    newData[start + i] = row;
                });
                console.log(`VirtualTable: Data state updated. Total cached rows: ${Object.keys(newData).length}`);
                return newData;
            });
            // Increment version to force re-render
            console.log(`VirtualTable: Incrementing dataVersion to trigger re-render`);
            setDataVersion(v => v + 1);
        }).catch(err => {
            console.error("VirtualTable: Fetch error:", err);
            fetchingRef.current.delete(fetchKey);
        });
    }

  }, [items, totalRows]); // dataVersion triggers re-render but shouldn't re-trigger effect

  return (
    <div className="table-wrapper">
      <div className="table-header-row">
        {columns.map(col => {
          const isActive = sortColumn === col;
          const sortIcon = isActive ? (sortDescending ? "↓" : "↑") : "";

          return (
            <div
              key={col}
              className={`table-header-cell${isActive ? " active" : ""}`}
              onClick={() => onSort(col)}
            >
              <span className="header-label">{col}</span>
              {sortIcon && <span className="sort-indicator">{sortIcon}</span>}
            </div>
          );
        })}
      </div>
      <div className="table-container" ref={parentRef}>

      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const rowData = data[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              className="table-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowData ? (
                columns.map((col) => (
                  <div key={col} className="table-cell" title={String(rowData[col])}>
                    {rowData[col]}
                  </div>
                ))
              ) : (
                <div className="table-row-loading">Loading...</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
