import { z } from "zod";

import { columns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { taskSchema } from "./data/schema";
import tasksJson from "./data/tasks.json";

// Upstream reads this off disk in a Next server component; Bun bundles the JSON
// in directly. The parse stays so bad seed data fails loudly rather than rendering
// half a table.
const tasks = z.array(taskSchema).parse(tasksJson);

// Upstream hides the table below md: and shows a screenshot instead. Dropped —
// the recorder drives a fixed viewport and must always get the real table.
export function TasksPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-8 p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">
          Here&apos;s a list of your tasks for this month.
        </p>
      </div>
      <DataTable data={tasks} columns={columns} />
    </div>
  );
}
