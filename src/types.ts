export enum FilterOperator {
    Contains = "Contains",
    NotContains = "NotContains",
    Equals = "Equals",
    NotEquals = "NotEquals",
    StartsWith = "StartsWith",
    EndsWith = "EndsWith",
    GreaterThan = "GreaterThan",
    LessThan = "LessThan",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull"
}

export interface FilterCondition {
    column: string;
    operator: FilterOperator;
    value?: string;
}

export interface FilterGroup {
    logic: "AND" | "OR";
    conditions: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export enum AggregationType {
    Count = "Count",
    Sum = "Sum",
    Mean = "Mean",
    Min = "Min",
    Max = "Max"
}

export interface AppStateInfo {
    filePath: string | null;
    rowCount: number;
    columns: string[];
}
