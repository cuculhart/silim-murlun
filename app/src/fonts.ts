// フォント選択肢 — kusuma-plava 方式: 推奨プリセット（フォール
// バックスタック付き）＋カスタム名の自由入力。カスタム書体は未所持
// でも末尾の既定スタックへフォールバックして読める。

import { DEFAULT_FONT_STACK } from './types';

// label は i18n キー（font.preset.* — FontPick が t() で解決する）
export const FONT_PRESETS: { key: string; label: string; stack: string }[] =
  [
    // 'Noto Sans JP' / 'Noto Sans' はアプリ同梱（OFL）のため
    // どの環境でも同じ字形・字幅になる — プリセットの先頭2件
    { key: 'gothic', label: 'font.preset.gothic', stack: DEFAULT_FONT_STACK },
    {
      key: 'latin',
      label: 'font.preset.latin',
      stack:
        "'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
    },
    {
      key: 'mincho',
      label: 'font.preset.mincho',
      stack:
        "'Noto Serif JP', 'Noto Serif CJK JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
    },
    {
      key: 'kyokasho',
      label: 'font.preset.kyokasho',
      stack:
        "'UD Digi Kyokasho NP-R', 'UD デジタル 教科書体 NP-R', 'UD Digi Kyokasho N-R', 'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif",
    },
    {
      key: 'mono',
      label: 'font.preset.mono',
      stack:
        "'Consolas', 'Noto Sans Mono CJK JP', 'BIZ UDGothic', 'Osaka-Mono', monospace",
    },
    // 汎用ファミリ — v0.9 以前の書庫の fontFamily 値（'sans-serif' 等）
    // がカスタム扱いにならないよう、末尾へプリセットとして残す
    { key: 'sans', label: 'font.preset.sans', stack: 'sans-serif' },
    { key: 'serif', label: 'font.preset.serif', stack: 'serif' },
    { key: 'mono-g', label: 'font.preset.monoG', stack: 'monospace' },
  ];

/** 選択値 → 保存用 font-family 値。プリセットはスタック、カスタム名は
    先頭に置いて既定スタックをフォールバックとして連結する */
export function fontStackFor(pick: string): string {
  const known = FONT_PRESETS.find(
    (f) => f.stack === pick || f.key === pick,
  );
  if (known) return known.stack;
  const name = pick.replace(/'/g, '').trim();
  return `'${name}', ${DEFAULT_FONT_STACK}`;
}

/** 保存値 → カスタム入力欄へ出すファミリ名（スタックの先頭成分） */
export function firstFamily(spec: string): string {
  return spec.split(',')[0].replace(/'/g, '').trim();
}

/** プリセットでない書体指定が環境に未インストールか —
    document.fonts.check で判定。未対応環境では false（警告しない） */
export function missingFont(spec: string): boolean {
  if (typeof document === 'undefined' || !document.fonts?.check)
    return false;
  if (FONT_PRESETS.some((f) => f.stack === spec)) return false;
  return !document.fonts.check(`12px "${firstFamily(spec)}"`);
}
