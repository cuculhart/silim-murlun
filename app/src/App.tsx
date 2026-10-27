import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IsleCanvas, useEngine, useEngineVersion } from '@kimetron/react';
import { formatLength, type Engine, type WorldObject } from '@kimetron/core';
import {
  addPage,
  applyVerticalShift,
  canLink,
  chainOf,
  createPages,
  deletePage,
  insertPage,
  layoutChain,
  linkChains,
  pageRects,
  pruneChains,
  setPaper,
  unlinkAt,
  type Chain,
  type LayoutResult,
  type PageModel,
  type PaperSize,
} from 'inimbal';
import { RightDock } from './Inspector';
import { LinkWires, type LinkSel } from './LinkWires';
import { MenuPane, type ShapeTool, type Theme } from './MenuPane';
import { PageNav } from './PageNav';
import { Printout } from './Printout';
import { Rulers } from './Rulers';
import { packArchive, unpackArchive } from './docio';
import { createCanvasMeasurer } from './measure';
import {
  DEFAULT_TEXT_DATA,
  IMG_KIND,
  LINE_HEIGHT,
  liveRect,
  MM_PX,
  PAGE_KIND,
  TEXT_KIND,
  TEXT_PAD_MM,
  type ImageData,
  type TextAreaData,
} from './types';
import './styles.css';

/** ページ枠を kimetron オブジェクトとして展開する。
    locked + layer -1 で最背面・操作対象外（hitFilter でも除外）。 */
function pageObjects(model: PageModel): WorldObject[] {
  return pageRects(model.spec, model.pages).map((r) => ({
    id: r.id,
    kind: PAGE_KIND,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    locked: true,
    layer: -1,
    style: { fill: '#ffffff' },
    data: { index: r.index },
  }));
}

/** ページの辺・中心をドラッグ/リサイズのスナップ対象へ登録する */
function syncSnapExtra(engine: Engine, model: PageModel): void {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of pageRects(model.spec, model.pages)) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w);
    ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  engine.snapExtra = { xs, ys };
}

const DEMO_TEXT =
  'ここはテキストエリアです。長い文章を入れるとエリアの高さからあふれ、' +
  'リンクした次のエリアへ流れ込みます。改行もそのまま流れます。\n' +
  'リンクモードで別のエリアへ接続すると、文字がページをまたいで流れます。' +
  '線をクリックして Del を押すと切断して巻き戻ります。';

/** 画像取り込みダイアログの状態 */
interface ImgDlg {
  url: string;
  natW: number;
  natH: number;
  w: number;
  h: number;
  lock: boolean;
}

