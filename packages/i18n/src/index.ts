export type Locale = "en" | "ru";

export type MessageKey =
  | "app.name"
  | "workspace.edit"
  | "workspace.color"
  | "workspace.audio"
  | "workspace.effects"
  | "workspace.export"
  | "panel.media"
  | "panel.source"
  | "panel.program"
  | "panel.timeline"
  | "panel.inspector"
  | "panel.effects"
  | "panel.mixer"
  | "action.import"
  | "action.export"
  | "action.undo"
  | "action.redo"
  | "action.play"
  | "action.split"
  | "status.ready"
  | "theme.dark"
  | "theme.light"
  | "patent.warning";

const EN: Record<MessageKey, string> = {
  "app.name": "Lumina",
  "workspace.edit": "Edit",
  "workspace.color": "Color",
  "workspace.audio": "Audio",
  "workspace.effects": "Effects",
  "workspace.export": "Export",
  "panel.media": "Media Pool",
  "panel.source": "Source",
  "panel.program": "Program",
  "panel.timeline": "Timeline",
  "panel.inspector": "Inspector",
  "panel.effects": "Effects",
  "panel.mixer": "Mixer",
  "action.import": "Import",
  "action.export": "Export",
  "action.undo": "Undo",
  "action.redo": "Redo",
  "action.play": "Play",
  "action.split": "Split",
  "status.ready": "Ready",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "patent.warning": "H.264/H.265 may require MPEG-LA patent royalties for commercial distribution.",
};

const RU: Record<MessageKey, string> = {
  "app.name": "Lumina",
  "workspace.edit": "Монтаж",
  "workspace.color": "Цвет",
  "workspace.audio": "Звук",
  "workspace.effects": "Эффекты",
  "workspace.export": "Экспорт",
  "panel.media": "Медиатека",
  "panel.source": "Источник",
  "panel.program": "Программа",
  "panel.timeline": "Таймлайн",
  "panel.inspector": "Инспектор",
  "panel.effects": "Эффекты",
  "panel.mixer": "Микшер",
  "action.import": "Импорт",
  "action.export": "Экспорт",
  "action.undo": "Отменить",
  "action.redo": "Повторить",
  "action.play": "Воспроизведение",
  "action.split": "Разрезать",
  "status.ready": "Готово",
  "theme.dark": "Тёмная",
  "theme.light": "Светлая",
  "patent.warning": "H.264/H.265 могут требовать патентных отчислений MPEG-LA при коммерческом распространении.",
};

const TABLES: Record<Locale, Record<MessageKey, string>> = { en: EN, ru: RU };

export function t(locale: Locale, key: MessageKey): string {
  return TABLES[locale][key] ?? TABLES.en[key] ?? key;
}

export function availableLocales(): Locale[] {
  return ["en", "ru"];
}
