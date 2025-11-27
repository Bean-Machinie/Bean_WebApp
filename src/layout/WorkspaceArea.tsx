import { ReactNode } from 'react';
import { Workspace } from './AppLayout';

type WorkspaceAreaProps = {
  activeWorkspace?: Workspace;
  content?: ReactNode;
};

// Hosts workspace-specific UI while keeping consistent shell styling.
function WorkspaceArea({ activeWorkspace, content }: WorkspaceAreaProps) {
  return (
    <main className="workspace-area">
      <div className="workspace-area__header">
        <p className="workspace-area__eyebrow">Workspace</p>
        <h1>{activeWorkspace ? activeWorkspace.title : 'Select a workspace'}</h1>
      </div>

      {content ?? (
        <p>
          {activeWorkspace
            ? 'Page content goes here. Swap this section out for your real feature area.'
            : 'Choose a workspace from the sidebar to get started.'}
        </p>
      )}
    </main>
  );
}

export default WorkspaceArea;
