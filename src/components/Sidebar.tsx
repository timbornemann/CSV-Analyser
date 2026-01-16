import { useState } from 'react';
import { AggregationType } from '../types';
import './Sidebar.css';

interface SidebarProps {
    columns: string[];
    onGroup: (column: string, agg: AggregationType) => void;
}

export default function Sidebar({ columns, onGroup }: SidebarProps) {
    const [selectedCol, setSelectedCol] = useState(columns[0] || '');
    const [selectedAgg, setSelectedAgg] = useState<AggregationType>(AggregationType.Count);

    const handleApply = () => {
        if (selectedCol) {
            onGroup(selectedCol, selectedAgg);
        }
    };

    return (
        <aside className="sidebar">
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

            <button onClick={handleApply} className="primary-btn full-width">
                Apply Grouping
            </button>
        </aside>
    );
}
