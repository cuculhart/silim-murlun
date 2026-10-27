// 右ペイン（選択駆動・F12）— 選択種別ごとに表示を切り替える:
//   テキストエリア単一 → 連鎖テキスト＋位置サイズmm＋Z-order
//   テキストエリア複数 → フォント系一括変更のみ
//   画像単一           → 位置サイズmm＋アスペクト比ロック＋Z-order
//   シェイプ（単複）   → 塗り色・線色・線幅
//   画像含む複数選択   → 一括編集なし
//   未選択             → 文書（用紙・向き・ページ数・挿入・フッター）

import { useState } from 'react';
import { isShapeKind, type WorldObject, type ZOrder } from '@kimetron/core';
import type { Chain } from 'inimbal';
import { ChainPane } from './ChainPane';
import type { ImageData, TextAreaData } from './types';
import {
  DEFAULT_TEXT_DATA,
  FONT_FAMILIES,
  FONT_SIZES_MM,
  IMG_KIND,
  MM_PX,
  TEXT_KIND,
} from './types';

const isShape = (o: WorldObject) =>
  o.kind === 'rect' || isShapeKind(o.kind);

const ZOPS: { op: ZOrder; label: string }[] = [
  { op: 'front', label: '最前面へ' },
  { op: 'forward', label: '一つ上へ' },
  { op: 'backward', label: '一つ下へ' },
  { op: 'back', label: '最背面へ' },
];

function ZButtons({ onReorder }: { onReorder: (op: ZOrder) => void }) {
  return (
    <div className="z-btns">
      {ZOPS.map((z) => (
        <button key={z.op} onClick={() => onReorder(z.op)}>
          {z.label}
        </button>
      ))}
    </div>
  );
}

function MmFields({
  obj,
  onRect,
}: {
  obj: WorldObject;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
}) {
  const f = (key: 'x' | 'y' | 'w' | 'h', label: string) => (
    <label>
      {label}
      <input
        type="number"
        step="0.1"
        value={+obj[key].toFixed(2)}
        onChange={(e) =>
          onRect({
            x: obj.x,
            y: obj.y,
            w: obj.w,
            h: obj.h,
            [key]: +e.currentTarget.value,
          })
        }
      />
    </label>
  );
  return (
    <div className="mm-grid">
      {f('x', 'X')}
      {f('y', 'Y')}
      {f('w', '幅')}
      {f('h', '高さ')}
    </div>
  );
}

export function RightDock({
  selObjs,
  chain,
  chainOverflow,
  onChainText,
  onAreaData,
  onAreaDataAll,
  onRect,
  onImageData,
  onStyle,
  onReorder,
  onDeselect,
  docProps,
}: {
  selObjs: WorldObject[];
  chain: Chain | null;
  chainOverflow: string;
  onChainText: (text: string) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  /** 選択中の全テキストエリアへフォント一括適用 */
  onAreaDataAll: (patch: Partial<TextAreaData>) => void;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
  onImageData: (patch: Partial<ImageData>) => void;
  /** 選択中オブジェクトの style を一括パッチ */
  onStyle: (patch: { fill?: string; stroke?: string; width?: number }) => void;
  onReorder: (op: ZOrder) => void;
  onDeselect: () => void;
  docProps: {
    size: 'A4' | 'A3';
    landscape: boolean;
    pageCount: number;
    footer: boolean;
    onSize: (s: 'A4' | 'A3') => void;
    onLandscape: () => void;
    onAddPage: () => void;
    onInsertAfter: (index: number) => void;
    onFooter: (on: boolean) => void;
  };
}) {
  const one = selObjs.length === 1 ? selObjs[0] : null;
  const allText = selObjs.length > 0 && selObjs.every((o) => o.kind === TEXT_KIND);
  const shapes = selObjs.filter(isShape);

  let body: React.ReactNode;
  if (one?.kind === TEXT_KIND && chain) {
    body = (
      <>
        <ChainPane
          chain={chain}
          areaData={one.data as TextAreaData}
          overflow={chainOverflow}
          onText={onChainText}
          onAreaData={onAreaData}
          onClose={onDeselect}
        />
        <div className="sub-props">
          <MmFields obj={one} onRect={onRect} />
          <ZButtons onReorder={onReorder} />
        </div>
      </>
    );
  } else if (one?.kind === IMG_KIND) {
    body = <ImageProps obj={one} onRect={onRect} onData={onImageData} onReorder={onReorder} />;
  } else if (allText && selObjs.length > 1) {
    body = <FontBatch onApply={onAreaDataAll} />;
  } else if (shapes.length === selObjs.length && selObjs.length > 0) {
    body = <ShapeProps objs={selObjs} onStyle={onStyle} onReorder={onReorder} />;
  } else if (selObjs.length > 0) {
    body = (
      <div className="doc-props">
        <header>
          <span>選択（{selObjs.length}）</span>
        </header>
        <div className="doc-props-grid">
          一括プロパティ編集はありません（画像を含む選択は対象外）
        </div>
      </div>
    );
  } else {
    body = <DocProps {...docProps} />;
  }
  return <aside className="right-dock">{body}</aside>;
}

