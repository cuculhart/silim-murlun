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
}: {
  model: PageModel;
  footer: boolean;
  objects: WorldObject[];
  /** テキストエリア → 表示中スライス（連鎖レイアウト済み） */
  sliceText: (o: WorldObject) => string;
  onPrint: () => void;
  onClose: () => void;
}) {
  const rects = pageRects(model.spec, model.pages);
  const { spec } = model;
  const content = renderOrder(objects).filter((o) => o.kind !== PAGE_KIND);

  return (
    <div className="printout">
      <style>{`@page { size: ${spec.size} ${spec.landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      <div className="pbar">
        <button onClick={onPrint}>印刷実行</button>
        <button onClick={onClose}>閉じる</button>
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
                return (
                  <svg
                    key={o.id}
                    className="parea"
                    style={{
                      left: `${left}mm`,
                      top: `${top}mm`,
                      width: `${o.w}mm`,
                      height: `${o.h}mm`,
                      overflow: 'visible',
                    }}
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1={pts[0].fx}
                      y1={pts[0].fy}
                      x2={pts[1].fx}
                      y2={pts[1].fy}
                      stroke={o.style?.stroke ?? '#333'}
                      strokeWidth={wMm}
                      vectorEffect="non-scaling-stroke"
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