export function App() {
  const engine = useEngine({
    units: 'mm',
    origin: 'top-left',
    grid: { size: 5, snap: true, major: 2 }, // 5mm 副線 / 10mm 主線
  });
  useEngineVersion(engine);

  const [model, setModel] = useState<PageModel>(() =>
    createPages({ size: 'A4', landscape: false }, 3),
  );
  const [chains, setChains] = useState<Chain[]>([]);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [selLink, setSelLink] = useState<LinkSel | null>(null);
  const [hint, setHint] = useState('');
  const [imgDlg, setImgDlg] = useState<ImgDlg | null>(null);
  const [placing, setPlacing] = useState<{
    url: string;
    w: number;
    h: number;
    aspect: number;
    lock: boolean;
  } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    wire?: LinkSel;
  } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('silim-theme') as Theme) || 'standard',
  );
  const [collapsed, setCollapsed] = useState(false);
  const [footer, setFooter] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [shapeTool, setShapeTool] = useState<ShapeTool | null>(null);
  const [shapeDrag, setShapeDrag] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [saveDlg, setSaveDlg] = useState<string | null>(null);
  const [rulerOn, setRulerOn] = useState(true);
  const [histTick, setHistTick] = useState(0);
  const createdAtRef = useRef(new Date().toISOString());
  const dirtyRef = useRef(false);
  const applyingRef = useRef(false);
  type Snap = {
    objects: WorldObject[];
    chains: Chain[];
    model: PageModel;
    footer: boolean;
    title: string;
  };
  const histRef = useRef<{ past: Snap[]; future: Snap[]; last: number }>({
    past: [],
    future: [],
    last: 0,
  });
  const snapRef = useRef<Snap | null>(null);

  const seqRef = useRef(1);
  /** 既存オブジェクト・連鎖と衝突しない id を採番する
      （デモ/書庫読込の固定 id とぶつからないよう走査） */
  const nextId = (prefix: 'ta' | 'im' | 'sh' | 'c'): string => {
    const taken = new Set([
      ...engine.doc.objects.map((o) => o.id),
      ...chainsRef.current.map((c) => c.id),
    ]);
    let n = seqRef.current;
    while (taken.has(`${prefix}${n}`)) n++;
    seqRef.current = n + 1;
    return `${prefix}${n}`;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openFileRef = useRef<HTMLInputElement>(null);
  const chainsRef = useRef(chains);
  chainsRef.current = chains;
  const linkModeRef = useRef(linkMode);
  linkModeRef.current = linkMode;
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const measurerRef = useRef(createCanvasMeasurer());

  const flash = (msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint((h) => (h === msg ? '' : h)), 2500);
  };

  // ── 初期化: ページ枠 + デモの連鎖エリア ──
  useEffect(() => {
    engine.hitFilter = (o) => o.kind !== PAGE_KIND && !linkModeRef.current;
    engine.marqueeFilter = (o) =>
      o.kind !== PAGE_KIND && !linkModeRef.current;
    const ta = (id: string, x: number, y: number): WorldObject => ({
      id,
      kind: TEXT_KIND,
      x,
      y,
      w: 80,
      h: 50,
      style: {
        fill: 'rgba(255,255,255,0.55)',
        stroke: 'rgba(90,110,140,0.4)',
      },
      data: { ...DEFAULT_TEXT_DATA },
    });
    engine.setDoc({
      ...engine.doc,
      objects: [
        ...pageObjects(model),
        ta('ta1', 30, 30),
        ta('ta2', 30, 20 + (297 + 12) + 10),
      ],
    });
    syncSnapExtra(engine, model);
    setChains([{ id: 'c0', areas: ['ta1', 'ta2'], text: DEMO_TEXT }]);
    engine.setSelection(['ta1']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // ── doc 変更 → 消えたエリアを連鎖から取り除く（テキストは保持→再配分） ──
  useEffect(
    () =>
      engine.onDocChange((doc) => {
        const alive = new Set(
          doc.objects.filter((o) => o.kind === TEXT_KIND).map((o) => o.id),
        );
        setChains((cs) => pruneChains(cs, (id) => alive.has(id)));
        setSelLink((sl) => {
          if (!sl) return sl;
          const c = chainsRef.current.find((x) => x.id === sl.chainId);
          return c && sl.index < c.areas.length - 1 ? sl : null;
        });
      }),
    [engine],
  );

  // ── Del: リンク線選択時は巻き戻し切断、オブジェクト選択時は削除 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement as HTMLElement | null;
      if (t && ['TEXTAREA', 'INPUT', 'SELECT'].includes(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSaveDlg(docTitle || 'document');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        setLinkMode(false);
        setLinkFrom(null);
        setSelLink(null);
        setShapeTool(null);
        setShapeDrag(null);
        if (placingRef.current) {
          setPlacing(null);
          setGhost(null);
        }
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selLink) {
        setChains((cs) =>
          unlinkAt(cs, selLink.chainId, selLink.index, nextId('c')),
        );
        setSelLink(null);
      } else {
        engine.removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selLink, docTitle]);

  // ── Ctrl+P / ブラウザの印刷メニューでも印刷用 DOM を組み立てる ──
  useEffect(() => {
    const onBefore = () => flushSync(() => setPrinting(true));
    window.addEventListener('beforeprint', onBefore);
    return () => window.removeEventListener('beforeprint', onBefore);
  }, []);

  // ── ページ操作（F3） ──
  const commitPages = (next: PageModel, objects?: WorldObject[]) => {
    setModel(next);
    const content =
      objects ?? engine.doc.objects.filter((o) => o.kind !== PAGE_KIND);
    engine.setDoc({
      ...engine.doc,
      objects: [...pageObjects(next), ...content],
    });
    syncSnapExtra(engine, next);
  };
  const setSize = (size: PaperSize) =>
    commitPages(setPaper(model, { ...model.spec, size }));
  const toggleLandscape = () =>
    commitPages(
      setPaper(model, { ...model.spec, landscape: !model.spec.landscape }),
    );
  const appendPage = () => commitPages(addPage(model));
  const removePage = (id: string) => commitPages(deletePage(model, id));
  const insertAt = (index: number) => {
    const res = insertPage(model, index);
    const content = applyVerticalShift(
      engine.doc.objects.filter((o) => o.kind !== PAGE_KIND),
      res.thresholdY,
      res.dy,
    );
    commitPages({ ...model, pages: res.pages }, content);
  };
  const insertBelow = (index: number) => insertAt(index + 1);
  const removeCurrentPage = () => {
    const r = pageRects(model.spec, model.pages)[curPage];
    if (r) removePage(r.id);
  };

  // ── ファイル操作（.slm 書庫） ──
  const contentObjects = () =>
    engine.doc.objects.filter((o) => o.kind !== PAGE_KIND);

  // ── Undo/Redo（doc＋連鎖＋ページ＋設定の統合スナップショット） ──
  const makeSnap = (): Snap => ({
    objects: contentObjects(),
    chains,
    model,
    footer,
    title: docTitle,
  });
  const applySnap = (s: Snap) => {
    applyingRef.current = true;
    setModel(s.model);
    engine.setDoc({
      ...engine.doc,
      objects: [...pageObjects(s.model), ...s.objects],
    });
    syncSnapExtra(engine, s.model);
    setChains(s.chains);
    setFooter(s.footer);
    setDocTitle(s.title);
    snapRef.current = s;
    applyingRef.current = false;
  };
  const undo = () => {
    const h = histRef.current;
    const s = h.past.pop();
    if (!s || !snapRef.current) return;
    h.future.push(snapRef.current);
    applySnap(s);
    setHistTick((t) => t + 1);
  };
  const redo = () => {
    const h = histRef.current;
    const s = h.future.pop();
    if (!s || !snapRef.current) return;
    h.past.push(snapRef.current);
    applySnap(s);
    setHistTick((t) => t + 1);
  };

  // 変更検知 → 500ms の連続編集を1エントリに畳んで履歴へ
  useEffect(() => {
    if (!snapRef.current) {
      snapRef.current = makeSnap();
      return;
    }
    dirtyRef.current = true;
    if (applyingRef.current) return;
    const now = Date.now();
    if (now - histRef.current.last > 500) {
      const h = histRef.current;
      h.past.push(snapRef.current);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
      h.last = now;
      setHistTick((t) => t + 1);
    }
    snapRef.current = makeSnap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.doc.objects, chains, model, footer, docTitle]);

  // 未保存変更があるときの離脱警告
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const newDoc = () => {
    if (!window.confirm('新規作成します。現在の内容は破棄されます。')) return;
    commitPages(createPages({ size: 'A4', landscape: false }, 1), []);
    setChains([]);
    setFooter(true);
    setDocTitle('');
    createdAtRef.current = new Date().toISOString();
    dirtyRef.current = false;
    engine.setSelection([]);
  };
  const confirmSave = (name: string) => {
    const u8 = packArchive({
      spec: model.spec,
      pages: model.pages,
      objects: contentObjects(),
      chains,
      footer,
      title: docTitle,
      createdAt: createdAtRef.current,
    });
    const a = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([u8.buffer as ArrayBuffer], {
        type: 'application/octet-stream',
      }),
    );
    a.href = url;
    a.download = name.endsWith('.slm') ? name : `${name}.slm`;
    a.click();
    URL.revokeObjectURL(url);
    dirtyRef.current = false;
    setSaveDlg(null);
  };
  const onOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    f.arrayBuffer()
      .then((buf) => {
        const r = unpackArchive(new Uint8Array(buf));
        commitPages(r.model, r.objects);
        setChains(r.chains);
        setFooter(r.footer);
        setDocTitle(r.title);
        createdAtRef.current = r.createdAt || new Date().toISOString();
        dirtyRef.current = false;
        engine.setSelection([]);
      })
      .catch((err: Error) => flash(`開けません: ${err.message}`));
  };

  // ── テキストエリア生成（用紙上ダブルクリック） ──
  const onDblClick = (e: React.MouseEvent) => {
    if (linkModeRef.current || placingRef.current) return;
    // ページ枠上のダブルクリックはエリア生成を許可する
    // （ページも data-ki-obj を持つため、コンテンツオブジェクト上のみ除外）
    const hitEl = (e.target as HTMLElement).closest?.(
      '[data-ki-obj]',
    ) as HTMLElement | null;
    const hitObj = hitEl?.dataset.kiObj
      ? engine.doc.objects.find((x) => x.id === hitEl.dataset.kiObj)
      : undefined;
    if (hitObj && hitObj.kind !== PAGE_KIND) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const w = engine.screenToWorld({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
    const onPaper = pageRects(model.spec, model.pages).some(
      (p) => w.x >= p.x && w.x < p.x + p.w && w.y >= p.y && w.y < p.y + p.h,
    );
    if (!onPaper) {
      flash('用紙の上をダブルクリックでテキストエリア');
      return;
    }
    const gs = engine.doc.grid.size || 5;
    const id = nextId('ta');
    engine.addObject({
      id,
      kind: TEXT_KIND,
      x: Math.round(w.x / gs) * gs,
      y: Math.round(w.y / gs) * gs,
      w: 60,
      h: 45,
      style: {
        fill: 'rgba(255,255,255,0.55)',
        stroke: 'rgba(90,110,140,0.4)',
      },
      data: { ...DEFAULT_TEXT_DATA },
    });
    setChains((cs) => [
      ...cs,
      { id: nextId('c'), areas: [id], text: '' },
    ]);
    engine.setSelection([id]);
  };

  // ── リンクモード: 末尾 → 別連鎖の先頭 のみ接続可（線形一方通行） ──
  const pickLink = (areaId: string) => {
    const cs = chainsRef.current;
    const c = chainOf(cs, areaId);
    if (!c) return;
    if (!linkFrom) {
      if (c.areas[c.areas.length - 1] !== areaId) {
        flash('接続の起点は連鎖の末尾エリアです');
        return;
      }
      setLinkFrom(areaId);
      return;
    }
    if (linkFrom === areaId) {
      setLinkFrom(null);
      return;
    }
    if (canLink(cs, linkFrom, areaId)) {
      setChains(linkChains(cs, linkFrom, areaId));
      setLinkFrom(null);
      setLinkMode(false);
    } else {
      flash('接続先は別連鎖の先頭エリアです');
      if (c.areas[c.areas.length - 1] === areaId) setLinkFrom(areaId);
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    // 画像配置: ゴースト位置にクリック確定
    if (placingRef.current && ghost) {
      const p = placingRef.current;
      const id = nextId('im');
      engine.addObject({
        id,
        kind: IMG_KIND,
        x: ghost.x,
        y: ghost.y,
        w: p.w,
        h: p.h,
        data: { url: p.url, aspect: p.aspect, lock: p.lock } satisfies ImageData,
      });
      setPlacing(null);
      setGhost(null);
      engine.setSelection([id]);
      return;
    }
    const objEl = (e.target as HTMLElement).closest?.(
      '[data-ki-obj]',
    ) as HTMLElement | null;
    const o = objEl?.dataset.kiObj
      ? engine.doc.objects.find((x) => x.id === objEl.dataset.kiObj)
      : undefined;
    if (linkModeRef.current) {
      if (o?.kind === TEXT_KIND) pickLink(o.id);
      return;
    }
    // ページ枠クリック → アクティブページを切り替える
    if (o?.kind === PAGE_KIND) {
      const idx = pageRects(model.spec, model.pages).findIndex(
        (p) => p.id === o.id,
      );
      if (idx >= 0) setActivePage(idx);
    }
    setSelLink(null);
  };

  // ── 画像取り込みフロー ──
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        setImgDlg({
          url,
          natW: probe.naturalWidth,
          natH: probe.naturalHeight,
          w: +(probe.naturalWidth / MM_PX).toFixed(1),
          h: +(probe.naturalHeight / MM_PX).toFixed(1),
          lock: true,
        });
      };
      probe.src = url;
    };
    reader.readAsDataURL(f);
  };

  const dlgPatch = (patch: Partial<ImgDlg>) =>
    setImgDlg((d) => {
      if (!d) return d;
      const n = { ...d, ...patch };
      const ratio = d.natH / d.natW;
      if (n.lock && 'w' in patch) n.h = +(n.w * ratio).toFixed(1);
      if (n.lock && 'h' in patch) n.w = +(n.h / ratio).toFixed(1);
      if (n.lock && 'lock' in patch) n.h = +(n.w * ratio).toFixed(1);
      return n;
    });

  // ── オブジェクト属性パッチ ──
  const patchObject = (id: string, patch: Partial<WorldObject>) => {
    engine.setDoc({
      ...engine.doc,
      objects: engine.doc.objects.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    });
  };
  const patchAreaData = (id: string, patch: Partial<TextAreaData>) => {
    const o = engine.doc.objects.find((x) => x.id === id);
    if (!o) return;
    patchObject(id, {
      data: { ...DEFAULT_TEXT_DATA, ...(o.data as TextAreaData), ...patch },
    });
  };
  const patchImageData = (id: string, patch: Partial<ImageData>) => {
    const o = engine.doc.objects.find((x) => x.id === id);
    if (!o) return;
    patchObject(id, { data: { ...(o.data as ImageData), ...patch } });
  };

  // ── 連鎖レイアウト（再描画のたびに貪欲配分） ──
  const objById = new Map(engine.doc.objects.map((o) => [o.id, o]));
  const layouts = new Map<string, LayoutResult>();
  for (const c of chains) {
    const boxes = c.areas.flatMap((id) => {
      const o = objById.get(id);
      if (!o) return [];
      const r = liveRect(engine, o);
      const d = { ...DEFAULT_TEXT_DATA, ...(o.data as TextAreaData) };
      return [
        {
          id,
          width: Math.max(0, r.w - 2 * TEXT_PAD_MM),
          height: Math.max(0, r.h - 2 * TEXT_PAD_MM),
          fontSize: d.fontSize,
          fontFamily: d.fontFamily,
        },
      ];
    });
    layouts.set(c.id, layoutChain(c.text, boxes, measurerRef.current));
  }

  // 右ペインの駆動源（選択オブジェクト配列）
  const selObjs = engine.doc.objects.filter((o) =>
    engine.selectedIds.has(o.id),
  );
  const selObj = selObjs.length === 1 ? selObjs[0] : null;
  const selChain = selObj ? (chainOf(chains, selObj.id) ?? null) : null;

  // ── ページナビ: アクティブページ（枠クリック or ナビで切替） ──
  const rects = pageRects(model.spec, model.pages);
  const curPage = Math.min(activePage, Math.max(0, rects.length - 1));
  const goToPage = (i: number) => {
    setActivePage(i);
    const el = canvasRef.current;
    const p = rects[i];
    if (!el || !p) return;
    const pxPerMm =
      engine.worldToScreen({ x: 1, y: 0 }).x -
      engine.worldToScreen({ x: 0, y: 0 }).x;
    engine.viewport = {
      ...engine.viewport,
      x: el.clientWidth / 2 - (p.x + p.w / 2) * pxPerMm,
      y: el.clientHeight / 2 - (p.y + p.h / 2) * pxPerMm,
    };
    engine.panBy(0, 0); // viewport 反映のため emit を起こす
  };

  const { spec } = model;
  const z = engine.viewport.zoom;

  const renderObject = (o: WorldObject) => {
    if (o.kind === PAGE_KIND) {
      const d = o.data as { index: number };
      return (
        <div
          className={d.index === curPage ? 'page-tag active nodrag' : 'page-tag nodrag'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span>
            p.{d.index + 1} — {spec.size}
            {spec.landscape ? '横' : '縦'} {Math.round(o.w)}×{Math.round(o.h)}
            mm
          </span>
          <button
            title="このページの次に挿入"
            onClick={() => insertBelow(d.index)}
          >
            ＋
          </button>
          <button title="このページを削除" onClick={() => removePage(o.id)}>
            ×
          </button>
        </div>
      );
    }
    if (o.kind === TEXT_KIND) {
      const d = { ...DEFAULT_TEXT_DATA, ...(o.data as TextAreaData) };
      const c = chainOf(chains, o.id);
      const lr = c ? layouts.get(c.id) : undefined;
      const slice = lr?.slices.find((s) => s.areaId === o.id)?.text ?? '';
      const isLast = c ? c.areas[c.areas.length - 1] === o.id : false;
      const overflow = isLast ? (lr?.overflow ?? '') : '';
      return (
        <div
          className={`ta${linkFrom === o.id ? ' link-from' : ''}`}
          style={{
            padding: TEXT_PAD_MM * MM_PX * z,
            fontSize: d.fontSize * MM_PX * z,
            lineHeight: LINE_HEIGHT,
            fontFamily: d.fontFamily,
            color: d.color,
          }}
        >
          <div className="ta-slice">{slice}</div>
          {overflow.length > 0 && (
            <div
              className="oflabel nodrag"
              title="あふれ — クリックで連鎖テキストを開く"
              onClick={(e) => {
                e.stopPropagation();
                engine.setSelection([o.id]);
              }}
            >
              あふれ {overflow.length}字 「
              {overflow.replace(/\n/g, '⏎').slice(0, 14)}…」
            </div>
          )}
        </div>
      );
    }
    if (o.kind === IMG_KIND) {
      const d = o.data as ImageData;
      return <img className="img-fill" src={d.url} draggable={false} alt="" />;
    }
    if (o.kind === 'rect') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            background: o.style?.fill,
            border: `${o.style?.width ?? 1}px solid ${o.style?.stroke ?? 'transparent'}`,
          }}
        />
      );
    }
    return undefined;
  };

  const onTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('silim-theme', t);
  };

  return (
    <div className="app" data-theme={theme}>
      <div className="body">
        <MenuPane
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onNew={newDoc}
          onOpen={() => openFileRef.current?.click()}
          onSave={() => setSaveDlg(docTitle || 'document')}
          onUndo={undo}
          onRedo={redo}
          canUndo={histRef.current.past.length > 0}
          canRedo={histRef.current.future.length > 0}
          rulerOn={rulerOn}
          onRuler={() => setRulerOn((v) => !v)}
          linkMode={linkMode}
          onLinkMode={() => {
            setLinkMode((m) => !m);
            setLinkFrom(null);
          }}
          shapeTool={shapeTool}
          onShapeTool={setShapeTool}
          onImage={() => fileRef.current?.click()}
          onAddPage={appendPage}
          onDeletePage={removeCurrentPage}
          onPrint={() => setPrinting(true)}
          theme={theme}
          onTheme={onTheme}
        />
        <div
          ref={canvasRef}
          className={linkMode ? 'canvas-wrap link-mode' : 'canvas-wrap'}
          onClick={onCanvasClick}
          onDoubleClick={onDblClick}
          onPointerDown={(e) => {
            // 中ボタンドラッグの既定動作（オートスクロール）を抑止し、
            // kimetron のパン操作だけにする
            if (e.button === 1) e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (!placingRef.current) return;
            const r = canvasRef.current!.getBoundingClientRect();
            const w = engine.screenToWorld({
              x: e.clientX - r.left,
              y: e.clientY - r.top,
            });
            const gs = engine.doc.grid.size || 5;
            setGhost({
              x: Math.round(w.x / gs) * gs,
              y: Math.round(w.y / gs) * gs,
            });
          }}
          onPointerUp={() => {
            // アスペクト比ロック画像 → リサイズ確定時に補正
            let fix = false;
            const objects = engine.doc.objects.map((o) => {
              if (
                o.kind === IMG_KIND &&
                engine.selectedIds.has(o.id) &&
                (o.data as ImageData).lock
              ) {
                const d = o.data as ImageData;
                const h = o.w * d.aspect;
                if (Math.abs(o.h - h) > 0.05) {
                  fix = true;
                  return { ...o, h };
                }
              }
              return o;
            });
            if (fix) engine.setDoc({ ...engine.doc, objects });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (placingRef.current) {
              setPlacing(null);
              setGhost(null);
              return;
            }
            // ワイヤー右クリック → 切断メニュー
            const g = (e.target as Element).closest?.(
              'g[data-link]',
            ) as SVGGElement | null;
            if (g?.dataset.link) {
              const [chainId, idx] = g.dataset.link.split(':');
              const wire = { chainId, index: +idx };
              setSelLink(wire);
              setCtxMenu({ x: e.clientX, y: e.clientY, wire });
              return;
            }
            const objEl = (e.target as HTMLElement).closest?.(
              '[data-ki-obj]',
            ) as HTMLElement | null;
            const id = objEl?.dataset.kiObj;
            const o = id
              ? engine.doc.objects.find(
                  (x) => x.id === id && x.kind !== PAGE_KIND,
                )
              : undefined;
            if (!o) return;
            if (!engine.selectedIds.has(o.id)) engine.setSelection([o.id]);
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <IsleCanvas
            engine={engine}
            style={{ position: 'absolute', inset: 0 }}
            renderObject={renderObject}
          />
          <LinkWires
            engine={engine}
            chains={chains}
            selLink={selLink}
            onPick={setSelLink}
          />
          {shapeTool && (
            <div
              className="shape-overlay"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;
                setShapeDrag({ x0: x, y0: y, x1: x, y1: y });
              }}
              onPointerMove={(e) => {
                if (!shapeDrag) return;
                const r = e.currentTarget.getBoundingClientRect();
                setShapeDrag({
                  ...shapeDrag,
                  x1: e.clientX - r.left,
                  y1: e.clientY - r.top,
                });
              }}
              onPointerUp={() => {
                if (!shapeDrag) return;
                const a = engine.screenToWorld({
                  x: shapeDrag.x0,
                  y: shapeDrag.y0,
                });
                const b = engine.screenToWorld({
                  x: shapeDrag.x1,
                  y: shapeDrag.y1,
                });
                const gs = engine.doc.grid.size || 5;
                const sn = (v: number) => Math.round(v / gs) * gs;
                const x = sn(Math.min(a.x, b.x));
                const y = sn(Math.min(a.y, b.y));
                const w = Math.max(1, sn(Math.abs(a.x - b.x)));
                const h = Math.max(
                  shapeTool === 'line' ? 1 : gs,
                  sn(Math.abs(a.y - b.y)),
                );
                const id = nextId('sh');
                const obj: WorldObject =
                  shapeTool === 'rect'
                    ? {
                        id,
                        kind: 'rect',
                        x,
                        y,
                        w,
                        h,
                        style: {
                          fill: 'rgba(58,123,213,0.12)',
                          stroke: '#3a7bd5',
                          width: MM_PX * 0.5,
                        },
                        data: {},
                      }
                    : shapeTool === 'ellipse'
                      ? {
                          id,
                          kind: 'ellipse',
                          x,
                          y,
                          w,
                          h,
                          style: {
                            fill: 'rgba(58,123,213,0.10)',
                            stroke: '#3a7bd5',
                            width: MM_PX * 0.5,
                          },
                          data: {},
                        }
                      : {
                          id,
                          kind: 'line',
                          x,
                          y,
                          w,
                          h,
                          shape: {
                            points:
                              a.y <= b.y
                                ? [
                                    { fx: 0, fy: 0 },
                                    { fx: 1, fy: 1 },
                                  ]
                                : [
                                    { fx: 0, fy: 1 },
                                    { fx: 1, fy: 0 },
                                  ],
                          },
                          style: { stroke: '#333333', width: MM_PX * 0.5 },
                          data: {},
                        };
                engine.addObject(obj);
                engine.setSelection([id]);
                setShapeDrag(null);
                setShapeTool(null);
              }}
            />
          )}
          {shapeDrag && (
            <div
              className="shape-preview"
              style={{
                left: Math.min(shapeDrag.x0, shapeDrag.x1),
                top: Math.min(shapeDrag.y0, shapeDrag.y1),
                width: Math.abs(shapeDrag.x1 - shapeDrag.x0),
                height: Math.abs(shapeDrag.y1 - shapeDrag.y0),
              }}
            />
          )}
          {rulerOn && rects[curPage] && (
            <Rulers
              engine={engine}
              page={rects[curPage]}
              cursor={engine.cursorWorld}
            />
          )}
          <PageNav
            current={curPage}
            total={rects.length}
            collapsed={navCollapsed}
            onToggle={() => setNavCollapsed((v) => !v)}
            onGo={goToPage}
          />
          {placing && ghost && (
            <div
              className="img-ghost"
              style={{
                left: engine.worldToScreen(ghost).x,
                top: engine.worldToScreen(ghost).y,
                width: placing.w * MM_PX * z,
                height: placing.h * MM_PX * z,
              }}
            >
              <img src={placing.url} draggable={false} alt="" />
            </div>
          )}
        </div>
        <RightDock
          selObjs={selObjs}
          chain={selChain}
          chainOverflow={
            selChain ? (layouts.get(selChain.id)?.overflow ?? '') : ''
          }
          onChainText={(text) =>
            setChains((cs) =>
              cs.map((c) => (c.id === selChain!.id ? { ...c, text } : c)),
            )
          }
          onAreaData={(patch) => selObj && patchAreaData(selObj.id, patch)}
          onAreaDataAll={(patch) =>
            selObjs
              .filter((o) => o.kind === TEXT_KIND)
              .forEach((o) => patchAreaData(o.id, patch))
          }
          onRect={(r) => selObj && patchObject(selObj.id, r)}
          onImageData={(patch) => selObj && patchImageData(selObj.id, patch)}
          onStyle={(patch) =>
            selObjs.forEach((o) =>
              patchObject(o.id, { style: { ...o.style, ...patch } }),
            )
          }
          onReorder={(op) => engine.reorderSelected(op)}
          onDeselect={() => engine.setSelection([])}
          onAddArea={() => {
            if (!selObj || !selChain) return;
            const id = nextId('ta');
            const i = selChain.areas.indexOf(selObj.id);
            engine.addObject({
              id,
              kind: TEXT_KIND,
              x: selObj.x,
              y: selObj.y + selObj.h + 5,
              w: selObj.w,
              h: selObj.h,
              style: selObj.style ? { ...selObj.style } : undefined,
              data: selObj.data ? { ...selObj.data } : { ...DEFAULT_TEXT_DATA },
            });
            setChains((cs) =>
              cs.map((c) =>
                c.id === selChain.id
                  ? {
                      ...c,
                      areas: [
                        ...c.areas.slice(0, i + 1),
                        id,
                        ...c.areas.slice(i + 1),
                      ],
                    }
                  : c,
              ),
            );
            engine.setSelection([id]);
          }}
          docProps={{
            title: docTitle,
            onTitle: setDocTitle,
            size: spec.size,
            landscape: spec.landscape,
            pageCount: model.pages.length,
            footer,
            onSize: setSize,
            onLandscape: toggleLandscape,
            onAddPage: appendPage,
            onInsertAfter: insertAt,
            onFooter: setFooter,
          }}
        />
      </div>
      <footer className="status">
        <span className="hint">
          {hint ||
            '用紙上ダブルクリック=エリア / 線選択→Del=切断 / 右クリック=Z-order'}
        </span>
        <span className="sep" />
        <span>{model.pages.length}ページ</span>
        <span>scale {engine.scaleText()}</span>
        <span>
          ({formatLength(engine.cursorWorld.x, 'mm')},{' '}
          {formatLength(engine.cursorWorld.y, 'mm')})
        </span>
      </footer>

      {/* 印刷展開オーバーレイ */}
      {printing && (
        <Printout
          model={model}
          footer={footer}
          objects={engine.doc.objects}
          sliceText={(o) => {
            const c = chainOf(chains, o.id);
            if (!c) return '';
            const lr = layouts.get(c.id);
            return lr?.slices.find((s) => s.areaId === o.id)?.text ?? '';
          }}
          onPrint={() => window.print()}
          onClose={() => setPrinting(false)}
        />
      )}

      {/* 画像取り込みダイアログ */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onPickFile}
      />
      <input
        ref={openFileRef}
        type="file"
        accept=".slm"
        style={{ display: 'none' }}
        onChange={onOpenFile}
      />
      {imgDlg && (
        <div className="dlg-backdrop">
          <div className="dlg">
            <img className="img-prev" src={imgDlg.url} alt="preview" />
            <div className="row">
              幅{' '}
              <input
                type="number"
                step="0.1"
                value={imgDlg.w}
                onChange={(e) => dlgPatch({ w: +e.currentTarget.value })}
              />{' '}
              mm 高さ{' '}
              <input
                type="number"
                step="0.1"
                value={imgDlg.h}
                onChange={(e) => dlgPatch({ h: +e.currentTarget.value })}
              />{' '}
              mm
            </div>
            <div className="row">
              <label>
                <input
                  type="checkbox"
                  checked={imgDlg.lock}
                  onChange={(e) => dlgPatch({ lock: e.currentTarget.checked })}
                />
                アスペクト比をロック
              </label>
            </div>
            <div className="btns">
              <button
                onClick={() => {
                  setPlacing({
                    url: imgDlg.url,
                    w: imgDlg.w,
                    h: imgDlg.h,
                    aspect: imgDlg.h / imgDlg.w,
                    lock: imgDlg.lock,
                  });
                  setImgDlg(null);
                }}
              >
                配置
              </button>
              <button onClick={() => setImgDlg(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 右クリック: Z-order メニュー */}
      {ctxMenu && (
        <div
          className="ctx-backdrop"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        >
          <div
            className="ctx-menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {ctxMenu.wire ? (
              <button
                onClick={() => {
                  setChains((cs) =>
                    unlinkAt(cs, ctxMenu.wire!.chainId, ctxMenu.wire!.index, nextId('c')),
                  );
                  setSelLink(null);
                  setCtxMenu(null);
                }}
              >
                切断
              </button>
            ) : (
              <>
            <button
              onClick={() => {
                engine.reorderSelected('front');
                setCtxMenu(null);
              }}
            >
              最前面へ
            </button>
            <button
              onClick={() => {
                engine.reorderSelected('forward');
                setCtxMenu(null);
              }}
            >
              一つ上へ
            </button>
            <button
              onClick={() => {
                engine.reorderSelected('backward');
                setCtxMenu(null);
              }}
            >
              一つ下へ
            </button>
            <button
              onClick={() => {
                engine.reorderSelected('back');
                setCtxMenu(null);
              }}
            >
              最背面へ
            </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 名前を付けて保存ダイアログ */}
      {saveDlg !== null && (
        <div className="dlg-backdrop">
          <div className="dlg">
            <div className="row">
              <label>
                ファイル名{' '}
                <input
                  type="text"
                  value={saveDlg}
                  style={{ width: '180px' }}
                  autoFocus
                  onChange={(e) => setSaveDlg(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmSave(saveDlg);
                  }}
                />
                .slm
              </label>
            </div>
            <div className="btns">
              <button onClick={() => confirmSave(saveDlg)}>保存</button>
              <button onClick={() => setSaveDlg(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
