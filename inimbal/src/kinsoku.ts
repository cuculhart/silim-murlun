// 横組み行分割 + 禁則（v0.11・N-24）— Kimetron 非依存の純粋モデル。
//
// measure.ts（app 側 canvas 計測）の fit() から、行分割の判断部分だけを
// 抽出したもの。表示幅の計測は注入する（DOM/Canvas を持ち込まない）。
//
// 禁則は境界調整のみ（追い出し）— kusuma-plava tategaki.ts と同じ
// 実務ルール: 分割点で次行頭が行頭禁則字・前行末が行末禁則字なら、
// 分割点を最大2字前倒しして次行へ送る。追い込み・ぶら下げはやらない。

// ── 禁則字種表（kusuma-plava tategaki.ts から借用） ──
// 行頭禁則: 句読点・中点・コロン類・感嘆疑問・閉じ括弧・長音繰返し・
//           省略記号・小さい仮名・半角の , . : ; ! ? ) と語中記号
const HEAD_KINSOKU = new Set([
  ...'。、・：；！？!?:;,.)]}〕］｝〉》」』〙〛〜ゝゞ々ヽヾー…‥',
  ...'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ',
  // 語中の半角記号を行頭にしない — ハイフン語や数値+単位が
  // 行境界で分断されるのを抑える（日本-1・50%・C# 等）
  ...'-+/#%_',
]);
// 行末禁則: 開き括弧（全半角）と、語中で行末に残したくないハイフン
const END_KINSOKU = new Set([...'（〔［｛〈《「『〘〚([{', '-']);

/** 行頭に来られない字か（行頭禁則） */
export const isHeadKinsoku = (ch: string) => HEAD_KINSOKU.has(ch);
/** 行末に来られない字か（行末禁則） */
export const isEndKinsoku = (ch: string) => END_KINSOKU.has(ch);

// v0.12: ぶら下げ対象（kinsoku='burasage'）— 行の規定幅へ1字はみ出して
// 置ける行頭禁則字を句読点類に限定する（閉じ括弧等は対象外 — 追い出し側
// の前倒しで処理する。原則1字まで。kusuma tategaki.ts と同じ字種）
const HANG_KINSOKU = new Set([...'。、．，｡､']);

/** 行の規定幅へはみ出して置ける字か（ぶら下げ対象） */
export const isHangKinsoku = (ch: string) => HANG_KINSOKU.has(ch);

/** 禁則モード — 'oidashi'=追い出し / 'burasage'=ぶら下げ。
    欠落（undefined）= なし */
export type KinsokuMode = 'oidashi' | 'burasage';

/** 追い出しの最大前倒し字数（kusuma と同じ実務ルール） */
const MAX_PULL = 2;

/**
 * 追い出し禁則の分割点前倒し。
 * text[lineStart, breakPos) を現行・text[breakPos...] を次行とする
 * 分割について、次行頭が行頭禁則字 or 前行末が行末禁則字なら
 * 分割点を最大 MAX_PULL 字 前倒しする。現行に最低1字は残す
 * （行が空になる前倒しはしない — 最後の1字を倒すと分割が
 * 進まず無限ループになるため。残った違反はそのまま出す）。
 * 「2字」は半角連続も1字として数える（UTF-16 コードユニット）。
 */
export function kinsokuBreak(
  text: string,
  lineStart: number,
  breakPos: number,
): number {
  let pull = 0;
  while (pull < MAX_PULL && breakPos - pull - 1 > lineStart) {
    const last = text[breakPos - pull - 1];
    const next = text[breakPos - pull];
    if (next === undefined) break;
    if (!isHeadKinsoku(next) && !isEndKinsoku(last)) break;
    pull++;
  }
  return breakPos - pull;
}

/** fitText へ注入する計測 — 単位は maxW/maxH と揃える（app 側は px） */
export interface LineMetrics {
  /** text[s,e) の表示幅 */
  widthOf(s: number, e: number): number;
  /** index i の字のサイズ（行高さ計算用 — fontSize 相当） */
  sizeAt(i: number): number;
  /** text[s,e) 内の最大サイズ（行高さ = 行内最大 fontSize 相当） */
  maxSizeIn(s: number, e: number): number;
}

