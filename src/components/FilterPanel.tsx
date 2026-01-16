import { useState, useEffect } from 'react';
import { FilterNode, FilterOperator, FilterCondition, FilterGroup } from '../types';
import './FilterPanel.css';

interface FilterPanelProps {
    columns: string[];
    activeFilterNode: FilterNode | null;
    onApply: (filter: FilterNode | null) => void;
}

interface LinearFilterItem {
    id: string; 
    logic: 'AND' | 'OR';
    column: string;
    operator: FilterOperator;
    value: string;
}

const DEFAULT_OPERATOR = FilterOperator.Contains;

export default function FilterPanel({ columns, activeFilterNode, onApply }: FilterPanelProps) {
    const [items, setItems] = useState<LinearFilterItem[]>([]);
    const [columnSearch, setColumnSearch] = useState('');
    const [sortColumns, setSortColumns] = useState(true);

    const baseColumns = sortColumns
        ? [...columns].sort((a, b) => a.localeCompare(b))
        : columns;
    const normalizedSearch = columnSearch.trim().toLowerCase();
    const filteredColumns = normalizedSearch
        ? baseColumns.filter((column) => column.toLowerCase().includes(normalizedSearch))
        : baseColumns;

    // Convert Tree -> Linear on load
    useEffect(() => {
        if (activeFilterNode) {
            const linear: LinearFilterItem[] = [];
            flattenTree(activeFilterNode, linear, 'AND'); // Root logic ignored
            setItems(linear);
        } else {
            // Default empty state
            setItems([]);
        }
    }, [activeFilterNode]);

    const createItem = (logic: 'AND' | 'OR'): LinearFilterItem => ({
        id: crypto.randomUUID(),
        logic,
        column: columns[0] || '',
        operator: DEFAULT_OPERATOR,
        value: ''
    });

    const flattenTree = (node: FilterNode, list: LinearFilterItem[], inheritedLogic: 'AND' | 'OR') => {
        // "logic" of an item represents the connection to the PREVIOUS chunk.
        // Simplified: We treat the first child of a group as taking the group's "logic" from the perspective of the parent,
        // but for a linear list, we just want to expand them.
        
        if ("logic" in node) { // Group
            const group = node as FilterGroup;
            group.conditions.forEach((child, idx) => {
                // If it's the first child, it inherits the logic connecting THIS group to the previous sibling.
                // If it's subsequent children, they use the group's internal logic.
                const logic = idx === 0 ? inheritedLogic : group.logic;
                 flattenTree(child, list, logic);
            });
        } else { // Condition
            const cond = node as FilterCondition;
            list.push({
                id: crypto.randomUUID(),
                logic: inheritedLogic,
                column: cond.column,
                operator: cond.operator,
                value: cond.value || ''
            });
        }
    };

    const convertToTree = (list: LinearFilterItem[]): FilterNode | null => {
        if (list.length === 0) return null;

        // Algorithm:
        // 1. Split list by 'OR'. These chunks are effectively "AND" groups.
        // 2. Wrap chunks in a root "OR".

        const orChunks: LinearFilterItem[][] = [];
        let currentChunk: LinearFilterItem[] = [];

        list.forEach((item, idx) => {
            if (idx === 0) {
                currentChunk.push(item);
            } else {
                if (item.logic === 'OR') {
                    orChunks.push(currentChunk);
                    currentChunk = [item];
                } else {
                    currentChunk.push(item);
                }
            }
        });
        if (currentChunk.length > 0) orChunks.push(currentChunk);

        // Convert chunks to nodes
        const chunkNodes = orChunks.map(chunk => {
             if (chunk.length === 1) {
                 return toCondition(chunk[0]);
             } else {
                 return {
                     logic: 'AND',
                     conditions: chunk.map(toCondition)
                 } as FilterGroup;
             }
        });

        if (chunkNodes.length === 1) {
            return chunkNodes[0];
        } else {
            return {
                logic: 'OR',
                conditions: chunkNodes
            } as FilterGroup;
        }
    };

    const toCondition = (item: LinearFilterItem): FilterCondition => ({
        column: item.column,
        operator: item.operator,
        value: item.value
    });

    const handleApply = () => {
        const tree = convertToTree(items);
        onApply(tree);
    };

    const handleClear = () => {
        setItems([]);
        onApply(null);
    };

    const updateItem = (index: number, updates: Partial<LinearFilterItem>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, createItem('AND')]);
    };

    const addOrGroup = () => {
        if (items.length === 0) {
            setItems([createItem('AND')]);
            return;
        }
        setItems([...items, createItem('OR')]);
    };

    const groupedItems = items.reduce<{ item: LinearFilterItem; index: number }[][]>((groups, item, index) => {
        if (index === 0 || item.logic === 'OR') {
            groups.push([]);
        }
        groups[groups.length - 1].push({ item, index });
        return groups;
    }, []);

    const tokenLabel = (index: number) => {
        const letter = String.fromCharCode(65 + (index % 26));
        const suffix = index >= 26 ? `${Math.floor(index / 26)}` : '';
        return `${letter}${suffix}`;
    };

    const filterSummary = groupedItems.length
        ? groupedItems
              .map(group => `(${group.map(({ index }) => tokenLabel(index)).join(' AND ')})`)
              .join(' OR ')
        : 'No filters yet';

    return (
        <div className="filter-panel">
            <div className="filter-list">
                <div className="filter-column-tools">
                    <input
                        type="text"
                        value={columnSearch}
                        onChange={(event) => setColumnSearch(event.target.value)}
                        placeholder="Search columns"
                        className="column-search-input"
                    />
                    <label className="column-sort-toggle">
                        <input
                            type="checkbox"
                            checked={sortColumns}
                            onChange={(event) => setSortColumns(event.target.checked)}
                        />
                        Sort columns A–Z
                    </label>
                </div>
                <div className="filter-summary">
                    <span className="summary-label">Summary</span>
                    <span className="summary-text">{filterSummary}</span>
                </div>
                {groupedItems.map((group, groupIndex) => (
                    <div key={group[0].item.id} className="or-group">
                        <div className="or-group-header">
                            <span className="or-group-title">OR Group {groupIndex + 1}</span>
                        </div>
                        <div className="or-group-body">
                            {group.map(({ item, index }) => (
                                <div key={item.id} className="linear-filter-row">
                                    <div className="row-logic">
                                        <span className="filter-token">{tokenLabel(index)}</span>
                                        {index === 0 ? (
                                            <span className="logic-static">Where</span>
                                        ) : (
                                            <select
                                                className={`logic-select ${item.logic === 'AND' ? 'logic-and' : 'logic-or'}`}
                                                value={item.logic}
                                                onChange={(e) => updateItem(index, { logic: e.target.value as 'AND' | 'OR' })}
                                            >
                                                <option value="AND">AND</option>
                                                <option value="OR">OR</option>
                                            </select>
                                        )}
                                    </div>

                                    <div className="row-inputs">
                                        <div className="input-group">
                                            <select
                                                value={item.column}
                                                onChange={(e) => updateItem(index, { column: e.target.value })}
                                                className="col-select"
                                            >
                                                {item.column && !filteredColumns.includes(item.column) && (
                                                    <option value={item.column}>{item.column}</option>
                                                )}
                                                {filteredColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button onClick={() => removeItem(index)} className="icon-btn remove-btn">×</button>
                                        </div>

                                        <div className="input-group">
                                            <select
                                                value={item.operator}
                                                onChange={(e) => updateItem(index, { operator: e.target.value as FilterOperator })}
                                                className="op-select"
                                            >
                                                {Object.values(FilterOperator).map(op => (
                                                    <option key={op} value={op}>{op}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="input-group">
                                            <input
                                                type="text"
                                                value={item.value}
                                                onChange={(e) => updateItem(index, { value: e.target.value })}
                                                placeholder="Value"
                                                className="val-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="filter-actions-bar">
                 <button onClick={addItem} className="add-btn">+ Add Condition</button>
                 <button onClick={addOrGroup} className="add-btn secondary-add-btn">+ Add OR Group</button>
            </div>
            
            <div className="filter-footer">
                <button onClick={handleClear} className="secondary-btn small-btn">Clear</button>
                <button onClick={handleApply} className="primary-btn small-btn">Apply Filter</button>
            </div>
        </div>
    );
}
