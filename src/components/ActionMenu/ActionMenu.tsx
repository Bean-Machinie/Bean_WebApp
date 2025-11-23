import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import { Workspace } from '../../layout/AppLayout';
import './ActionMenu.css';

type ActionMenuItem = Workspace & { path: string };

type ActionMenuProps = {
  items: ActionMenuItem[];
  profileMenuItems: Workspace[];
  isCollapsed: boolean;
  activeWorkspaceId?: string;
  onToggleCollapse: () => void;
};

const LAYER_COLLAPSED_OFFSET = -50;

function ActionMenu({
  items,
  profileMenuItems,
  isCollapsed,
  activeWorkspaceId,
  onToggleCollapse,
}: ActionMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isExpanded = !isCollapsed;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const plusHRef = useRef<HTMLSpanElement | null>(null);
  const plusVRef = useRef<HTMLSpanElement | null>(null);
  const textInnerRef = useRef<HTMLSpanElement | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const [textLines, setTextLines] = useState<string[]>(['Menu', 'Close']);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);
  const busyRef = useRef(false);

  const currentLabel = useMemo(() => {
    const match = items.find((it) => location.pathname.startsWith(it.path));
    return match?.title ?? items[0]?.title ?? 'Menu';
  }, [items, location.pathname]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const layers = preLayersRef.current
        ? (Array.from(preLayersRef.current.querySelectorAll('.action-menu__prelayer')) as HTMLElement[])
        : [];
      preLayerElsRef.current = layers;
      const panel = panelRef.current;
      const labelEls = panel
        ? (Array.from(panel.querySelectorAll('.action-menu__item-label')) as HTMLElement[])
        : [];
      const footer = panel?.querySelector('.action-menu__footer');
      const collapsed = !isExpanded;

      gsap.set(layers, { xPercent: collapsed ? LAYER_COLLAPSED_OFFSET : 0 });
      if (panel) {
        gsap.set(panel, { xPercent: 0 });
      }
      if (labelEls.length) {
        gsap.set(labelEls, { yPercent: collapsed ? 130 : 0, opacity: collapsed ? 0 : 1 });
      }
      if (footer) {
        gsap.set(footer, { opacity: collapsed ? 0.7 : 1, y: collapsed ? 8 : 0 });
      }

      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;
      if (plusH && plusV && icon && textInner) {
        gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
        gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
        gsap.set(icon, { rotate: isExpanded ? 225 : 0, transformOrigin: '50% 50%' });
        gsap.set(textInner, { yPercent: isExpanded ? -((textLines.length - 1) / textLines.length) * 100 : 0 });
      }

      if (toggleBtnRef.current) {
        gsap.set(toggleBtnRef.current, { color: isExpanded ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)' });
      }
    });

    return () => ctx.revert();
  }, [isExpanded, items.length, textLines.length]);

  const buildExpandTimeline = useCallback(() => {
    const layers = preLayerElsRef.current;
    const panel = panelRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }

    const labelEls = Array.from(panel.querySelectorAll('.action-menu__item-label')) as HTMLElement[];
    const footer = panel.querySelector('.action-menu__footer') as HTMLElement | null;

    const tl = gsap.timeline({ paused: true });

    layers.forEach((layer, i) => {
      tl.fromTo(
        layer,
        { xPercent: LAYER_COLLAPSED_OFFSET },
        { xPercent: 0, duration: 0.55, ease: 'power4.out' },
        i * 0.07,
      );
    });

    const itemsStart = layers.length ? (layers.length - 1) * 0.07 + 0.12 : 0.12;

    if (labelEls.length) {
      tl.fromTo(
        labelEls,
        { yPercent: 130, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: { each: 0.08, from: 'start' } },
        itemsStart,
      );
    }

    if (footer) {
      tl.fromTo(
        footer,
        { opacity: 0.5, y: 12 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' },
        itemsStart + 0.18,
      );
    }

    openTlRef.current = tl;
    return tl;
  }, []);

  const playExpand = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildExpandTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildExpandTimeline]);

  const playCollapse = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    openTlRef.current?.kill();
    openTlRef.current = null;

    const labelEls = Array.from(panel.querySelectorAll('.action-menu__item-label')) as HTMLElement[];
    const footer = panel.querySelector('.action-menu__footer') as HTMLElement | null;

    closeTweenRef.current?.kill();
    closeTweenRef.current = gsap.to(layers, {
      xPercent: LAYER_COLLAPSED_OFFSET,
      duration: 0.32,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        if (labelEls.length) {
          gsap.set(labelEls, { yPercent: 130, opacity: 0 });
        }
        if (footer) {
          gsap.set(footer, { opacity: 0.7, y: 8 });
        }
        busyRef.current = false;
      },
    });
  }, []);

  const animateIcon = useCallback(
    (opening: boolean) => {
      const icon = iconRef.current;
      if (!icon) return;
      spinTweenRef.current?.kill();
      spinTweenRef.current = gsap.to(icon, {
        rotate: opening ? 225 : 0,
        duration: opening ? 0.8 : 0.35,
        ease: opening ? 'power4.out' : 'power3.inOut',
        overwrite: 'auto',
      });
    },
    [],
  );

  const animateColor = useCallback((opening: boolean) => {
    const btn = toggleBtnRef.current;
    if (!btn) return;
    colorTweenRef.current?.kill();
    const targetColor = opening ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)';
    colorTweenRef.current = gsap.to(btn, { color: targetColor, delay: 0.15, duration: 0.3, ease: 'power2.out' });
  }, []);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? 'Menu' : 'Close';
    const targetLabel = opening ? 'Close' : 'Menu';
    const cycles = 3;
    const seq: string[] = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === 'Menu' ? 'Close' : 'Menu';
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);

    gsap.set(inner, { yPercent: 0 });
    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: 'power4.out',
    });
  }, []);

  useEffect(() => {
    if (isExpanded) {
      playExpand();
    } else {
      playCollapse();
    }
    animateIcon(isExpanded);
    animateColor(isExpanded);
    animateText(isExpanded);
  }, [animateColor, animateIcon, animateText, isExpanded, playCollapse, playExpand]);

  useEffect(() => {
    return () => {
      openTlRef.current?.kill();
      closeTweenRef.current?.kill();
      textCycleAnimRef.current?.kill();
      spinTweenRef.current?.kill();
      colorTweenRef.current?.kill();
    };
  }, []);

  const handleNavigate = (item: ActionMenuItem) => {
    navigate(item.path);
  };

  return (
    <aside className={`action-menu ${isCollapsed ? 'action-menu--collapsed' : ''}`} data-expanded={isExpanded || undefined}>
      <div ref={preLayersRef} className="action-menu__prelayers" aria-hidden="true">
        <div className="action-menu__prelayer action-menu__prelayer--primary" />
        <div className="action-menu__prelayer action-menu__prelayer--secondary" />
        <div className="action-menu__prelayer action-menu__prelayer--tertiary" />
      </div>

      <div className="action-menu__content" ref={panelRef}>
        <header className="action-menu__header" aria-label="Navigation toggle">
          <div className="action-menu__brand">
            <div className="action-menu__brand-icon" aria-hidden />
            <span className="action-menu__brand-title" title={currentLabel}>
              {currentLabel}
            </span>
          </div>

          <button
            ref={toggleBtnRef}
            type="button"
            className="action-menu__toggle"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse menu' : 'Expand menu'}
            onClick={onToggleCollapse}
          >
            <span className="action-menu__toggle-textWrap" aria-hidden="true">
              <span ref={textInnerRef} className="action-menu__toggle-textInner">
                {textLines.map((line, i) => (
                  <span className="action-menu__toggle-line" key={line + i}>
                    {line}
                  </span>
                ))}
              </span>
            </span>
            <span ref={iconRef} className="action-menu__toggle-icon" aria-hidden="true">
              <span ref={plusHRef} className="action-menu__toggle-lineIcon" />
              <span ref={plusVRef} className="action-menu__toggle-lineIcon action-menu__toggle-lineIcon--v" />
            </span>
          </button>
        </header>

        <nav className="action-menu__nav" aria-label="Primary">
          <ul className="action-menu__list" role="list">
            {items.map((item) => {
              const isActive = item.id === activeWorkspaceId;
              return (
                <li key={item.id} className="action-menu__itemWrap">
                  <button
                    type="button"
                    className={`action-menu__item ${isActive ? 'action-menu__item--active' : ''}`}
                    onClick={() => handleNavigate(item)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.title}
                  >
                    <span className="action-menu__item-icon" aria-hidden>
                      {item.icon as ReactNode}
                    </span>
                    <span className="action-menu__item-label">{item.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="action-menu__footer">
          <ProfileMenu isCollapsed={!isExpanded} items={profileMenuItems} />
        </div>
      </div>
    </aside>
  );
}

export default ActionMenu;
