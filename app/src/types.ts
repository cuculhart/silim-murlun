// アプリ共有の型・定数

import type { Engine, WorldObject } from '@kimetron/core';

export const MM_PX = 96 / 25.4; // 1mm = 96/25.4 px (96dpi 実寸)

export const PAGE_KIND = 'page';
export const TEXT_KIND = 'textarea';
export const IMG_KIND = 'image';

export interface ImageData {
  /** 画像ソース（dataURL。書庫化・印刷でそのまま使える） */
  url: string;
  /** 高さ/幅 のアスペクト比（配置時点の値） */
  aspect: number;
  /** mm サイズ編集で縦横を連動させるか */
  lock: boolean;
}

/** テキストエリアの内側パディング（mm）— 計測・描画で共用 */
export const TEXT_PAD_MM = 1;
/** 行高さ係数（fontSize に対する倍率）— 計測・描画で共用 */
export const LINE_HEIGHT = 1.4;

export interface TextAreaData {
  /** フォントサイズ（mm） */
  fontSize: number;
  /** フォントファミリ（CSS 名） */
  fontFamily: string;
  /** 文字色 */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** 縦揃え（単独エリアのみ有効 — 連鎖エリアは常に top） */
  valign?: 'top' | 'middle' | 'bottom';
  /** 横揃え（単独エリアのみ有効 — 連鎖エリアは常に left） */
  halign?: 'left' | 'center' | 'right';
  /** エリア全体の URL リンク（印刷/PDF で <a> 化） */
  link?: string;
  /** v0.13: 適用中の書式 id（FontStyleDef.id）。未設定 = 書式なし */
  style?: string;
}

/** 書式（スタイル）のプロパティ部 — エリアへ適用できる書式属性。
    link はコンテンツ属性のため含めない。halign/valign は連鎖
    エリアでは描画上無効だが単独エリアでは有効（「見出し=中央
    揃え」等が表現できる） */
export type StyleProps = Partial<
  Pick<
    TextAreaData,
    | 'fontFamily'
    | 'fontSize'
    | 'color'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'halign'
    | 'valign'
  >
>;

/** v0.13: 名前付き書式（Word のスタイル相当）。文書データとして
    書庫へ保存される。適用はエリアへ props を書込み + style id を
    記録し、書式側の編集は適用中の全エリアへ再反映される
    （リンク型 — 直接書式による手動変更は再反映で上書きされる） */
export interface FontStyleDef {
  /** 不変 id（rename しても適用リンクは維持される） */
  id: string;
  name: string;
  props: StyleProps;
}

/** アプリ既定フォント — 先頭の 'Noto Sans JP' はアプリ同梱（OFL、
    main.tsx の @font-face）なので、全マシンで同一の字形・字幅に
    なる。無い環境（ロード失敗・@font-face 未適用の外部閲覧等）は
    OS のゴシック系へ落ちる。Debian の fonts-noto-cjk ファミリ名は
    "Noto Sans CJK JP" で "Noto Sans JP" とは別名のため併記。
    （CSS フォントスタックとして保存・計測・印刷でそのまま使う） */
export const DEFAULT_FONT_STACK =
  "'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', sans-serif";

export const DEFAULT_TEXT_DATA: TextAreaData = {
  fontSize: 4,
  fontFamily: DEFAULT_FONT_STACK,
  color: '#222222',
};

/** 既定書式セット — 新規文書と styles 欠落の旧書庫へシードする。
    表示名は生成時のロケールで焼き付ける（以後は文書データとして
    ユーザーが編集可能）。適用時の決定性のため props は全項目を
    明示値で持つ（未指定プロパティは適用時に現値が残るため） */
export function defaultStyles(
  nameOf: (key: string) => string,
): FontStyleDef[] {
  const base: StyleProps = {
    fontFamily: DEFAULT_FONT_STACK,
    fontSize: 4,
    color: '#222222',
    bold: false,
    italic: false,
    underline: false,
    halign: 'left',
    valign: 'top',
  };
  return [
    { id: 'std', name: nameOf('style.std'), props: { ...base } },
    {
      id: 'h1',
      name: nameOf('style.h1'),
      props: { ...base, fontSize: 9, bold: true },
    },
    {
      id: 'h2',
      name: nameOf('style.h2'),
      props: { ...base, fontSize: 7, bold: true },
    },
    {
      id: 'h3',
      name: nameOf('style.h3'),
      props: { ...base, fontSize: 5, bold: true },
    },
  ];
}

export const FONT_SIZES_MM = [3, 4, 5, 7, 9];
export const FONT_FAMILIES = [
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

/** ドラッグ/リサイズ中のライブ矩形。
    kimetron dom の objectFrame と同じプレビュー規則をモデル側へ適用する。 */
export function liveRect(
  engine: Engine,
  o: WorldObject,
): { x: number; y: number; w: number; h: number } {
  const rr =
    engine.resize && engine.resize.id === o.id
      ? { ...o, ...engine.resize.rect }
      : o;
  const d =
    engine.dragDelta && engine.selectedIds.has(o.id)
      ? engine.dragDelta
      : { x: 0, y: 0 };
  return { x: rr.x + d.x, y: rr.y + d.y, w: rr.w, h: rr.h };
}
