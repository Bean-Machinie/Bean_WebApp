import { useEffect, useRef, useState } from 'react';
import './ScrollableList.css';

export type ScrollableListItem = {
  id: string;
  label: string;
  description?: string;
};

type ScrollableListProps = {
  items: ScrollableListItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  itemClassName?: string;
  showGradients?: boolean;
};

function ScrollableList({
  items,
  selectedId,
  onSelect,
  className,
  itemClassName,
  showGradients = true,
}: ScrollableListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setTopGradientOpacity(Math.min(scrollTop / 40, 1));
      const bottomDistance = scrollHeight - (scrollTop + clientHeight);
      setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 40, 1));
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length]);

  return (
    <div className={`scrollable-list ${className ?? ''}`}>
      <div ref={containerRef} className="scrollable-list__items">
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              className={`scrollable-list__item ${isSelected ? 'scrollable-list__item--selected' : ''} ${
                itemClassName ?? ''
              }`}
              onClick={() => onSelect?.(item.id)}
              aria-pressed={isSelected}
            >
              <div className="scrollable-list__item-label">{item.label}</div>
              {item.description ? (
                <p className="scrollable-list__item-description">{item.description}</p>
              ) : null}
            </button>
          );
        })}
      </div>

      {showGradients && (
        <>
          <div
            className="scrollable-list__gradient scrollable-list__gradient--top"
            style={{ opacity: topGradientOpacity }}
          />
          <div
            className="scrollable-list__gradient scrollable-list__gradient--bottom"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      )}
    </div>
  );
}

export default ScrollableList;
