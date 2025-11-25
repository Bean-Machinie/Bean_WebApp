import ScrollableList, { ScrollableListItem } from '../ScrollableList/ScrollableList';
import './NewProjectPanel.css';

type NewProjectPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  projectTypes: ScrollableListItem[];
  selectedProjectTypeId: string;
  onSelectProjectType: (id: string) => void;
};

function NewProjectPanel({
  isOpen,
  onClose,
  projectTypes,
  selectedProjectTypeId,
  onSelectProjectType,
}: NewProjectPanelProps) {
  const selectedProjectType = projectTypes.find((type) => type.id === selectedProjectTypeId);

  if (!isOpen) return null;

  return (
    <div className="new-project-overlay" onClick={onClose} role="presentation">
      <div
        className="new-project-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="new-project-panel__column new-project-panel__column--left">
          <div className="new-project-panel__header">
            <p className="new-project-panel__eyebrow">Pick a Project Type</p>
            <h2 id="new-project-title">New Project</h2>
            <p className="new-project-panel__subtitle">Choose a starting point and we will tailor the setup.</p>
          </div>

          <ScrollableList
            items={projectTypes}
            selectedId={selectedProjectTypeId}
            onSelect={onSelectProjectType}
          />
        </div>

        <div className="new-project-panel__column new-project-panel__column--right">
          <p className="new-project-panel__eyebrow">Project Type</p>
          <h3 className="new-project-panel__selection-title">
            {selectedProjectType ? selectedProjectType.label : 'Select a project type'}
          </h3>
          <div className="new-project-panel__placeholder">
            <p className="muted">
              We will add inputs and templates for {selectedProjectType?.label ?? 'this project type'} soon. Your
              selections will stay put while you explore other areas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewProjectPanel;