function ImageProps({
  obj,
  onRect,
  onData,
  onReorder,
}: {
  obj: WorldObject;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
  onData: (patch: Partial<ImageData>) => void;
  onReorder: (op: ZOrder) => void;
}) {
  const d = obj.data as ImageData;
  const set = (patch: Partial<{ x: number; y: number; w: number; h: number }>) =>
    onRect({ x: obj.x, y: obj.y, w: obj.w, h: obj.h, ...patch });
  return (
    <div className="img-props">
      <header>
        <span>画像 {obj.id}</span>
      </header>
      <MmFields obj={obj} onRect={onRect} />
      <label className="img-lock">
        <input
          type="checkbox"
          checked={d.lock}
          onChange={(e) => {
            const lock = e.currentTarget.checked;
            onData({ lock });
            if (lock) onData({ aspect: obj.h / obj.w });
          }}
        />
        アスペクト比をロック
      </label>
      <ZButtons onReorder={onReorder} />
    </div>
  );
}

function FontBatch({
  onApply,
}: {
  onApply: (patch: Partial<TextAreaData>) => void;
}) {
  return (
    <div className="doc-props">
      <header>
        <span>テキストエリア（複数選択）</span>
      </header>
      <div className="doc-props-grid">
        <label>
          フォント
          <select
            defaultValue=""
            onChange={(e) => onApply({ fontFamily: e.currentTarget.value })}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          サイズ
          <select
            defaultValue=""
            onChange={(e) => onApply({ fontSize: +e.currentTarget.value })}
          >
            {FONT_SIZES_MM.map((s) => (
              <option key={s} value={s}>
                {s}mm
              </option>
            ))}
          </select>
        </label>
        <label>
          文字色
          <input
            type="color"
            defaultValue="#222222"
            onChange={(e) => onApply({ color: e.currentTarget.value })}
          />
        </label>
      </div>
      <footer className="hint">フォント系のみ一括変更できます</footer>
    </div>
  );
}

function ShapeProps({
  objs,
  onStyle,
  onReorder,
}: {
  objs: WorldObject[];
  onStyle: (p: { fill?: string; stroke?: string; width?: number }) => void;
  onReorder: (op: ZOrder) => void;
}) {
  const o = objs[0];
  const fill = o.style?.fill ?? '#00000000';
  const stroke = o.style?.stroke ?? '#333333';
  const wMm = (o.style?.width ?? MM_PX) / MM_PX;
  return (
    <div className="doc-props">
      <header>
        <span>
          シェイプ{objs.length > 1 ? `（${objs.length}選択）` : ` ${o.id}`}
        </span>
      </header>
      <div className="doc-props-grid">
        <label>
          塗り色
          <input
            type="color"
            value={toHex(fill)}
            onChange={(e) => onStyle({ fill: e.currentTarget.value })}
          />
        </label>
        <label>
          線色
          <input
            type="color"
            value={toHex(stroke)}
            onChange={(e) => onStyle({ stroke: e.currentTarget.value })}
          />
        </label>
        <label>
          線幅
          <input
            type="number"
            step="0.1"
            min="0"
            value={+wMm.toFixed(2)}
            onChange={(e) =>
              onStyle({ width: +e.currentTarget.value * MM_PX })
            }
          />{' '}
          mm
        </label>
      </div>
      <ZButtons onReorder={onReorder} />
    </div>
  );
}

function toHex(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return '#' + [...c.slice(1)].map((x) => x + x).join('');
  }
  return '#333333';
}

function DocProps({
  size,
  landscape,
  pageCount,
  footer,
  onSize,
  onLandscape,
  onAddPage,
  onInsertAfter,
  onFooter,
}: {
  size: 'A4' | 'A3';
  landscape: boolean;
  pageCount: number;
  footer: boolean;
  onSize: (s: 'A4' | 'A3') => void;
  onLandscape: () => void;
  onAddPage: () => void;
  onInsertAfter: (index: number) => void;
  onFooter: (on: boolean) => void;
}) {
  const [ins, setIns] = useState(1);
  return (
    <div className="doc-props">
      <header>
        <span>文書</span>
      </header>
      <div className="doc-props-grid">
        <label>
          用紙
          <select
            value={size}
            onChange={(e) => onSize(e.currentTarget.value as 'A4' | 'A3')}
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={landscape} onChange={onLandscape} />
          横置き
        </label>
        <div>
          {pageCount}ページ <button onClick={onAddPage}>＋追加</button>
        </div>
        <div className="ins-row">
          <input
            type="number"
            min={0}
            max={pageCount}
            value={ins}
            onChange={(e) => setIns(+e.currentTarget.value)}
          />{' '}
          ページの後に <button onClick={() => onInsertAfter(ins)}>挿入</button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={footer}
            onChange={(e) => onFooter(e.currentTarget.checked)}
          />
          フッターにページ番号（n / 全ページ）
        </label>
      </div>
      <footer className="hint">
        未選択 / 複数選択 — オブジェクトを選ぶとプロパティが出ます
      </footer>
    </div>
  );
}
