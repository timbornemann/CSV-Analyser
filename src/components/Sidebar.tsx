import { useState } from 'react';
import FilterPanel from './FilterPanel';
import { FilterNode, AggregationType } from '../types';
import './Sidebar.css';

interface SidebarProps {
    columns: string[];
    onGroup: (column: string, agg: AggregationType) => void;
    activeFilterNode: FilterNode | null;
    onApplyFilter: (node: FilterNode | null) => void;
}

export default function Sidebar({ columns, onGroup, activeFilterNode, onApplyFilter }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'grouping' | 'filter'>('grouping');
    const [selectedCol, setSelectedCol] = useState(columns[0] || '');
    const [selectedAgg, setSelectedAgg] = useState<AggregationType>(AggregationType.Count);

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
                        <div className="control-group">
                            <label>Group By Column</label>
                            <select 
                                value={selectedCol} 
                                onChange={(e) => setSelectedCol(e.target.value)}
                            >
                                <option value="">Select Column...</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
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
