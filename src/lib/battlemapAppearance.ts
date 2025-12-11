import type { BattleMapWidget, WidgetAppearance } from '../types/battlemap';

export const DYNAMIC_WIDGET_APPEARANCE: WidgetAppearance = {
  backgroundColor: '#0000ff',
  borderColor: '#0000ff',
  textColor: '#ffffff',
};

export const FIXED_WIDGET_APPEARANCE: WidgetAppearance = {
  backgroundColor: '#6b6f7b',
  borderColor: '#6b6f7b',
  textColor: '#ffffff',
  backgroundImageUrl: '/assets/widgets/stone_tile.webp',
};

const stripAppearanceAttributes = (html: string) =>
  html
    .replace(/\sdata-bg="[^"]*"/gi, '')
    .replace(/\sdata-border="[^"]*"/gi, '')
    .replace(/\sdata-text="[^"]*"/gi, '')
    .replace(/\sdata-bg-image="[^"]*"/gi, '');

export const mergeAppearanceIntoContent = (content: string, appearance?: WidgetAppearance): string => {
  if (!appearance) return content;

  const cleaned = stripAppearanceAttributes(content);

  const attrs: string[] = [];
  if (appearance.backgroundColor) attrs.push(`data-bg="${appearance.backgroundColor}"`);
  if (appearance.borderColor) attrs.push(`data-border="${appearance.borderColor}"`);
  if (appearance.textColor) attrs.push(`data-text="${appearance.textColor}"`);
  if (appearance.backgroundImageUrl) attrs.push(`data-bg-image="${appearance.backgroundImageUrl}"`);

  if (!attrs.length) {
    return cleaned;
  }

  const attrString = attrs.join(' ');
  const classPattern = /class="([^"]*\bbattlemap-widget-content\b[^"]*)"/i;
  if (classPattern.test(cleaned)) {
    return cleaned.replace(classPattern, (match) => `${match} ${attrString}`);
  }

  return `<div class="battlemap-widget-content" ${attrString}>${cleaned || 'Widget'}</div>`;
};

export const parseAppearanceFromContent = (content: string): WidgetAppearance | undefined => {
  const matchValue = (regex: RegExp) => {
    const match = content.match(regex);
    return match?.[1];
  };

  const appearance: WidgetAppearance = {
    backgroundColor: matchValue(/data-bg="([^"]+)"/i),
    borderColor: matchValue(/data-border="([^"]+)"/i),
    textColor: matchValue(/data-text="([^"]+)"/i),
    backgroundImageUrl: matchValue(/data-bg-image="([^"]+)"/i),
  };

  return Object.values(appearance).some(Boolean) ? appearance : undefined;
};

export const resolveAppearance = (widget: Partial<BattleMapWidget>): WidgetAppearance => ({
  backgroundColor:
    widget.appearance?.backgroundColor ??
    (widget.isFixed ? FIXED_WIDGET_APPEARANCE.backgroundColor : DYNAMIC_WIDGET_APPEARANCE.backgroundColor),
  borderColor:
    widget.appearance?.borderColor ??
    (widget.isFixed ? FIXED_WIDGET_APPEARANCE.borderColor : DYNAMIC_WIDGET_APPEARANCE.borderColor),
  textColor:
    widget.appearance?.textColor ??
    (widget.isFixed ? FIXED_WIDGET_APPEARANCE.textColor : DYNAMIC_WIDGET_APPEARANCE.textColor),
  backgroundImageUrl: widget.appearance?.backgroundImageUrl,
});

export const createWidgetContent = (label: string, appearance?: WidgetAppearance) => {
  const resolvedAppearance = appearance ?? DYNAMIC_WIDGET_APPEARANCE;
  const html = `<div class="battlemap-widget-content">${label}</div>`;
  return mergeAppearanceIntoContent(html, appearance ?? resolvedAppearance);
};