/**
 * 横組み fit() の行分割コア — text を幅 maxW・高さ maxH の箱へ
 * 流し込み、収まる接頭辞と行の区切り位置を返す。
 * 幅超過 → 直前の空白で切る（空白は前行末へ残す）or 文字単位で
 * 強制切断（和文）。\n は行送り。2行目以降が高さに入らないなら
 * その行頭で打ち切る（1行目は必ず計上）。
 * opts.kinsoku='oidashi' で禁則の分割点前倒し、'burasage' で
 * 句読点類の1字はみ出し（前倒しも併用）が有効になる。
 * breaks は「次行の先頭位置」の列 — 収まった接頭辞内に限る。
 */
export function fitLines(
  text: string,
  maxW: number,
  maxH: number,
  m: LineMetrics,
  opts?: { lineHeight?: number; kinsoku?: KinsokuMode },
): { n: number; breaks: number[] } {
  const lh0 = opts?.lineHeight ?? 1.4;
  const kinsoku = opts?.kinsoku;
  const oidashi = kinsoku === 'oidashi' || kinsoku === 'burasage';
  const burasage = kinsoku === 'burasage';
  let pos = 0;
  let lineStart = 0;
  let usedH = 0;
  let lineMaxPx = 0;
  let hang = false; // 現行ですでに句読点をはみ出したか（1字まで）
  const breaks: number[] = [];
  while (pos < text.length) {
    const ch = text[pos];
    const rpx = m.sizeAt(pos);
    if (ch === '\n') {
      const lh = Math.max(lineMaxPx, rpx) * lh0;
      // 2行目以降が高さに入らないなら手前で切る（1行目は必ず計上）
      if (usedH > 0 && usedH + lh > maxH) {
        pos = lineStart;
        break;
      }
      usedH += lh;
      lineMaxPx = 0;
      hang = false;
      pos++;
      lineStart = pos;
      breaks.push(pos);
      continue;
    }
    if (m.widthOf(lineStart, pos + 1) <= maxW) {
      lineMaxPx = Math.max(lineMaxPx, rpx);
      pos++;
      continue;
    }
    if (pos === lineStart) {
      lineMaxPx = Math.max(lineMaxPx, rpx);
      pos++; // 1字でも幅超過 → 強制進行
      continue;
    }
    // ぶら下げ — 次行頭になる句読点類は1字だけ現行へはみ出す。
    // 連続句読点（、。等）は2字目以降が通常の境界調整へ落ち、
    // 前倒しが起きればはみ出した句読点ごと次行へ送られる
    if (burasage && !hang && isHangKinsoku(ch)) {
      hang = true;
      lineMaxPx = Math.max(lineMaxPx, rpx);
      pos++;
      continue;
    }
    // 直前の空白で切る（空白は前行末へ残す）
    const sp = text.lastIndexOf(' ', pos);
    let breakPos = sp >= lineStart ? sp + 1 : pos;
    // 追い出し禁則 — 次行頭が行頭禁則字 or 前行末が行末禁則字なら
    // 分割点を最大2字前倒しして次行へ送る
    if (oidashi) breakPos = kinsokuBreak(text, lineStart, breakPos);
    const lh = m.maxSizeIn(lineStart, breakPos) * lh0;
    if (usedH > 0 && usedH + lh > maxH) {
      pos = lineStart;
      break;
    }
    usedH += lh;
    pos = breakPos;
    lineStart = pos;
    lineMaxPx = 0;
    hang = false;
    breaks.push(pos);
  }
  return { n: pos, breaks: breaks.filter((b) => b < pos) };
}

/**
 * 収まる接頭辞の文字数だけが欲しい場合の薄いラッパ。
 */
export function fitText(
  text: string,
  maxW: number,
  maxH: number,
  m: LineMetrics,
  opts?: { lineHeight?: number; kinsoku?: KinsokuMode },
): number {
  return fitLines(text, maxW, maxH, m, opts).n;
}

/**
 * スライステキストを行区切りで分けた [s,e) 区間列を返す。
 * breaks は fitLines が返す行頭位置（slice text 先頭基準）。
 */
export function lineRanges(
  text: string,
  breaks: number[] | undefined,
): [number, number][] {
  const starts = [0, ...(breaks ?? [])];
  return starts.map((s, i) => [
    s,
    i + 1 < starts.length ? starts[i + 1] : text.length,
  ]);
}
