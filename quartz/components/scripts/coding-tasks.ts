export type CodingTask = {
  id: string
  title?: string
  prompt: string
  starterCode: string
  tests: string
  hint?: string
}

export type CodingProgress = {
  completed: string[]
  drafts: Record<string, string>
}

export const emptyProgress = (): CodingProgress => ({ completed: [], drafts: {} })

export const firstIncomplete = (tasks: CodingTask[], completed: string[]) => {
  const index = tasks.findIndex((task) => !completed.includes(task.id))
  return index < 0 ? tasks.length - 1 : index
}

export const isUnlocked = (tasks: CodingTask[], completed: string[], index: number) =>
  index >= 0 &&
  index < tasks.length &&
  tasks.slice(0, index).every((task) => completed.includes(task.id))

export const completeTask = (tasks: CodingTask[], progress: CodingProgress, index: number) => {
  if (!isUnlocked(tasks, progress.completed, index)) return progress
  const id = tasks[index].id
  return progress.completed.includes(id)
    ? progress
    : { ...progress, completed: [...progress.completed, id] }
}

const storageKey = (lesson: string) => `hopes-coding-tasks-v1:${lesson}`

export const loadCodingProgress = (
  lesson: string,
  storage: Pick<Storage, "getItem">,
): CodingProgress => {
  try {
    const value = JSON.parse(storage.getItem(storageKey(lesson)) ?? "null")
    if (
      !value ||
      !Array.isArray(value.completed) ||
      typeof value.drafts !== "object" ||
      !value.drafts
    )
      return emptyProgress()
    return {
      completed: value.completed.filter((id: unknown): id is string => typeof id === "string"),
      drafts: Object.fromEntries(
        Object.entries(value.drafts).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    }
  } catch {
    return emptyProgress()
  }
}

export const saveCodingProgress = (
  lesson: string,
  progress: CodingProgress,
  storage: Pick<Storage, "setItem">,
) => {
  try {
    storage.setItem(storageKey(lesson), JSON.stringify(progress))
  } catch {
    // Storage may be unavailable or full; the current session still works.
  }
}
