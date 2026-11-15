// 独自書庫形式 — .chsmf（cucul hart silim murlun format。
// zip: doc.json + img/ バイナリ。旧称 .slm — 読込は両対応）
// 画像オブジェクトの dataURL は書庫化時に img/N.ext へ分離し、
// data.url を 'asset:img/N.ext' 参照に置き換える。

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { WorldObject } from '@kimetron/core';
import type { Chain, KinsokuMode, PageModel } from 'inimbal';
import {
  IMG_KIND,
  type FontStyleDef,
  type Guides,
  type ImageData,
} from './types';

export const ARCHIVE_FORMAT = 'silim-murlun/1';
export const ARCHIVE_EXT = '.chsmf';

interface ArchiveDoc {
  format: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  paper: PageModel['spec'];
  pages: PageModel['pages'];
  objects: WorldObject[];
  chains: Chain[];
  footer: boolean;
  pageOpacity: number;
  docFont?: string;
  /** v0.11: 禁則処理 — 欠落 = なし（旧書庫は旧レイアウトを再現） */
  kinsoku?: KinsokuMode;
  /** v0.13: 書式（スタイル）一覧 — 欠落 = 既定セットをシード */
  styles?: FontStyleDef[];
  /** v0.14: ガイドライン（world mm）— 欠落 = ガイドなし */
  guides?: Guides;
}

const EXT_OF_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const MIME_OF_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function base64ToU8(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

function u8ToBase64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) {
    s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** ドキュメント → zip バイナリ */
export function packArchive(input: {
  spec: PageModel['spec'];
  pages: PageModel['pages'];
  objects: WorldObject[];
  chains: Chain[];
  footer: boolean;
  title: string;
  createdAt: string;
  pageOpacity: number;
  docFont?: string;
  kinsoku?: KinsokuMode;
  styles?: FontStyleDef[];
  guides?: Guides;
}): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  let imgN = 0;
  const objects = input.objects.map((o) => {
    if (o.kind !== IMG_KIND) return o;
    const d = o.data as ImageData;
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(d.url);
    if (!m) return o;
    const path = `img/${imgN++}.${EXT_OF_MIME[m[1]] ?? 'bin'}`;
    files[path] = base64ToU8(m[2]);
    return { ...o, data: { ...d, url: `asset:${path}` } };
  });
  const doc: ArchiveDoc = {
    format: ARCHIVE_FORMAT,
    title: input.title,
    createdAt: input.createdAt,
    updatedAt: new Date().toISOString(),
    paper: input.spec,
    pages: input.pages,
    objects,
    chains: input.chains,
    footer: input.footer,
    pageOpacity: input.pageOpacity,
    docFont: input.docFont,
    kinsoku: input.kinsoku,
    styles: input.styles,
    guides: input.guides,
  };
  files['doc.json'] = strToU8(JSON.stringify(doc));
  return zipSync(files);
}

/** zip バイナリ → ドキュメント。形式不正なら throw。 */
export function unpackArchive(bytes: Uint8Array): {
  model: PageModel;
  objects: WorldObject[];
  chains: Chain[];
  footer: boolean;
  title: string;
  createdAt: string;
  pageOpacity: number;
  docFont?: string;
  kinsoku?: KinsokuMode;
  styles?: FontStyleDef[];
  guides?: Guides;
} {
  const files = unzipSync(bytes);
  const raw = files['doc.json'];
  if (!raw) throw new Error('doc.json が書庫にありません');
  const doc = JSON.parse(strFromU8(raw)) as ArchiveDoc;
  if (doc.format !== ARCHIVE_FORMAT) {
    throw new Error(`未対応の書庫形式: ${doc.format}`);
  }
  const objects = (doc.objects ?? []).map((o) => {
    if (o.kind !== IMG_KIND) return o;
    const d = o.data as ImageData;
    const m = /^asset:(.+)$/.exec(d.url);
    if (!m || !files[m[1]]) return o;
    const ext = m[1].split('.').pop() ?? '';
    const mime = MIME_OF_EXT[ext] ?? 'application/octet-stream';
    return {
      ...o,
      data: { ...d, url: `data:${mime};base64,${u8ToBase64(files[m[1]])}` },
    };
  });
  return {
    model: { spec: doc.paper, pages: doc.pages ?? [] },
    objects,
    chains: doc.chains ?? [],
    footer: doc.footer !== false,
    title: doc.title ?? '',
    createdAt: doc.createdAt ?? '',
    pageOpacity: doc.pageOpacity ?? 100,
    docFont: doc.docFont,
    // 未知値は捨てて「なし」扱い — 将来モードが増えた
    // バージョンの書庫を開いても旧レイアウトへ落ちる
    kinsoku:
      doc.kinsoku === 'oidashi' || doc.kinsoku === 'burasage'
        ? doc.kinsoku
        : undefined,
    // v0.13: 書式一覧 — 欠落は呼出し側で既定セットをシードする。
    // 形の合わない要素は捨てる（将来拡張・外部生成書庫への耐性）
    styles: Array.isArray(doc.styles)
      ? doc.styles.filter(
          (s) =>
            s &&
            typeof s.id === 'string' &&
            typeof s.name === 'string' &&
            s.props != null &&
            typeof s.props === 'object',
        )
      : undefined,
    // v0.14: ガイドライン — 欠落 = なし。数値のみ受容
    // （外部生成書庫の不正値を捨てる）
    guides: (() => {
      const g = doc.guides;
      if (!g || typeof g !== 'object') return undefined;
      const nums = (a: unknown): number[] =>
        Array.isArray(a)
          ? a.filter((n) => typeof n === 'number' && Number.isFinite(n))
          : [];
      return { v: nums(g.v), h: nums(g.h) };
    })(),
  };
}
