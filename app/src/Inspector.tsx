// 右ペイン（選択駆動・F12）— 選択種別ごとに表示を切り替える。
// 右方向に折りたたみ可（G4）。

import { useState } from 'react';
import {
  isShapeKind,
  shapeAnchors,
  type EdgeMarker,
  type WorldObject,
  type ZOrder,
} from '@kimetron/core';
import type { Chain, KinsokuMode, TextAttrs } from 'inimbal';
import type { TFunc } from './i18n';
import { tf } from './i18n';
import { ChainPane } from './ChainPane';
import type {
  FontStyleDef,
  ImageData,
  StyleProps,
  TextAreaData,
} from './types';
import { FONT_SIZES_MM, IMG_KIND, MM_PX, TEXT_KIND } from './types';
import { FontPick } from './FontPick';

const isShape = (o: WorldObject) =>
  o.kind === 'rect' || isShapeKind(o.kind);

interface StylePatch {
  fill?: string;
  stroke?: string;
  width?: number;
  dash?: number[];
  capStart?: EdgeMarker;
  capEnd?: EdgeMarker;
}

/** 線種プリセット — kimetron の dash は screen px 規格 */
const DASHES: { key: string; value: number[] | undefined }[] = [
  { key: 'shape.solid', value: undefined },
  { key: 'shape.dashed', value: [6, 3] },
  { key: 'shape.dotted', value: [1, 2] },
];

const CAPS: { value: '' | EdgeMarker; key: string }[] = [
  { value: '', key: 'shape.capNone' },
  { value: 'arrow', key: 'shape.capArrow' },
  { value: 'dot', key: 'shape.capDot' },
];

const ZOPS: { op: ZOrder; key: string }[] = [
  { op: 'front', key: 'z.front' },
  { op: 'forward', key: 'z.forward' },
  { op: 'backward', key: 'z.backward' },
  { op: 'back', key: 'z.back' },
];

const ALIGNS: { op: string; key: string }[] = [
  { op: 'left', key: 'align.left' },
  { op: 'hcenter', key: 'align.hcenter' },
  { op: 'right', key: 'align.right' },
  { op: 'top', key: 'align.top' },
  { op: 'vcenter', key: 'align.vcenter' },
  { op: 'bottom', key: 'align.bottom' },
  { op: 'hdist', key: 'align.hdist' },
  { op: 'vdist', key: 'align.vdist' },
];

