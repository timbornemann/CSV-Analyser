import { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getRows, DataRow } from '../api';
import '../App.css';

interface VirtualTableProps {
  columns: string[];
  totalRows: number;
  onSort: (column: string) => void;
}

export default function VirtualTable({ columns, totalRows, onSort }: VirtualTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Record<number, DataRow>>({});

  // Reset data cache when row count changes (filter applied)
  useEffect(() => {
    setData({});
  }, [totalRows]);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 20,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    if (items.length === 0) return;

    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    
    const start = firstItem.index;
    const end = lastItem.index;
    const limit = end - start + 1;
    
    // Check if we need to fetch
    let needsFetch = false;
    for (let i = start; i <= end; i++) {
        if (!data[i]) {
            needsFetch = true;
            break;
        }
    }

    if (needsFetch) {
        getRows(start, limit).then(rows => {
            setData(prev => {
                const newData = { ...prev };
                rows.forEach((row, i) => {
                    newData[start + i] = row;
                });
                return newData;
            });
        }).catch(console.error);
    }

  }, [items, data, totalRows]); // Depend on totalRows to re-fetch after sort/filter

  return (
    <div className="table-wrapper">
      <div className="table-header-row">
        {columns.map(col => (
            <div key={col} className="table-header-cell" onClick={() => onSort(col)}>
                {col} ↕
            </div>
        ))}
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
