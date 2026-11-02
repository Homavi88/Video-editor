/**
 * Undoable attach-proxy mutation (avoids HistoryStack.reset wiping the undo stack).
 */

import type { Project } from "../model/project.js";
import type { Command } from "./command.js";

export class AttachProxyCommand implements Command {
  readonly type = "media.attachProxy";
  readonly label = "Attach Proxy";
  private before: Project | null = null;

  constructor(
    private readonly mediaId: string,
    private readonly proxyPath: string,
    private readonly width = 1280,
    private readonly height = 720,
  ) {}

  execute(project: Project): Project {
    this.before = project;
    return {
      ...project,
      media: project.media.map((m) =>
        m.id === this.mediaId
          ? {
              ...m,
              proxy: {
                path: this.proxyPath,
                width: this.width,
                height: this.height,
                videoCodec: "h264",
              },
            }
          : m,
      ),
    };
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("AttachProxyCommand.undo before execute");
    void project;
    return this.before;
  }
}
