// 連鎖編集ペイン — 右ペインの連鎖テキスト欄。
// 編集対象は常に連鎖テキスト1本（エリア内直接編集は持たない）。
// IME 確定・キャレット維持・順序崩れの問題が構造的に消える設計。
// 選択範囲への部分装飾（TextMark）とフォント選択（FontPick）を持つ。

import { useLayoutEffect, useRef, useState } from 'react';
import { sliceRuns, type Chain, type TextAttrs } from 'inimbal';
import type { TFunc } from './i18n';
import { tf } from './i18n';
import type { TextAreaData } from './types';
import { DEFAULT_TEXT_DATA, FONT_SIZES_MM } from './types';
import { FontPick } from './FontPick';

// textarea のキャレット位置へスクロールする — ブラウザの
// caret-into-view は環境依存で効かないため、同じスタイルの
// 不可視 div で文字位置を実測して scrollTop を直接設定する
// （kusuma-plava ChainPane と同じ textarea-caret-position 定番手法）
const scrollTaToCaret = (el: HTMLTextAreaElement, pos: number) => {
  const div = document.createElement('div');
  const cs = getComputedStyle(el);
  // textarea-caret-position 定番のプロパティ一式 — フォント
  // メトリクス・パディング・ラップ挙動を完全に揃えないと
  // 長文では行数ぶん誤差が蓄積する
  const props = [
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'fontKerning',
    'fontFeatureSettings',
    'fontVariantEastAsian',
    'textRendering',
    'wordBreak',
    'overflowWrap',
    'lineBreak',
    'direction',
    'unicodeBidi',
    'textSizeAdjust',
  ];
  for (const p of props) div.style.setProperty(p, cs.getPropertyValue(p));
  // 幅は css width ではなく clientWidth − padding を使う —
  // 縦スクロールバー分の差で折返し位置が変わる
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  div.style.boxSizing = 'content-box';
  div.style.width = `${el.clientWidth - padL - padR}px`;
  div.style.whiteSpace = 'pre-wrap';
  if (!cs.overflowWrap || cs.overflowWrap === 'normal')
    div.style.overflowWrap = 'break-word';
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.textContent = el.value.slice(0, pos);
  const marker = document.createElement('span');
  marker.textContent = el.value.slice(pos, pos + 1) || 'x';
  div.appendChild(marker);
  // 全文を入れて総高さを比べ、比率で位置を自己補正する —
  // 環境差で発生する折返しの系統的誤差は el/div の
  // scrollHeight 比で打ち消せる（pos までの部分だけでは
  // 比較できないため全文が必須）
  div.appendChild(document.createTextNode(el.value.slice(pos + 1)));
  document.body.appendChild(div);
  const ratio =
    div.scrollHeight > 0 ? el.scrollHeight / div.scrollHeight : 1;
  el.scrollTop = Math.max(
    0,
    marker.offsetTop * ratio - el.clientHeight / 2,
  );
  div.remove();
};

