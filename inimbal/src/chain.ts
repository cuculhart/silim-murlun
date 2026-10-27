// INIMBAL — 文字送り stratum。Kimetron 非依存の純粋モデル。
//
// モデル:
//   TextChain = TextArea の順序つき連鎖（一方通行・線形のみ）
//   slices は chain text の厳密な分割（join(slices) + overflow === text）
//
// 計測は注入する（DOM/Canvas 依存をここに持ち込まない）

/** エリアの内寸（表示域）+ タイポグラフィ。
    width/height/fontSize の単位は呼び出し側と計測側で
    揃えておく（本アプリでは mm） */
export interface AreaBox {
  id: string;
  width: number;
  height: number;
  /** フォントサイズ（mm）。省略時は計測側の既定 */
  fontSize?: number;
  /** フォントファミリ（CSS 名）。省略時は計測側の既定 */
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
}

/** テキスト計測の注入インターフェース */
export interface TextMeasurer {
  /** text を box の内寸へ流し込み、収まった接頭辞の文字数を返す */
  fit(text: string, box: AreaBox): number;
}

export interface Slice {
  areaId: string;
  text: string;
}

export interface LayoutResult {
  slices: Slice[];
  /** 連鎖末尾に収まらなかった残り */
  overflow: string;
}

/**
 * 連鎖テキストをエリア列へ貪欲に配分する。
 * boxes の順序 = 連鎖順。残りは overflow に返す。
 */
export function layoutChain(
  text: string,
  boxes: AreaBox[],
  measure: TextMeasurer,
): LayoutResult {
  const slices: Slice[] = [];
  let rest = text;
  for (const b of boxes) {
    const n = measure.fit(rest, b);
    slices.push({ areaId: b.id, text: rest.slice(0, n) });
    rest = rest.slice(n);
  }
  return { slices, overflow: rest };
}

/** 順序つき連鎖。areas はエリア id の配列、text は連鎖全体の本文 */
export interface Chain {
  id: string;
  areas: string[];
  text: string;
}

/** エリア id → 所属連鎖 */
export function chainOf(chains: Chain[], areaId: string): Chain | undefined {
  return chains.find((c) => c.areas.includes(areaId));
}

/** 連鎖内の位置（0-based）。未所属なら -1 */
export function chainPos(chain: Chain, areaId: string): number {
  return chain.areas.indexOf(areaId);
}

// 連結テキスト規則: 両方非空なら改行1つで継ぐ（spike 準拠）
function joinTexts(a: string, b: string): string {
  return a && b ? `${a}\n${b}` : a + b;
}

/**
 * 連結可能か: from が自連鎖の末尾、to が別連鎖の先頭。
 * 線形一方通行のみ — 末尾起点なので 1→複数 は出ず、
 * 先頭宛てなので 複数→1 も循環（同一連鎖への接続）も構造的に禁止。
 */
export function canLink(
  chains: Chain[],
  fromArea: string,
  toArea: string,
): boolean {
  const cf = chainOf(chains, fromArea);
  const ct = chainOf(chains, toArea);
  if (!cf || !ct || cf.id === ct.id) return false;
  return cf.areas[cf.areas.length - 1] === fromArea && ct.areas[0] === toArea;
}

/**
 * 2連鎖を from の末尾 → to の先頭で結合（text も連結）。
 * 不可なら chains をそのまま返す。to 側の連鎖は消える。
 */
export function linkChains(
  chains: Chain[],
  fromArea: string,
  toArea: string,
): Chain[] {
  if (!canLink(chains, fromArea, toArea)) return chains;
  const cf = chainOf(chains, fromArea)!;
  const ct = chainOf(chains, toArea)!;
  const merged: Chain = {
    id: cf.id,
    areas: [...cf.areas, ...ct.areas],
    text: joinTexts(cf.text, ct.text),
  };
  return chains
    .map((c) => (c.id === cf.id ? merged : c))
    .filter((c) => c.id !== ct.id);
}

/**
 * chain の index 番目と index+1 番目の間を切断。
 * テキストは全量 head 側に残る（巻き戻し）。tail は空の新連鎖。
 */
export function unlinkAt(
  chains: Chain[],
  chainId: string,
  index: number,
  tailId: string,
): Chain[] {
  const c = chains.find((c) => c.id === chainId);
  if (!c || index < 0 || index >= c.areas.length - 1) return chains;
  const head: Chain = { ...c, areas: c.areas.slice(0, index + 1) };
  const tail: Chain = { id: tailId, areas: c.areas.slice(index + 1), text: '' };
  return chains.flatMap((x) => (x.id === chainId ? [head, tail] : [x]));
}

/** 連鎖途中にエリアを挿入。テキストは不変 → 残りエリアへ再配分される */
export function insertArea(
  chains: Chain[],
  chainId: string,
  index: number,
  areaId: string,
): Chain[] {
  const c = chains.find((c) => c.id === chainId);
  if (!c || index < 0 || index > c.areas.length) return chains;
  const areas = [...c.areas.slice(0, index), areaId, ...c.areas.slice(index)];
  return chains.map((x) => (x.id === chainId ? { ...x, areas } : x));
}

/**
 * エリアを連鎖から外す。テキストは残りエリアへ再配分される。
 * 空になった連鎖は消す。
 */
export function removeArea(chains: Chain[], areaId: string): Chain[] {
  return chains.flatMap((c) => {
    if (!c.areas.includes(areaId)) return [c];
    const areas = c.areas.filter((a) => a !== areaId);
    return areas.length === 0 ? [] : [{ ...c, areas }];
  });
}

/**
 * 存在しないエリアを全連鎖から取り除く（テキストは保持 → 再配分）。
 * オブジェクト削除後の整合化に使う。
 */
export function pruneChains(
  chains: Chain[],
  exists: (areaId: string) => boolean,
): Chain[] {
  return chains.flatMap((c) => {
    const areas = c.areas.filter(exists);
    if (areas.length === c.areas.length) return [c];
    return areas.length === 0 ? [] : [{ ...c, areas }];
  });
}
