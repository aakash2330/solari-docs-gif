import { z } from "zod";

import { Button } from "@/components/ui/button";

import { columns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { taskSchema } from "./data/schema";
import tasksJson from "./data/tasks.json";
import { TasksProvider, useTasks } from "./store";

// Upstream reads this off disk in a Next server component; Bun bundles the JSON
// in directly. The parse stays so bad seed data fails loudly rather than rendering
// half a table.
const tasks = z.array(taskSchema).parse(tasksJson);

export function TasksPage() {
  return (
    <TasksProvider initial={tasks}>
      <Tasks />
    </TasksProvider>
  );
}

// Upstream hides the table below md: and shows a screenshot instead. Dropped —
// the recorder drives a fixed viewport and must always get the real table.
function Tasks() {
  const { tasks, deleted, undo } = useTasks();
  return (
    <div className="flex h-full flex-1 flex-col gap-8 p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">
          Here&apos;s a list of your tasks for this month.
        </p>
      </div>
      {deleted.length > 0 && (
        <div role="status" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          Deleted {deleted.map((t) => t.id).join(", ")}.
          <Button variant="link" size="sm" className="h-auto p-0" onClick={undo}>
            Undo
          </Button>
        </div>
      )}
      <DataTable data={tasks} columns={columns} />
    </div>
  );
}
