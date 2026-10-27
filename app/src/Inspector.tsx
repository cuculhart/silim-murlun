// 右ペイン（選択駆動・F12）— 選択種別ごとに表示を切り替える。
// 右方向に折りたたみ可（G4）。

import { useState } from 'react';
import { isShapeKind, type WorldObject, type ZOrder } from '@kimetron/core';
import type { Chain } from 'inimbal';
import type { TFunc } from './i18n';
import { tf } from './i18n';
import { ChainPane } from './ChainPane';
import type { ImageData, TextAreaData } from './types';
import {
  FONT_FAMILIES,
  FONT_SIZES_MM,
  IMG_KIND,
  MM_PX,
  TEXT_KIND,
} from './types';

const isShape = (o: WorldObject) =>
  o.kind === 'rect' || isShapeKind(o.kind);

const ZOPS: { op: ZOrder; key: string }[] = [
  { op: 'front', key: 'z.front' },
  { op: 'forward', key: 'z.forward' },
  { op: 'backward', key: 'z.backward' },
  { op: 'back', key: 'z.back' },
];

function ZButtons({
  onReorder,
  t,
}: {
  onReorder: (op: ZOrder) => void;
  t: TFunc;
}) {
  return (
    <div className="z-btns">
      {ZOPS.map((z) => (
        <button key={z.op} onClick={() => onReorder(z.op)}>
          {t(z.key)}
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
    <label key={key}>
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
      {f('w', 'W')}
      {f('h', 'H')}
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
  onAddArea,
  collapsed,
  onToggleDock,
  docProps,
  t,
}: {
  selObjs: WorldObject[];
  chain: Chain | null;
  chainOverflow: string;
  onChainText: (text: string) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  onAreaDataAll: (patch: Partial<TextAreaData>) => void;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
  onImageData: (patch: Partial<ImageData>) => void;
  onStyle: (patch: { fill?: string; stroke?: string; width?: number }) => void;
  onReorder: (op: ZOrder) => void;
  onDeselect: () => void;
  onAddArea: () => void;
  collapsed: boolean;
  onToggleDock: () => void;
  docProps: {
    title: string;
    onTitle: (s: string) => void;
    size: 'A4' | 'A3';
    landscape: boolean;
    pageCount: number;
    footer: boolean;
    pageOpacity: number;
    onSize: (s: 'A4' | 'A3') => void;
    onLandscape: () => void;
    onAddPage: () => void;
    onInsertAfter: (index: number) => void;
    onFooter: (on: boolean) => void;
    onOpacity: (v: number) => void;
  };
  t: TFunc;
}) {
  const one = selObjs.length === 1 ? selObjs[0] : null;
  const allText =
    selObjs.length > 0 && selObjs.every((o) => o.kind === TEXT_KIND);
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
          t={t}
        />
        <div className="sub-props">
          <MmFields obj={one} onRect={onRect} />
          <button className="ins-btn" onClick={onAddArea}>
            {t('chain.addArea')}
          </button>
          <ZButtons onReorder={onReorder} t={t} />
        </div>
      </>
    );
  } else if (one?.kind === IMG_KIND) {
    body = (
      <ImageProps
        obj={one}
        onRect={onRect}
        onData={onImageData}
        onReorder={onReorder}
        t={t}
      />
    );
  } else if (allText && selObjs.length > 1) {
    body = <FontBatch onApply={onAreaDataAll} t={t} />;
  } else if (shapes.length === selObjs.length && selObjs.length > 0) {
    body = (
      <ShapeProps objs={selObjs} onStyle={onStyle} onReorder={onReorder} t={t} />
    );
  } else if (selObjs.length > 0) {
    body = (
      <div className="doc-props">
        <header>
          <span>{tf(t, 'sel.mixed', selObjs.length)}</span>
        </header>
        <div className="doc-props-grid">{t('sel.mixedHint')}</div>
      </div>
    );
  } else {
    body = <DocProps {...docProps} t={t} />;
  }
  return (
    <aside className={collapsed ? 'right-dock collapsed' : 'right-dock'}>
      <button
        className="dock-toggle"
        onClick={onToggleDock}
        title={collapsed ? '‹' : '›'}
      >
        {collapsed ? '‹' : '›'}
      </button>
      {!collapsed && body}
    </aside>
  );
}

function ImageProps({
  obj,
  onRect,
  onData,
  onReorder,
  t,
}: {
  obj: WorldObject;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
  onData: (patch: Partial<ImageData>) => void;
  onReorder: (op: ZOrder) => void;
  t: TFunc;
}) {
  const d = obj.data as ImageData;
  return (
    <div className="img-props">
      <header>
        <span>
          {t('img.title')} {obj.id}
        </span>
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
        {t('img.lock')}
      </label>
      <ZButtons onReorder={onReorder} t={t} />
    </div>
  );
}

function FontBatch({
  onApply,
  t,
}: {
  onApply: (patch: Partial<TextAreaData>) => void;
  t: TFunc;
}) {
  return (
    <div className="doc-props">
      <header>
        <span>{t('font.batch')}</span>
      </header>
      <div className="doc-props-grid">
        <label>
          {t('chain.font')}
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
          {t('chain.size')}
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
          {t('font.color')}
          <input
            type="color"
            defaultValue="#222222"
            onChange={(e) => onApply({ color: e.currentTarget.value })}
          />
        </label>
      </div>
      <footer className="hint">{t('font.batchHint')}</footer>
    </div>
  );
}

function ShapeProps({
  objs,
  onStyle,
  onReorder,
  t,
}: {
  objs: WorldObject[];
  onStyle: (p: { fill?: string; stroke?: string; width?: number }) => void;
  onReorder: (op: ZOrder) => void;
  t: TFunc;
}) {
  const o = objs[0];
  const fill = o.style?.fill ?? '#00000000';
  const stroke = o.style?.stroke ?? '#333333';
  const wMm = (o.style?.width ?? MM_PX) / MM_PX;
  return (
    <div className="doc-props">
      <header>
        <span>
          {t('shape.title')}
          {objs.length > 1 ? `(${objs.length})` : ` ${o.id}`}
        </span>
      </header>
      <div className="doc-props-grid">
        <label>
          {t('shape.fill')}
          <input
            type="color"
            value={toHex(fill)}
            onChange={(e) => onStyle({ fill: e.currentTarget.value })}
          />
        </label>
        <label>
          {t('shape.stroke')}
          <input
            type="color"
            value={toHex(stroke)}
            onChange={(e) => onStyle({ stroke: e.currentTarget.value })}
          />
        </label>
        <label>
          {t('shape.width')}
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
      <ZButtons onReorder={onReorder} t={t} />
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
  title,
  onTitle,
  size,
  landscape,
  pageCount,
  footer,
  pageOpacity,
  onSize,
  onLandscape,
  onAddPage,
  onInsertAfter,
  onFooter,
  onOpacity,
  t,
}: {
  title: string;
  onTitle: (s: string) => void;
  size: 'A4' | 'A3';
  landscape: boolean;
  pageCount: number;
  footer: boolean;
  pageOpacity: number;
  onSize: (s: 'A4' | 'A3') => void;
  onLandscape: () => void;
  onAddPage: () => void;
  onInsertAfter: (index: number) => void;
  onFooter: (on: boolean) => void;
  onOpacity: (v: number) => void;
  t: TFunc;
}) {
  const [ins, setIns] = useState(1);
  return (
    <div className="doc-props">
      <header>
        <span>{t('doc.title')}</span>
      </header>
      <div className="doc-props-grid">
        <label>
          {t('doc.name')}
          <input
            type="text"
            value={title}
            placeholder={t('doc.untitled')}
            onChange={(e) => onTitle(e.currentTarget.value)}
          />
        </label>
        <label>
          {t('doc.paper')}
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
          {t('doc.landscape')}
        </label>
        <div>
          {pageCount}
          {t('doc.pages')} <button onClick={onAddPage}>{t('doc.add')}</button>
        </div>
        <div className="ins-row">
          <input
            type="number"
            min={0}
            max={pageCount}
            value={ins}
            onChange={(e) => setIns(+e.currentTarget.value)}
          />{' '}
          {t('doc.insertAfter')}{' '}
          <button onClick={() => onInsertAfter(ins)}>{t('doc.insert')}</button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={footer}
            onChange={(e) => onFooter(e.currentTarget.checked)}
          />
          {t('doc.footer')}
        </label>
        <label>
          {t('doc.opacity')}
          <input
            type="range"
            min={0}
            max={100}
            value={pageOpacity}
            onChange={(e) => onOpacity(+e.currentTarget.value)}
          />{' '}
          {pageOpacity}%
        </label>
      </div>
      <footer className="hint">{t('doc.hint')}</footer>
    </div>
  );
}
