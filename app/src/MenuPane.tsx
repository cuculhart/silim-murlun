// 左メニューペイン — sethera の縦レール相当。折りたたみ可能。
// 収録: ファイル（新規/開く/保存）/ リンクモード / シェイプ / 画像 /
//       ページ操作 / 印刷 / テーマ切替

export type Theme = 'standard' | 'light' | 'dark' | 'quiet';
export type ShapeTool = 'rect' | 'ellipse' | 'line';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'standard', label: '標準（OS連動）' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'quiet', label: 'クワイエット' },
];

export function MenuPane({
  collapsed,
  onToggle,
  onNew,
  onOpen,
  onSave,
  linkMode,
  onLinkMode,
  shapeTool,
  onShapeTool,
  onImage,
  onAddPage,
  onDeletePage,
  onPrint,
  theme,
  onTheme,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  linkMode: boolean;
  onLinkMode: () => void;
  shapeTool: ShapeTool | null;
  onShapeTool: (t: ShapeTool | null) => void;
  onImage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onPrint: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const item = (
    ic: string,
    label: string,
    onClick: () => void,
    opts: { on?: boolean; title?: string } = {},
  ) => (
    <button
      key={label}
      className={`m-item${opts.on ? ' on' : ''}`}
      title={opts.title ?? label}
      onClick={onClick}
    >
      <span className="m-ic">{ic}</span>
      {!collapsed && <span className="m-label">{label}</span>}
    </button>
  );

  const nextTheme =
    THEMES[(THEMES.findIndex((t) => t.value === theme) + 1) % THEMES.length];

  return (
    <nav className={collapsed ? 'left-menu collapsed' : 'left-menu'}>
      <button
        className="m-item m-toggle"
        onClick={onToggle}
        title={collapsed ? 'メニューを開く' : 'メニューを畳む'}
      >
        <span className="m-ic">≡</span>
        {!collapsed && (
          <span className="m-label">
            Silim Murlun <span className="m-ver">v0.1.0</span>
          </span>
        )}
      </button>
      {item('新', '新規', onNew)}
      {item('開', '開く…', onOpen)}
      {item('存', '保存', onSave, { title: '書庫 (.slm) で保存' })}
      <div className="m-sep" />
      {item('鎖', 'リンクモード', onLinkMode, {
        on: linkMode,
        title: '末尾→先頭の2エリアを接続',
      })}
      {item('画', '画像を追加', onImage)}
      <div className="m-sep" />
      {item('□', '矩形', () => onShapeTool(shapeTool === 'rect' ? null : 'rect'), {
        on: shapeTool === 'rect',
        title: '矩形ツール — ドラッグで配置',
      })}
      {item('◯', '楕円', () => onShapeTool(shapeTool === 'ellipse' ? null : 'ellipse'), {
        on: shapeTool === 'ellipse',
        title: '楕円ツール — ドラッグで配置',
      })}
      {item('／', '直線', () => onShapeTool(shapeTool === 'line' ? null : 'line'), {
        on: shapeTool === 'line',
        title: '直線ツール — ドラッグで配置',
      })}
      <div className="m-sep" />
      {item('頁', 'ページ追加', onAddPage)}
      {item('消', '現在ページを削除', onDeletePage, {
        title: '画面中央のページ枠を削除（オブジェクトは残る）',
      })}
      {item('印', '印刷', onPrint)}
      <div className="m-sep" />
      {collapsed ? (
        item('題', `テーマ: ${theme}`, () => onTheme(nextTheme.value), {
          title: `テーマ切替（次は ${nextTheme.label}）`,
        })
      ) : (
        <label className="m-item m-theme">
          <span className="m-ic">題</span>
          <select
            value={theme}
            onChange={(e) => onTheme(e.currentTarget.value as Theme)}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
