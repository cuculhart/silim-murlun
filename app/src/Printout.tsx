// 印刷展開 — 同一ドキュメント内オーバーレイ。
// ページごとに版面だけを実寸（mm）で並べ、n / 全ページ のフッターを付ける。
// @media print で編集画面を隠し、@page で用紙サイズ・向きを動的設定する。

import { renderOrder, type WorldObject } from '@kimetron/core';
import { pageRects, type PageModel } from 'inimbal';
import {
  DEFAULT_TEXT_DATA,
  IMG_KIND,
  LINE_HEIGHT,
  MM_PX,
  PAGE_KIND,
  TEXT_KIND,
  TEXT_PAD_MM,
  type ImageData,
  type TextAreaData,
} from './types';

const intersects = (
  o: WorldObject,
  p: { x: number; y: number; w: number; h: number },
) => o.x < p.x + p.w && o.x + o.w > p.x && o.y < p.y + p.h && o.y + o.h > p.y;

export function Printout({
  model,
  footer,
  objects,
  sliceText,
  onPrint,
  onClose,
  t,
}: {
  model: PageModel;
  footer: boolean;
  objects: WorldObject[];
  /** テキストエリア → 表示中スライス（連鎖レイアウト済み） */
  sliceText: (o: WorldObject) => string;
  onPrint: () => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const rects = pageRects(model.spec, model.pages);
  const { spec } = model;
  const content = renderOrder(objects).filter((o) => o.kind !== PAGE_KIND);

  return (
    <div className="printout">
      <style>{`@page { size: ${spec.size} ${spec.landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      <div className="pbar">
        <button onClick={onPrint}>{t('print.exec')}</button>
        <button onClick={onClose}>{t('print.close')}</button>
      </div>
      <div>
        {rects.map((pr) => (
          <div
            key={pr.id}
            className="ppage"
            style={{ width: `${pr.w}mm`, height: `${pr.h}mm` }}
          >
            {content.filter((o) => intersects(o, pr)).map((o) => {
              const left = o.x - pr.x;
              const top = o.y - pr.y;
              if (o.kind === IMG_KIND) {
                const d = o.data as ImageData;
                return (
                  <img
                    key={o.id}
                    className="parea"
                    src={d.url}
                    alt=""
                    style={{
                      left: `${left}mm`,
                      top: `${top}mm`,
                      width: `${o.w}mm`,
                      height: `${o.h}mm`,
                    }}
                  />
                );
              }
              if (o.kind === 'rect' || o.kind === 'ellipse') {
                const wMm = ((o.style?.width ?? 0) / MM_PX).toFixed(2);
                return (
                  <div
                    key={o.id}
                    className="parea"
                    style={{
                      left: `${left}mm`,
                      top: `${top}mm`,
                      width: `${o.w}mm`,
                      height: `${o.h}mm`,
                      background: o.style?.fill,
                      border: o.style?.stroke
                        ? `${wMm}mm solid ${o.style.stroke}`
                        : 'none',
                      borderRadius: o.kind === 'ellipse' ? '50%' : undefined,
                    }}
                  />
                );
              }
              if (o.kind === 'line') {
                const wMm = (o.style?.width ?? MM_PX * 0.5) / MM_PX;
                const pts = o.shape?.points ?? [
                  { fx: 0, fy: 0 },
                  { fx: 1, fy: 1 },
                ];
                // 0サイズの <svg> は描画自体が無効化されるため下限を設ける。
                // viewBox を mm 実寸に合わせ、strokeWidth/dash/端子も mm 換算
                const vw = Math.max(o.w, 0.1);
                const vh = Math.max(o.h, 0.1);
                const col = o.style?.stroke ?? '#333';
                const ms = `pmk-${o.id}-s`;
                const me = `pmk-${o.id}-e`;
                const cap = (id: string, kind: string) =>
                  kind === 'arrow' ? (
                    <marker
                      id={id}
                      markerUnits="userSpaceOnUse"
                      orient="auto-start-reverse"
                      markerWidth={2.7}
                      markerHeight={2.2}
                      refX={2.4}
                      refY={1.05}
                    >
                      <path d="M 0 0 L 2.6 1.05 L 0 2.1 z" fill={col} />
                    </marker>
                  ) : (
                    <marker
                      id={id}
                      markerUnits="userSpaceOnUse"
                      orient="auto-start-reverse"
                      markerWidth={2.2}
                      markerHeight={2.2}
                      refX={1.05}
                      refY={1.05}
                    >
                      <circle cx={1.05} cy={1.05} r={0.8} fill={col} />
                    </marker>
                  );
                return (
                  <svg
                    key={o.id}
                    className="parea"
                    style={{
                      left: `${left}mm`,
                      top: `${top}mm`,
                      width: `${vw}mm`,
                      height: `${vh}mm`,
                      overflow: 'visible',
                    }}
                    viewBox={`0 0 ${vw} ${vh}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      {o.style?.capStart && cap(ms, o.style.capStart)}
                      {o.style?.capEnd && cap(me, o.style.capEnd)}
                    </defs>
                    <line
                      x1={pts[0].fx * vw}
                      y1={pts[0].fy * vh}
                      x2={pts[1].fx * vw}
                      y2={pts[1].fy * vh}
                      stroke={col}
                      strokeWidth={wMm}
                      strokeDasharray={o.style?.dash
                        ?.map((v) => v / MM_PX)
                        .join(' ')}
                      markerStart={
                        o.style?.capStart ? `url(#${ms})` : undefined
                      }
                      markerEnd={o.style?.capEnd ? `url(#${me})` : undefined}
                    />
                  </svg>
                );
              }
              if (o.kind === TEXT_KIND) {
                const d = { ...DEFAULT_TEXT_DATA, ...(o.data as TextAreaData) };
                return (
                  <div
                    key={o.id}
                    className="parea"
                    style={{
                      left: `${left}mm`,
                      top: `${top}mm`,
                      width: `${o.w}mm`,
                      height: `${o.h}mm`,
                      padding: `${TEXT_PAD_MM}mm`,
                      fontSize: `${d.fontSize}mm`,
                      lineHeight: LINE_HEIGHT,
                      fontFamily: d.fontFamily,
                      fontWeight: d.bold ? 'bold' : undefined,
                      fontStyle: d.italic ? 'italic' : undefined,
                      textDecoration: d.underline ? 'underline' : undefined,
                    }}
                  >
                    <span style={{ color: d.color }}>{sliceText(o)}</span>
                  </div>
                );
              }
              return null;
            })}
            {footer && (
              <div className="pfoot">
                {pr.index + 1} / {rects.length}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
