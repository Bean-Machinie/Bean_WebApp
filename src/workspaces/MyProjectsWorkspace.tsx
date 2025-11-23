import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { MuuriComponent } from 'muuri-react';
import '../styles/my-projects.css';

type ProjectCard = {
  id: number;
  color: 'red' | 'green' | 'blue';
  width: 1 | 2;
  height: 1 | 2;
  title: string;
};

type FilterState = {
  search: string;
  value: 'all' | ProjectCard['color'];
};

type SortKey = 'title' | 'color';

const colors: ProjectCard['color'][] = ['red', 'green', 'blue'];
const dimensions: Array<ProjectCard['width']> = [1, 2];

let uuid = 1;

const createRandomCard = (): ProjectCard => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

  return {
    id: uuid++,
    color: colors[Math.floor(Math.random() * colors.length)],
    width: dimensions[Math.floor(Math.random() * dimensions.length)] as ProjectCard['width'],
    height: dimensions[Math.floor(Math.random() * dimensions.length)] as ProjectCard['height'],
    title: `${randomLetter}${alphabet[Math.floor(Math.random() * alphabet.length)]}`,
  };
};

const createBlankCard = (): ProjectCard => ({
  id: uuid++,
  color: 'blue',
  width: 1,
  height: 1,
  title: '',
});

const generateInitialCards = () => Array.from({ length: 3 }, () => createRandomCard());

const gridOptions = {
  dragSortHeuristics: {
    sortInterval: 70,
  },
  layoutDuration: 400,
  dragRelease: {
    duration: 400,
    easing: 'ease-out',
  },
  dragEnabled: true,
  dragContainer: typeof document !== 'undefined' ? document.body : undefined,
  dragPlaceholder: {
    enabled: true,
    createElement(item: any) {
      return item.getElement().cloneNode(true);
    },
  },
};

function useFilter(value: FilterState['value'], search: string) {
  return useCallback(
    (data: { color: ProjectCard['color']; title: string }) => {
      const matchesSearch = search ? data.title.toLowerCase().includes(search) : true;
      const matchesColor = value === 'all' ? true : data.color === value;
      return matchesSearch && matchesColor;
    },
    [search, value],
  );
}

function ControlWrapper({ children }: { children: ReactNode }) {
  return <div className="my-projects__control">{children}</div>;
}

function Select({ values, onChange }: { values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="my-projects__select">
      <select onChange={(e) => onChange(e.target.value)} defaultValue={values[0]}>
        {values.map((value) => (
          <option key={value} value={value.toLowerCase()}>
            {value}
          </option>
        ))}
      </select>
      <span className="material-icons">expand_more</span>
    </div>
  );
}

function SearchInput({ onChange }: { onChange: (value: string) => void }) {
  return (
    <div className="my-projects__search">
      <span className="material-icons">search</span>
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => onChange(e.target.value.toLowerCase())}
      />
    </div>
  );
}

function AddProjectButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="my-projects__add" onClick={onClick}>
      <span className="material-icons">add</span>
      Add Project
    </button>
  );
}

function ProjectCardItem({
  color,
  width,
  height,
  title,
  onRemove,
}: ProjectCard & { onRemove: () => void }) {
  return (
    <div className={`item h${height} w${width} ${color}`}>
      <div className="item-content">
        <div className="card">
          <div className="card-title">{title || 'New Project'}</div>
          <div className="card-remove">
            <i className="material-icons" onMouseDown={onRemove}>
              close
            </i>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyProjectsWorkspace() {
  const [items, setItems] = useState<ProjectCard[]>(() => generateInitialCards());
  const [sort, setSort] = useState<SortKey>('title');
  const [filter, setFilter] = useState<FilterState>({ search: '', value: 'all' });

  const filterFunction = useFilter(filter.value, filter.search) as (data: object) => boolean;

  const children = useMemo(
    () =>
      items.map(({ id, color, title, width, height }) => (
        <ProjectCardItem
          key={id}
          color={color}
          title={title}
          width={width}
          height={height}
          onRemove={() => setItems((prev) => prev.filter((item) => item.id !== id))}
          id={id}
        />
      )),
    [items],
  );

  return (
    <section className="my-projects">
      <div className="my-projects__controls cf">
        <ControlWrapper>
          <SearchInput onChange={(value) => setFilter((prev) => ({ ...prev, search: value }))} />
        </ControlWrapper>
        <ControlWrapper>
          <Select
            values={['All', 'Red', 'Blue', 'Green']}
            onChange={(value) => setFilter((prev) => ({ ...prev, value: value as FilterState['value'] }))}
          />
        </ControlWrapper>
        <ControlWrapper>
          <Select
            values={['Title', 'Color']}
            onChange={(value) => setSort(value as SortKey)}
          />
        </ControlWrapper>
      </div>

      <MuuriComponent
        // @ts-expect-error className is forwarded to the rendered grid element
        className="grid my-projects__grid"
        {...gridOptions}
        propsToData={(props: object) => {
          const { color, title } = props as ProjectCard;
          return { color, title };
        }}
        filter={filterFunction}
        sort={sort}
      >
        {children}
      </MuuriComponent>

      <div className="my-projects__footer">
        <AddProjectButton onClick={() => setItems((prev) => prev.concat(createBlankCard()))} />
      </div>
    </section>
  );
}

export default MyProjectsWorkspace;
