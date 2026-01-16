export enum FilterOperator {
    Contains = "contains",
    NotContains = "notContains",
    Equals = "equals",
    NotEquals = "notEquals",
    StartsWith = "startsWith",
    EndsWith = "endsWith",
    GreaterThan = "greaterThan",
    LessThan = "lessThan",
    IsNull = "isNull",
    IsNotNull = "isNotNull"
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
