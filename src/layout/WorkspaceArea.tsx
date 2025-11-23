import MyProjectsWorkspace from '../workspaces/MyProjectsWorkspace';
import { Workspace } from './AppLayout';

type WorkspaceAreaProps = {
  activeWorkspace?: Workspace;
};

// Replace the placeholder content below with routed pages, editors, or other workspace UIs.
function WorkspaceArea({ activeWorkspace }: WorkspaceAreaProps) {
  const renderWorkspace = () => {
    if (!activeWorkspace) {
      return <p>Choose a workspace from the sidebar to get started.</p>;
    }

    if (activeWorkspace.id === 'my-projects') {
      return <MyProjectsWorkspace />;
    }

    return (
      <p>
        Page content goes here. Swap this section out for your real feature area for
        {` ${activeWorkspace.title.toLowerCase()}`}.
      </p>
    );
  };

  return (
    <main className="workspace-area">
      <div className="workspace-area__header">
        <p className="workspace-area__eyebrow">Workspace</p>
        <h1>{activeWorkspace ? activeWorkspace.title : 'Select a workspace'}</h1>
      </div>

      <div className="workspace-area__body">
        {renderWorkspace()}
      </div>
    </main>
  );
}

export default WorkspaceArea;
