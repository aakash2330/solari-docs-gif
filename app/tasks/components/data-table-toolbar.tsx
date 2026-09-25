"use client"

import * as React from "react"
import { type ReactTable, type RowData } from "@tanstack/react-table"
import { Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"

import { priorities, statuses } from "../data/data"
import { type Task } from "../data/schema"
import { useTasks } from "../store"
import { useOpenTweak, useTweaks } from "../../tweaks"
import type { Tweaks } from "../../../pipeline/serve"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { type TasksTableFeatures } from "./data-table-features"
import { TaskDialog } from "./task-dialog"

interface DataTableToolbarProps<TData extends RowData> {
  table: ReactTable<TasksTableFeatures, TData>
}

export function DataTableToolbar<TData extends RowData>({
  table,
}: DataTableToolbarProps<TData>) {
  const { remove } = useTasks()
  const tweaks = useTweaks()
  const open = useOpenTweak()
  const [adding, setAdding] = React.useState(false)
  const isFiltered = table.state.columnFilters.length > 0
  const selected = table.getFilteredSelectedRowModel().rows.map((r) => (r.original as Task).id)
  const bulk = (fn: (ids: string[]) => void) => () => {
    fn(selected)
    table.resetRowSelection()
  }

  // The search box and each filter chip render in the slot the Tweak panel put
  // them in, ringed in blue while their row of the panel is open.
  const slot = (id: keyof Tweaks, el: React.ReactNode) => (
    <span
      key={id}
      data-tweak={id}
      style={{ viewTransitionName: id }}
      className={`inline-flex rounded-md ${open === id ? "tweak-ring" : ""}`}
    >
      {el}
    </span>
  )
  const at = (pos: Tweaks["search"]) => [
    tweaks.search === pos &&
      slot(
        "search",
        <Input
          placeholder="Filter tasks..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("title")?.setFilterValue(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />,
      ),
    tweaks.status === pos &&
      table.getColumn("status") &&
      slot("status", <DataTableFacetedFilter column={table.getColumn("status")} title="Status" options={statuses} />),
    tweaks.priority === pos &&
      table.getColumn("priority") &&
      slot("priority", <DataTableFacetedFilter column={table.getColumn("priority")} title="Priority" options={priorities} />),
  ]

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex items-center gap-2">
        {at("left")}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Reset
            <X />
          </Button>
        )}
        {selected.length > 0 && (
          <Button variant="outline" size="sm" onClick={bulk(remove)}>
            <Trash2 />
            Delete selected
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">{at("middle")}</div>
      <div className="flex items-center justify-end gap-2">
        {at("right")}
        <DataTableViewOptions table={table} />
        <Button size="sm" onClick={() => setAdding(true)}>
          Add Task
        </Button>
        {adding && <TaskDialog onClose={() => setAdding(false)} />}
      </div>
    </div>
  )
}