function AlignButtons({
  onAlign,
  t,
}: {
  onAlign: (op: string) => void;
  t: TFunc;
}) {
  return (
    <div className="doc-props">
      <header>
        <span>{t('align.title')}</span>
      </header>
      <div className="z-btns">
        {ALIGNS.map((a) => (
          <button key={a.op} onClick={() => onAlign(a.op)}>
            {t(a.key)}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  onApplyMark,
  onClearMarks,
  onAreaData,
  onAreaDataAll,
  onRect,
  onImageData,
  onStyle,
  onReorder,
  onAlign,
  onDeselect,
  onAddArea,
  collapsed,
  onToggleDock,
  jumpSel,
  onJumpApplied,
  styles,
  textTargetCount,
  onApplyStyle,
  onRegisterStyle,
  docProps,
  t,
}: {
  selObjs: WorldObject[];
  chain: Chain | null;
  chainOverflow: string;
  onChainText: (text: string) => void;
  /** 連鎖テキスト [s,e) への部分装飾適用 */
  onApplyMark: (s: number, e: number, attrs: Partial<TextAttrs>) => void;
  /** 連鎖テキスト [s,e) 内の装飾マーク除去 */
  onClearMarks: (s: number, e: number) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  onAreaDataAll: (patch: Partial<TextAreaData>) => void;
  /** v0.13: 書式一覧（適用 select・登録ボタン用） */
  styles: FontStyleDef[];
  /** 選択内（グループ含む）のテキストエリア数 — 書式適用行の出現条件 */
  textTargetCount: number;
  /** 選択中テキストエリア全てへ書式を適用（undefined = 解除） */
  onApplyStyle: (styleId?: string) => void;
  /** 単独選択エリアの現行書式を新しい書式として登録する */
  onRegisterStyle: () => void;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
  onImageData: (patch: Partial<ImageData>) => void;
  onStyle: (patch: StylePatch) => void;
  onReorder: (op: ZOrder) => void;
  onAlign: (op: string) => void;
  onDeselect: () => void;
  onAddArea: () => void;
  collapsed: boolean;
  onToggleDock: () => void;
  /** v0.10: 全文検索ジャンプ — ChainPane へそのまま渡す */
  jumpSel?: { s: number; e: number; n: number; chainId: string } | null;
  onJumpApplied?: () => void;
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
    /** ドキュメント既定フォント（新規テキストエリアへ適用） */
    font: string;
    onFont: (s: string) => void;
    /** v0.11: 禁則処理 — なし / 追い出し（書庫に保存） */
    kinsoku?: KinsokuMode;
    onKinsoku: (k: KinsokuMode | undefined) => void;
    /** v0.13: 書式一覧の管理（文書プロパティの書式セクション） */
    styles: FontStyleDef[];
    onStyleAdd: (name: string, props: StyleProps) => FontStyleDef;
    onStyleUpdate: (id: string, patch: Partial<FontStyleDef>) => void;
    onStyleDelete: (id: string) => void;
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
          onApplyMark={onApplyMark}
          onClearMarks={onClearMarks}
          onAreaData={onAreaData}
          onClose={onDeselect}
          jumpSel={jumpSel}
          onJumpApplied={onJumpApplied}
          styles={styles}
          onApplyStyle={onApplyStyle}
          onRegisterStyle={onRegisterStyle}
          t={t}
        />
        <div className="sub-props">
          <MmFields obj={one} onRect={onRect} />
          {/* 揃えは単独（非連鎖）エリアのみ — 連鎖は左上起点固定 */}
          {chain.areas.length === 1 && (
            <>
              <label className="img-lock">
                {t('ta.halign')}
                <select
                  value={(one.data as TextAreaData).halign ?? 'left'}
                  onChange={(e) =>
                    onAreaData({
                      halign: e.currentTarget
                        .value as TextAreaData['halign'],
                    })
                  }
                >
                  <option value="left">{t('ta.left')}</option>
                  <option value="center">{t('ta.center')}</option>
                  <option value="right">{t('ta.right')}</option>
                </select>
              </label>
              <label className="img-lock">
                {t('ta.valign')}
                <select
                  value={(one.data as TextAreaData).valign ?? 'top'}
                  onChange={(e) =>
                    onAreaData({
                      valign: e.currentTarget
                        .value as TextAreaData['valign'],
                    })
                  }
                >
                  <option value="top">{t('ta.top')}</option>
                  <option value="middle">{t('ta.middle')}</option>
                  <option value="bottom">{t('ta.bottom')}</option>
                </select>
              </label>
            </>
          )}
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
    body = (
      <FontBatch
        onApply={onAreaDataAll}
        styles={styles}
        onApplyStyle={onApplyStyle}
        t={t}
      />
    );
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
  // v0.13: 書式適用行 — 連鎖ペイン/FontBatch が既に書式 select を
  // 持つ場合は出さない。それ以外（図形・混在選択など）で選択内に
  // テキストエリア（グループ経由含む）があれば末尾へ追加する
  const showStyleApply =
    textTargetCount > 0 &&
    !(one?.kind === TEXT_KIND && chain) &&
    !(allText && selObjs.length > 1);
  if (showStyleApply) {
    body = (
      <>
        {body}
        <StyleApply styles={styles} onApplyStyle={onApplyStyle} t={t} />
      </>
    );
  }
  if (selObjs.length > 1) {
    body = (
      <>
        {body}
        <AlignButtons onAlign={onAlign} t={t} />
      </>
    );
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

/** v0.13: 書式適用のプルダウン — 選択した時点で適用し、表示は
    常に先頭の案内へ戻る適用アクション型。対象は呼出し側が決める */
function StyleSelect({
  styles,
  onPick,
  t,
}: {
  styles: FontStyleDef[];
  onPick: (styleId?: string) => void;
  t: TFunc;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (v) onPick(v === 'none' ? undefined : v);
      }}
    >
      <option value="" disabled>
        {t('style.apply')}
      </option>
      <option value="none">{t('style.none')}</option>
      {styles.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/** v0.13: 選択内のテキストエリア（グループ経由含む）への書式適用行 —
    図形・混在選択時に Inspector 末尾へ追加される */
function StyleApply({
  styles,
  onApplyStyle,
  t,
}: {
  styles: FontStyleDef[];
  onApplyStyle: (styleId?: string) => void;
  t: TFunc;
}) {
  return (
    <div className="doc-props">
      <div className="doc-props-grid">
        <label>
          {t('style.title')}
          <StyleSelect styles={styles} onPick={onApplyStyle} t={t} />
        </label>
      </div>
      <footer className="hint">{t('style.applyHint')}</footer>
    </div>
  );
}

function FontBatch({
  onApply,
  styles,
  onApplyStyle,
  t,
}: {
  onApply: (patch: Partial<TextAreaData>) => void;
  styles: FontStyleDef[];
  onApplyStyle: (styleId?: string) => void;
  t: TFunc;
}) {
  return (
    <div className="doc-props">
      <header>
        <span>{t('font.batch')}</span>
      </header>
      <div className="doc-props-grid">
        <label>
          {t('style.title')}
          <StyleSelect styles={styles} onPick={onApplyStyle} t={t} />
        </label>
        <label>
          {t('chain.font')}
          <FontPick
            value=""
            placeholder="—"
            onPick={(stack) => onApply({ fontFamily: stack })}
            t={t}
          />
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
        <label>
          B
          <input
            type="checkbox"
            onChange={(e) => onApply({ bold: e.currentTarget.checked })}
          />
        </label>
        <label>
          I
          <input
            type="checkbox"
            onChange={(e) => onApply({ italic: e.currentTarget.checked })}
          />
        </label>
        <label>
          U
          <input
            type="checkbox"
            onChange={(e) => onApply({ underline: e.currentTarget.checked })}
          />
        </label>
      </div>
      <footer className="hint">{t('font.batchHint')}</footer>
    </div>
  );
}

/** v0.13: 書式一覧の管理 — 文書プロパティ内の書式セクション。
    プルダウンで対象書式を切替え、選択中の1件だけ名前・プロパティを
    編集する（全展開だと小さい画面で見切れるため）。props 変更は
    適用中の全エリアへ即時再反映される（リンク型） */
function StyleList({
  styles,
  docFont,
  onAdd,
  onUpdate,
  onDelete,
  t,
}: {
  styles: FontStyleDef[];
  docFont: string;
  onAdd: (name: string, props: StyleProps) => FontStyleDef;
  onUpdate: (id: string, patch: Partial<FontStyleDef>) => void;
  onDelete: (id: string) => void;
  t: TFunc;
}) {
  // 選択中の書式 id — 削除等で未解決なら先頭へフォールバック
  const [cur, setCur] = useState('');
  const sel = styles.find((s) => s.id === cur) ?? styles[0];
  const upd = (props: StyleProps) => sel && onUpdate(sel.id, { props });
  return (
    <div className="style-list">
      <header>
        <span>{t('style.title')}</span>
      </header>
      <div className="style-def-head">
        <select
          className="style-def-name"
          value={sel?.id ?? ''}
          onChange={(e) => setCur(e.currentTarget.value)}
        >
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          title={t('style.del')}
          disabled={!sel}
          onClick={() => sel && onDelete(sel.id)}
        >
          ×
        </button>
      </div>
      {sel && (
        <div className="style-def-props">
          <input
            className="style-def-name"
            value={sel.name}
            title={t('style.name')}
            onChange={(e) => onUpdate(sel.id, { name: e.currentTarget.value })}
          />
          <FontPick
            value={sel.props.fontFamily ?? ''}
            onPick={(v) => upd({ fontFamily: v })}
            t={t}
          />
          <select
            value={sel.props.fontSize ?? 4}
            onChange={(e) =>
              upd({ fontSize: Number(e.currentTarget.value) })
            }
          >
            {FONT_SIZES_MM.map((sz) => (
              <option key={sz} value={sz}>
                {sz}mm
              </option>
            ))}
          </select>
          <input
            type="color"
            title={t('font.color')}
            value={sel.props.color ?? '#222222'}
            onChange={(e) => upd({ color: e.currentTarget.value })}
          />
          <label title="Bold">
            B
            <input
              type="checkbox"
              checked={!!sel.props.bold}
              onChange={(e) => upd({ bold: e.currentTarget.checked })}
            />
          </label>
          <label title="Italic">
            I
            <input
              type="checkbox"
              checked={!!sel.props.italic}
              onChange={(e) => upd({ italic: e.currentTarget.checked })}
            />
          </label>
          <label title="Underline">
            U
            <input
              type="checkbox"
              checked={!!sel.props.underline}
              onChange={(e) => upd({ underline: e.currentTarget.checked })}
            />
          </label>
          <select
            title={t('ta.halign')}
            value={sel.props.halign ?? 'left'}
            onChange={(e) =>
              upd({
                halign: e.currentTarget.value as TextAreaData['halign'],
              })
            }
          >
            <option value="left">{t('ta.left')}</option>
            <option value="center">{t('ta.center')}</option>
            <option value="right">{t('ta.right')}</option>
          </select>
          <select
            title={t('ta.valign')}
            value={sel.props.valign ?? 'top'}
            onChange={(e) =>
              upd({
                valign: e.currentTarget.value as TextAreaData['valign'],
              })
            }
          >
            <option value="top">{t('ta.top')}</option>
            <option value="middle">{t('ta.middle')}</option>
            <option value="bottom">{t('ta.bottom')}</option>
          </select>
        </div>
      )}
      <button
        className="ins-btn"
        onClick={() =>
          setCur(
            onAdd(tf(t, 'style.newName', styles.length + 1), {
              fontFamily: docFont,
              fontSize: 4,
              color: '#222222',
              bold: false,
              italic: false,
              underline: false,
              halign: 'left',
              valign: 'top',
            }).id,
          )
        }
      >
        {t('style.add')}
      </button>
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
  onStyle: (p: StylePatch) => void;
  onReorder: (op: ZOrder) => void;
  t: TFunc;
}) {
  const o = objs[0];
  const fill = o.style?.fill ?? '#00000000';
  const stroke = o.style?.stroke ?? '#333333';
  const fillA = alphaOf(fill);
  const strokeA = alphaOf(stroke);
  const wMm = (o.style?.width ?? MM_PX) / MM_PX;
  const isLine = o.kind === 'line' || o.kind === 'curve';
  const dashIdx = Math.max(
    0,
    DASHES.findIndex(
      (d) => JSON.stringify(d.value) === JSON.stringify(o.style?.dash),
    ),
  );
  return (
    <div className="doc-props">
      <header>
        <span>
          {t('shape.title')}
          {objs.length > 1 ? `(${objs.length})` : ` ${o.id}`}
        </span>
      </header>
      <div className="doc-props-grid">
        {/* line/curve は fill 非対応（開いた chord のため塗りは常に none） */}
        {!isLine && (
        <label>
          {t('shape.fill')}
          <span className="col-alpha">
            <input
              type="color"
              value={toHex(fill)}
              onChange={(e) =>
                onStyle({ fill: withAlpha(e.currentTarget.value, fillA || 1) })
              }
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              title={t('shape.alpha')}
              value={Math.round(fillA * 100)}
              onChange={(e) =>
                onStyle({
                  fill: withAlpha(toHex(fill), +e.currentTarget.value / 100),
                })
              }
            />
            %
          </span>
        </label>
        )}
        <label>
          {t('shape.stroke')}
          <span className="col-alpha">
            <input
              type="color"
              value={toHex(stroke)}
              onChange={(e) =>
                onStyle({
                  stroke: withAlpha(e.currentTarget.value, strokeA || 1),
                })
              }
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              title={t('shape.alpha')}
              value={Math.round(strokeA * 100)}
              onChange={(e) =>
                onStyle({
                  stroke: withAlpha(toHex(stroke), +e.currentTarget.value / 100),
                })
              }
            />
            %
          </span>
        </label>
        {/* F28: 矩形・楕円の枠線 OFF — 'transparent' で明示的に消す
            （stroke 未設定はエンジン既定色へ戻るため OFF にならない） */}
        {!isLine && (
        <label>
          {t('shape.border')}
          <input
            type="checkbox"
            checked={(o.style?.stroke ?? 'transparent') !== 'transparent'}
            onChange={(e) =>
              onStyle({
                stroke: e.currentTarget.checked ? toHex(stroke) : 'transparent',
              })
            }
          />
        </label>
        )}
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
        <label>
          {t('shape.lineStyle')}
          <select
            value={dashIdx}
            onChange={(e) =>
              onStyle({ dash: DASHES[+e.currentTarget.value].value })
            }
          >
            {DASHES.map((d, i) => (
              <option key={d.key} value={i}>
                {t(d.key)}
              </option>
            ))}
          </select>
        </label>
        {isLine && (
          <>
            <label>
              {t('shape.capStart')}
              <select
                value={o.style?.capStart ?? ''}
                onChange={(e) =>
                  onStyle({
                    capStart:
                      (e.currentTarget.value as EdgeMarker) || undefined,
                  })
                }
              >
                {CAPS.map((c) => (
                  <option key={c.key} value={c.value}>
                    {t(c.key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('shape.capEnd')}
              <select
                value={o.style?.capEnd ?? ''}
                onChange={(e) =>
                  onStyle({
                    capEnd:
                      (e.currentTarget.value as EdgeMarker) || undefined,
                  })
                }
              >
                {CAPS.map((c) => (
                  <option key={c.key} value={c.value}>
                    {t(c.key)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <ZButtons onReorder={onReorder} t={t} />
      {objs.length === 1 && shapeAnchors(o).length > 0 && (
        <footer className="hint">{t('shape.gripHint')}</footer>
      )}
    </div>
  );
}

function toHex(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^#[0-9a-fA-F]{8}$/.test(c)) return c.slice(0, 7);
  if (/^#[0-9a-fA-F]{3,4}$/.test(c)) {
    return '#' + [...c.slice(1, 4)].map((x) => x + x).join('');
  }
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
  if (m) {
    return (
      '#' +
      [m[1], m[2], m[3]]
        .map((v) => Number(v).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return '#333333';
}

/** CSS 色のアルファ (0..1)。#rrggbbaa / #rgba / rgba() を解釈、他は不透明 */
function alphaOf(c: string): number {
  if (/^#[0-9a-fA-F]{8}$/.test(c)) return parseInt(c.slice(7), 16) / 255;
  if (/^#[0-9a-fA-F]{4}$/.test(c)) return parseInt(c[4] + c[4], 16) / 255;
  const m = /^rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+[\s,/]+([\d.]+)/.exec(c);
  if (m) return Math.min(1, Math.max(0, +m[1]));
  return 1;
}

/** #rrggbb にアルファを乗せて返す。不透明なら6桁のまま */
function withAlpha(hex6: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return a >= 255 ? hex6 : hex6 + a.toString(16).padStart(2, '0');
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
  font,
  onFont,
  kinsoku,
  onKinsoku,
  styles,
  onStyleAdd,
  onStyleUpdate,
  onStyleDelete,
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
  font: string;
  onFont: (s: string) => void;
  kinsoku?: KinsokuMode;
  onKinsoku: (k: KinsokuMode | undefined) => void;
  styles: FontStyleDef[];
  onStyleAdd: (name: string, props: StyleProps) => FontStyleDef;
  onStyleUpdate: (id: string, patch: Partial<FontStyleDef>) => void;
  onStyleDelete: (id: string) => void;
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
        <label>
          {t('doc.font')}
          <FontPick value={font} onPick={onFont} t={t} />
        </label>
        <label title={t('doc.kinsokuTip')}>
          {t('doc.kinsoku')}
          <select
            value={kinsoku ?? ''}
            onChange={(e) =>
              onKinsoku(
                (e.currentTarget.value || undefined) as
                  | KinsokuMode
                  | undefined,
              )
            }
          >
            <option value="">{t('doc.kinsoku.off')}</option>
            <option value="oidashi">{t('doc.kinsoku.oi')}</option>
            <option value="burasage">{t('doc.kinsoku.hang')}</option>
          </select>
        </label>
      </div>
      <StyleList
        styles={styles}
        docFont={font}
        onAdd={onStyleAdd}
        onUpdate={onStyleUpdate}
        onDelete={onStyleDelete}
        t={t}
      />
      <footer className="hint">{t('doc.hint')}</footer>
    </div>
  );
}
