import type { Project } from "../model/project.js";

/**
 * Command pattern contract for all destructive project mutations.
 * Every timeline / media-pool edit is a command so undo/redo stays complete.
 */
export interface Command {
  /** Stable type id used in logs and crash recovery journals. */
  readonly type: string;
  /** Human-readable label for the History panel. */
  readonly label: string;
  /** Applies the mutation; must be pure w.r.t. the input project (return a new tree). */
  execute(project: Project): Project;
  /** Reverses {@link execute}. Implementations typically capture before-state on first run. */
  undo(project: Project): Project;
}

/**
 * Linear undo/redo stack. Redo is cleared whenever a new command is pushed
 * after an undo (standard NLE behaviour).
 */
export class HistoryStack {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private project: Project;

  constructor(
    initial: Project,
    private readonly limit = 200,
  ) {
    this.project = initial;
  }

  /** Current project document. */
  get current(): Project {
    return this.project;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  /** Executes a command, records it, and clears the redo stack. */
  push(command: Command): Project {
    this.project = command.execute(this.project);
    this.undoStack.push(command);
    this.redoStack.length = 0;
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    return this.project;
  }

  undo(): Project {
    const command = this.undoStack.pop();
    if (!command) return this.project;
    this.project = command.undo(this.project);
    this.redoStack.push(command);
    return this.project;
  }

  redo(): Project {
    const command = this.redoStack.pop();
    if (!command) return this.project;
    this.project = command.execute(this.project);
    this.undoStack.push(command);
    return this.project;
  }

  /** Drops history while keeping the current project (e.g. after load). */
  reset(project: Project): void {
    this.project = project;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
