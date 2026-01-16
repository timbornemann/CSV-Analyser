import { useState } from 'react';
import { FilterNode, FilterOperator, FilterCondition, FilterGroup } from '../types';
import './FilterBuilder.css';

interface FilterBuilderProps {
    columns: string[];
    onApply: (filter: FilterNode) => void;
    onClose: () => void;
}

const DEFAULT_CONDITION: FilterCondition = {
    column: '',
    operator: FilterOperator.Contains,
    value: ''
};

export default function FilterBuilder({ columns, onApply, onClose }: FilterBuilderProps) {
    const [root, setRoot] = useState<FilterNode>({
        logic: 'AND',
        conditions: []
    } as FilterGroup);

    const handleApply = () => {
        onApply(root);
        onClose();
    };

    const updateRoot = (newRoot: FilterNode) => {
        setRoot(newRoot);
    };

    return (
        <div className="filter-builder-overlay">
            <div className="filter-builder-modal">
                <header>
                    <h2>Advanced Filter Builder</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </header>
                <div className="filter-content">
                    <FilterNodeRenderer 
                        node={root} 
                        onChange={updateRoot} 
                        columns={columns} 
                        isRoot={true}
                        onRemove={() => {}} // Root cannot be removed
                    />
                </div>
                <footer>
                    <button onClick={onClose} className="secondary-btn">Cancel</button>
                    <button onClick={handleApply} className="primary-btn">Apply Filter</button>
                </footer>
            </div>
        </div>
    );
}

interface NodeRendererProps {
    node: FilterNode;
    onChange: (node: FilterNode) => void;
    onRemove: () => void;
    columns: string[];
    isRoot?: boolean;
}

function FilterNodeRenderer({ node, onChange, onRemove, columns, isRoot = false }: NodeRendererProps) {
    const isGroup = (n: FilterNode): n is FilterGroup => {
        return (n as FilterGroup).logic !== undefined;
    };

    if (isGroup(node)) {
        return (
            <div className={`filter-group ${isRoot ? 'root-group' : ''}`}>
                <div className="group-header">
                    <select 
                        value={node.logic} 
                        onChange={(e) => onChange({ ...node, logic: e.target.value as 'AND' | 'OR' })}
                        className="logic-select"
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                    <div className="group-actions">
                        <button onClick={() => {
                            const newGroup: FilterGroup = { logic: 'AND', conditions: [] };
                            onChange({ ...node, conditions: [...node.conditions, newGroup] });
                        }}>+ Group</button>
                        <button onClick={() => {
                            const newCond: FilterCondition = { ...DEFAULT_CONDITION, column: columns[0] || '' };
                            onChange({ ...node, conditions: [...node.conditions, newCond] });
                        }}>+ Condition</button>
                        {!isRoot && <button onClick={onRemove} className="remove-btn">Remove Group</button>}
                    </div>
                </div>
                <div className="group-children">
                    {node.conditions.map((child, idx) => (
                        <FilterNodeRenderer 
                            key={idx} 
                            node={child} 
                            columns={columns}
                            onChange={(updatedChild) => {
                                const newConditions = [...node.conditions];
                                newConditions[idx] = updatedChild;
                                onChange({ ...node, conditions: newConditions });
                            }}
                            onRemove={() => {
                                const newConditions = node.conditions.filter((_, i) => i !== idx);
                                onChange({ ...node, conditions: newConditions });
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    } else {
        const cond = node as FilterCondition;
        return (
            <div className="filter-condition">
                <select 
                    value={cond.column} 
                    onChange={(e) => onChange({ ...cond, column: e.target.value })}
                    className="column-select"
                >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                
                <select 
                    value={cond.operator} 
                    onChange={(e) => onChange({ ...cond, operator: e.target.value as FilterOperator })}
                    className="operator-select"
                >
                    {Object.values(FilterOperator).map(op => (
                        <option key={op} value={op}>{op}</option>
                    ))}
                </select>

                <input 
                    type="text" 
                    value={cond.value || ''} 
                    onChange={(e) => onChange({ ...cond, value: e.target.value })}
                    placeholder="Value..."
                />

                <button onClick={onRemove} className="remove-btn">×</button>
            </div>
        );
    }
}
