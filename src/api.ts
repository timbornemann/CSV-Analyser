import { invoke } from "@tauri-apps/api/core";

export interface DataRow {
  [key: string]: string | number | null;
}

export async function loadCsv(path: string): Promise<number> {
  return await invoke("load_csv", { path });
}

export async function getTotalRows(): Promise<number> {
  return await invoke("get_total_rows");
}

export async function getColumns(): Promise<string[]> {
  return await invoke("get_columns");
}

export async function getRows(offset: number, limit: number): Promise<DataRow[]> {
  const json = await invoke<string>("get_rows", { offset, limit });
  return JSON.parse(json);
}

export async function applySort(column: string, descending: boolean): Promise<number> {
  return await invoke("apply_sort", { column, descending });
}

export async function applyFilter(column: string | null, query: string): Promise<number> {
  return await invoke("apply_filter", { column, query });
}

export async function applyAdvancedFilter(filterTree: any): Promise<number> {
    console.log("Invoking apply_advanced_filter with:", JSON.stringify(filterTree, null, 2));
    try {
        const res = await invoke("apply_advanced_filter", { filterTree });
        console.log("apply_advanced_filter result:", res);
        return res as number;
    } catch (e) {
        console.error("apply_advanced_filter failed:", e);
        throw e;
    }
}

export async function applyGroupBy(column: string, agg: string): Promise<string> {
    return await invoke("apply_group_by", { column, agg });
}

export async function resetGrouping(): Promise<number> {
    return await invoke("reset_grouping");
}

export async function getCurrentState(): Promise<import("./types").AppStateInfo> {
    return await invoke("get_current_state");
}
