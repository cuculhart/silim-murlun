// シェイプの頂点グリップ (F21) — 単一選択 shape のアンカー点を
// ドラッグ編集するオーバーレイ。掴んだ点をポインタへ追従させ、
// bbox を全頂点へ再正規化する。
// kimetron の bend ジェスチャは edge 専用のため、shape の
// 頂点編集はアプリ側で行う。Undo は App の 500ms 畳み込みに乗る。

import { useRef } from 'react';
import {
  invRotPt,
  isShapeKind,
  objCenter,
  objPoint,
  rotPt,
  shapeAnchors,
  type Engine,
  type Pt,
  type WorldObject,
} from '@kimetron/core';
import { liveRect } from './types';

export function ShapeGrips({
  engine,
  obj,
  onApply,
}: {
  engine: Engine;
  /** 単一選択中のオブジェクト */
  obj: WorldObject;
  /** グリップドラッグ中の live パッチ（bbox + points 再正規化済み） */
  onApply: (patch: Partial<WorldObject>) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef(-1);
  if (!isShapeKind(obj.kind)) return null;
  const anchors = shapeAnchors(obj);
  if (anchors.length === 0) return null;

  // グリップ表示位置 — オブジェクトのドラッグ/リサイズ/回転の
  // live 姿勢を反映する
  const r = liveRect(engine, obj);
  const rr = { ...obj, x: r.x, y: r.y, w: r.w, h: r.h };
  const c = objCenter(rr);
  const grips = anchors.map((p, i) => {
    const q = objPoint(rr, p.fx, p.fy);
    const w = rr.rot ? rotPt(q, c, rr.rot) : q;
    const s = engine.worldToScreen(w);
    return { i, x: s.x, y: s.y };
  });

  /** 掴んだ頂点 i をクライアント座標へ — 全頂点で bbox を再正規化 */
  const apply = (i: number, client: Pt) => {
    const el = layerRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const w = engine.screenToWorld({
      x: client.x - b.left,
      y: client.y - b.top,
    });
    // 回転中のオブジェクトは逆回転でローカル（未回転）座標へ戻す
    const l = rr.rot ? invRotPt(w, c, rr.rot) : w;
    const gs = engine.doc.grid.size || 5;
    const sn = (v: number) => Math.round(v / gs) * gs;
    const wp = anchors.map((p) => objPoint(rr, p.fx, p.fy));
    wp[i] = { x: sn(l.x), y: sn(l.y) };
    const x1 = Math.min(...wp.map((p) => p.x));
    const y1 = Math.min(...wp.map((p) => p.y));
    const x2 = Math.max(...wp.map((p) => p.x));
    const y2 = Math.max(...wp.map((p) => p.y));
    const w2 = x2 - x1;
    const h2 = y2 - y1;
    onApply({
      x: x1,
      y: y1,
      w: w2,
      h: h2,
      shape: {
        ...obj.shape,
        points: wp.map((p) => ({
          // 退縮した辺（w=0/h=0）は中点 0.5 に畳む
          fx: w2 > 0 ? (p.x - x1) / w2 : 0.5,
          fy: h2 > 0 ? (p.y - y1) / h2 : 0.5,
        })),
      },
    });
  };

  return (
    <div ref={layerRef} className="grips">
      {grips.map((g) => (
        <div
          key={g.i}
          className="grip"
          style={{ left: g.x, top: g.y }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragIdx.current = g.i;
          }}
          onPointerMove={(e) => {
            if (dragIdx.current !== g.i) return;
            apply(g.i, { x: e.clientX, y: e.clientY });
          }}
          onPointerUp={() => {
            dragIdx.current = -1;
          }}
        />
      ))}
    </div>
  );
}