export function ChainPane({
  chain,
  /** ペインを開いたエリア（フォント等はこのエリア単位） */
  areaData,
  overflow,
  onText,
  onApplyMark,
  onClearMarks,
  onAreaData,
  onClose,
  jumpSel,
  onJumpApplied,
  t,
}: {
  chain: Chain;
  areaData: TextAreaData | null;
  overflow: string;
  onText: (text: string) => void;
  /** 選択範囲 [s,e) への部分装飾適用 */
  onApplyMark: (s: number, e: number, attrs: Partial<TextAttrs>) => void;
  /** 選択範囲 [s,e) 内の装飾マーク除去 */
  onClearMarks: (s: number, e: number) => void;
  onAreaData: (patch: Partial<TextAreaData>) => void;
  onClose: () => void;
  /** v0.10: 全文検索ジャンプ — App 側がヒット位置の選択範囲を投げる。
      chainId がこのペインの連鎖と一致したときだけ適用する */
  jumpSel?: { s: number; e: number; n: number; chainId: string } | null;
  /** jumpSel を適用し終えたら呼ぶ（App 側で要求をクリアするため） */
  onJumpApplied?: () => void;
  t: TFunc;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 選択範囲はボタン押下でフォーカスが外れても保持するため state で記憶
  const [sel, setSel] = useState<{ s: number; e: number }>({ s: 0, e: 0 });
  const [markColor, setMarkColor] = useState('#222222');

  // 全文検索ジャンプ — ヒット位置の選択範囲を適用してスクロール。
  // フォーカスは移さない（find バーの入力欄で打ち続けられるように）
  const lastJump = useRef(0);
  useLayoutEffect(() => {
    const el = taRef.current;
    if (
      !el ||
      !jumpSel ||
      jumpSel.chainId !== chain.id ||
      jumpSel.n === lastJump.current
    )
      return;
    lastJump.current = jumpSel.n;
    scrollTaToCaret(el, jumpSel.s);
    el.selectionStart = jumpSel.s;
    el.selectionEnd = jumpSel.e;
    onJumpApplied?.();
  }, [jumpSel, chain.id]);

  // 選択開始位置の実効色（マーク後勝ち → エリア既定へフォールバック）
  const colorAt = (pos: number) => {
    const base: TextAttrs = { ...DEFAULT_TEXT_DATA, ...areaData };
    return (
      sliceRuns(chain.text[pos] ?? 'x', chain.marks, pos, base)[0]?.attrs
        .color ??
      base.color ??
      '#222222'
    );
  };

  const syncSel = () => {
    const el = taRef.current;
    if (!el) return;
    setSel({ s: el.selectionStart, e: el.selectionEnd });
    if (el.selectionEnd > el.selectionStart)
      setMarkColor(colorAt(el.selectionStart));
  };

  const hasSel = sel.e > sel.s;
  const apply = (attrs: Partial<TextAttrs>) =>
    hasSel && onApplyMark(sel.s, sel.e, attrs);

  return (
    <aside className="chain-pane">
      <header>
        <span>{tf(t, 'chain.title', chain.areas.length)}</span>
        <button onClick={onClose} title={t('chain.close')}>
          ×
        </button>
      </header>
      <textarea
        ref={taRef}
        className="chain-text"
        value={chain.text}
        spellCheck={false}
        placeholder={t('chain.placeholder')}
        onChange={(e) => onText(e.currentTarget.value)}
        onSelect={syncSel}
      />
      {overflow && (
        <div className="chain-overflow">
          {tf(
            t,
            'chain.overflow',
            overflow.length,
            overflow.replace(/\n/g, '⏎').slice(0, 14),
          )}
        </div>
      )}
      <div className="chain-marks">
        <span className="chain-marks-label">{t('chain.mark')}</span>
        <button disabled={!hasSel} onClick={() => apply({ bold: true })}>
          B
        </button>
        <button disabled={!hasSel} onClick={() => apply({ italic: true })}>
          I
        </button>
        <button disabled={!hasSel} onClick={() => apply({ underline: true })}>
          U
        </button>
        <input
          type="color"
          disabled={!hasSel}
          title={t('font.color')}
          value={markColor}
          // ダイアログを開いた時点で表示色を適用（同色確定の Enter でも
          // change が出ないため）。別色を選べば change で上書き適用される。
          onFocus={() => hasSel && apply({ color: markColor })}
          onChange={(e) => {
            setMarkColor(e.currentTarget.value);
            apply({ color: e.currentTarget.value });
          }}
        />
        <select
          disabled={!hasSel}
          value=""
          title={t('chain.size')}
          onChange={(e) => {
            if (e.currentTarget.value)
              apply({ fontSize: Number(e.currentTarget.value) });
          }}
        >
          <option value="">—</option>
          {FONT_SIZES_MM.map((s) => (
            <option key={s} value={s}>
              {s}mm
            </option>
          ))}
        </select>
        <FontPick
          className="chain-marks-font"
          value=""
          placeholder={t('chain.markFont')}
          disabled={!hasSel}
          onPick={(stack) => apply({ fontFamily: stack })}
          t={t}
        />
        <input
          className="chain-marks-link"
          type="url"
          disabled={!hasSel}
          placeholder={t('chain.markLink')}
          onKeyDown={(e) => {
            const v = e.currentTarget.value.trim();
            if (e.key === 'Enter' && v) {
              // スキーム省略は https 補完（PDFのリンク注釈化に必要）
              apply({ link: /^[a-z]+:/i.test(v) ? v : `https://${v}` });
              e.currentTarget.value = '';
            }
          }}
        />
        <button
          disabled={!hasSel}
          onClick={() => onClearMarks(sel.s, sel.e)}
        >
          {t('chain.markClear')}
        </button>
      </div>
      {areaData && (
        <div className="chain-font">
          <label>
            {t('chain.font')}
            <FontPick
              className="chain-font-family"
              value={areaData.fontFamily}
              onPick={(stack) => onAreaData({ fontFamily: stack })}
              t={t}
            />
          </label>
          <label>
            {t('chain.size')}
            <select
              value={areaData.fontSize}
              onChange={(e) =>
                onAreaData({ fontSize: Number(e.currentTarget.value) })
              }
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
              value={areaData.color ?? '#222222'}
              onChange={(e) => onAreaData({ color: e.currentTarget.value })}
            />
          </label>
          <label>
            B
            <input
              type="checkbox"
              checked={!!areaData.bold}
              onChange={(e) => onAreaData({ bold: e.currentTarget.checked })}
            />
          </label>
          <label>
            I
            <input
              type="checkbox"
              checked={!!areaData.italic}
              onChange={(e) => onAreaData({ italic: e.currentTarget.checked })}
            />
          </label>
          <label>
            U
            <input
              type="checkbox"
              checked={!!areaData.underline}
              onChange={(e) =>
                onAreaData({ underline: e.currentTarget.checked })
              }
            />
          </label>
          <label>
            {t('chain.areaLink')}
            <input
              type="url"
              className="chain-area-link"
              value={areaData.link ?? ''}
              placeholder="https://…"
              onChange={(e) =>
                onAreaData({ link: e.currentTarget.value || undefined })
              }
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v && !/^[a-z]+:/i.test(v))
                  onAreaData({ link: `https://${v}` });
              }}
            />
          </label>
        </div>
      )}
      <footer className="chain-links">
        {chain.areas.length > 1
          ? `${chain.areas.join(' → ')}`
          : t('chain.nolink')}
      </footer>
    </aside>
  );
}
