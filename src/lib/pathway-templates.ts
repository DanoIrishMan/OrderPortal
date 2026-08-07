/** Default critical pathway milestone titles (dates set when creating a pathway). */
export const STANDARD_PATHWAY_TASKS = [
  "Schedule feedback meeting with client",
  "Schedule initial meeting with client and present proposed designs to client",
  "Obtain sign off on designs with any amendments proposed by the client",
  "Request samples and embellishments",
  "Get final sign off on samples",
  "Provide forecasts to production for all garments and embellishments",
  "Process all orders",
  "Order all photo samples for shoots/product images",
  "Deliver all orders to clients",
  "Request feedback from clients on orders delivered",
] as const;

/** Optional sub-tasks keyed by parent task title. */
export const PATHWAY_SUBTASK_TEMPLATES: Record<string, string[]> = {
  "Request samples and embellishments": [
    "Crest samples",
    "Hem Tag samples",
    "Trainingwear samples",
    "Matchday samples",
    "Collar samples",
    "Jersey samples",
  ],
};

export function getSubTaskTemplateForTitle(taskTitle: string): string[] {
  const normalized = taskTitle.trim().toLowerCase();
  const match = Object.entries(PATHWAY_SUBTASK_TEMPLATES).find(
    ([title]) => title.trim().toLowerCase() === normalized
  );
  return match ? [...match[1]] : [];
}

export type TaskAssigneeRole = "ACCOUNT_MANAGER" | "DESIGNER";

/** Default staff roles responsible for each standard pathway task. */
export const PATHWAY_TASK_ASSIGNEES: Record<string, TaskAssigneeRole[]> = {
  "Schedule feedback meeting with client": ["ACCOUNT_MANAGER"],
  "Schedule initial meeting with client and present proposed designs to client": ["ACCOUNT_MANAGER"],
  "Obtain sign off on designs with any amendments proposed by the client": ["ACCOUNT_MANAGER"],
  "Request samples and embellishments": ["DESIGNER"],
  "Get final sign off on samples": ["ACCOUNT_MANAGER"],
  "Provide forecasts to production for all garments and embellishments": ["ACCOUNT_MANAGER"],
  "Process all orders": ["ACCOUNT_MANAGER"],
  "Order all photo samples for shoots/product images": ["DESIGNER"],
  "Deliver all orders to clients": ["ACCOUNT_MANAGER"],
  "Request feedback from clients on orders delivered": ["ACCOUNT_MANAGER"],
};

export function getTaskAssigneeRolesForTitle(taskTitle: string): TaskAssigneeRole[] {
  const normalized = taskTitle.trim().toLowerCase();
  const match = Object.entries(PATHWAY_TASK_ASSIGNEES).find(
    ([title]) => title.trim().toLowerCase() === normalized
  );
  return match ? [...match[1]] : ["ACCOUNT_MANAGER", "DESIGNER"];
}

export interface TaskAssigneeSelection {
  assignAccountManager: boolean;
  assignDesigner: boolean;
}

export function resolveTaskAssignees(
  taskTitle: string,
  explicit?: Partial<TaskAssigneeSelection>
): TaskAssigneeSelection {
  if (
    explicit?.assignAccountManager !== undefined ||
    explicit?.assignDesigner !== undefined
  ) {
    return {
      assignAccountManager: explicit.assignAccountManager ?? false,
      assignDesigner: explicit.assignDesigner ?? false,
    };
  }

  const roles = getTaskAssigneeRolesForTitle(taskTitle);
  return {
    assignAccountManager: roles.includes("ACCOUNT_MANAGER"),
    assignDesigner: roles.includes("DESIGNER"),
  };
}
