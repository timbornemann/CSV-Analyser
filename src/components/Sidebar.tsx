import { useState } from 'react';
import FilterPanel from './FilterPanel';
import { FilterNode, AggregationType, GroupingInfo } from '../types';
import './Sidebar.css';

interface SidebarProps {
    columns: string[];
    onGroup: (column: string, agg: AggregationType) => void;
    groupingInfo: GroupingInfo | null;
    onResetGrouping: () => void;
    activeFilterNode: FilterNode | null;
    onApplyFilter: (node: FilterNode | null) => void;
}

export default function Sidebar({ columns, onGroup, groupingInfo, onResetGrouping, activeFilterNode, onApplyFilter }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'grouping' | 'filter'>('grouping');
    const [selectedCol, setSelectedCol] = useState(columns[0] || '');
    const [selectedAgg, setSelectedAgg] = useState<AggregationType>(AggregationType.Count);
    const [groupSearch, setGroupSearch] = useState('');
    const [sortColumns, setSortColumns] = useState(true);

    const baseColumns = sortColumns
        ? [...columns].sort((a, b) => a.localeCompare(b))
        : columns;
    const normalizedGroupSearch = groupSearch.trim().toLowerCase();
    const filteredColumns = normalizedGroupSearch
        ? baseColumns.filter((column) => column.toLowerCase().includes(normalizedGroupSearch))
        : baseColumns;
    const groupColumnOptions = selectedCol && !filteredColumns.includes(selectedCol)
        ? [selectedCol, ...filteredColumns]
        : filteredColumns;

    const handleApplyGroup = () => {
        if (selectedCol) {
            onGroup(selectedCol, selectedAgg);
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'grouping' ? 'active' : ''}`}
                    onClick={() => setActiveTab('grouping')}
                >
                    Grouping
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'filter' ? 'active' : ''}`}
                    onClick={() => setActiveTab('filter')}
                >
                    Filters
                </button>
            </div>

            <div className="sidebar-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'grouping' ? (
                    <div className="grouping-panel">
                        <h3>Grouping</h3>
                        {groupingInfo && (
                            <div className="grouping-status">
                                <p>
                                    Aggregated view: <strong>{groupingInfo.column}</strong> · <strong>{groupingInfo.aggregation}</strong>
                                </p>
                                <button onClick={onResetGrouping} className="secondary-btn full-width">
                                    Reset Grouping (Back to Raw Rows)
                                </button>
                            </div>
                        )}
                        <div className="control-group">
                            <label>Group By Column</label>
                            <input
                                type="text"
                                value={groupSearch}
                                onChange={(event) => setGroupSearch(event.target.value)}
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
                            <select 
                                value={selectedCol} 
                                onChange={(e) => setSelectedCol(e.target.value)}
                            >
                                <option value="">Select Column...</option>
                                {groupColumnOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="control-group">
                            <label>Aggregation</label>
                            <select 
                                value={selectedAgg} 
                                onChange={(e) => setSelectedAgg(e.target.value as AggregationType)}
                            >
                                {Object.values(AggregationType).map(agg => (
                                    <option key={agg} value={agg}>{agg}</option>
                                ))}
                            </select>
                        </div>

                        <button onClick={handleApplyGroup} className="primary-btn full-width">
                            Apply Grouping
                        </button>
                    </div>
                ) : (
                    <FilterPanel 
                        columns={columns}
                        activeFilterNode={activeFilterNode}
                        onApply={onApplyFilter}
                    />
                )}
            </div>
        </aside>
    );
}
