# Changelog

## [Unreleased]

## [0.6.0] - 2026-10-28

### English

Multi-selection workflow completion (duplicate / grouping) plus
multi-point curve input. kimetron updated to 1.6.0 (B6 stroke-scaled
caps, P49 multi-point draw, resizeAspect hook).

- Duplicate / copy & paste (F25): Ctrl+D, Ctrl+C/V. Shapes, images and
  text areas are copied one grid step over and the copies get selected.
  Copied text areas become standalone single-area chains — links are
  not carried over, but font settings and the source chain's full text
  are (overflow shows honestly). A multi-selection duplicates
  everything; copied group members are re-keyed to a new group.
- Shape grouping (F26): uses kimetron's `group` field. The context
  menu gains Group/Ungroup. One click on a member selects the whole
  group; clicking again dives to the member (click-through); Alt+drag
  detaches a member, per kimetron.
- Multi-point curve input (F27): the "~" tool is now click-chained
  vertex input (kimetron P49 `startShapeDraw` / `'shape'` mode).
  Points snap to the grid with a dashed preview; Enter/double-click
  commits, Esc cancels. The result is immediately editable via the
  vertex grips (`.ki-vtx`).
- Rect/ellipse border ON/OFF (F28): a "Border" checkbox in the
  properties. OFF writes an explicit `stroke:'transparent'` (distinct
  from width 0).
- Align & distribute (F29): eight buttons in the inspector for
  multi-selections — left/center/right, top/middle/bottom, and
  horizontal/vertical equal spacing.
- Text area alignment: standalone (unchained) areas get horizontal
  (left/center/right) and vertical (top/middle/bottom) alignment.
  Chained areas stay anchored top-left.
- Fix (B6): thick-line caps (arrows/dots) were buried by the stroke.
  kimetron 1.6.0 scales cap markers with stroke width (`userSpaceOnUse`
  + `viewBox`); the print output scales them the same way.
- Image resize: aspect-lock moved to kimetron's `resizeAspect` hook,
  constraining corner drags live (post-commit correction kept for edge
  drags).

### 日本語

複製・グルーピング（複数選択ワークフローの完成）＋ 曲線の多点入力。
kimetron は 1.6.0 へ更新（B6 端子スケール・P49 多点入力・resizeAspect
フックを取り込み）。

- 複製/コピー＆ペースト（F25）: Ctrl+D・Ctrl+C/V。シェイプ・画像・
  テキストエリアをグリッド1段ずらして複製し複製物を選択。
  テキストエリアはリンクを引き継がず単独エリアの新連鎖となり、
  フォント等の設定と元連鎖の全文を引き継ぐ（収まらない分はあふれ
  表示）。複数選択は全選択を複製。グループは複製時に新規グループへ
  振り直し
- 図形のグルーピング（F26）: kimetron の `group` フィールドで束を
  識別。右クリックメニューに「グループ化/解除」。グループ内1点
  クリックで全体選択、全選択済みなら個別へ潜る（クリックスルー）、
  Alt+drag で個別脱出は kimetron 準拠
- 曲線の多点入力（F27）: 「〜」ツールがクリック連打による頂点入力に
  刷新（kimetron P49 の `startShapeDraw` / `'shape'` mode を利用）。
  点はグリッドにスナップし破線プレビュー、Enter/ダブルクリックで
  確定、Esc で取消。確定後はそのまま頂点グリップ（.ki-vtx）で編集可
- 矩形・楕円の枠線 ON/OFF（F28）: プロパティに「枠線」チェック。
  OFF は `stroke:'transparent'` の明示的消去（線幅0とは別扱い）
- 整列・分布（F29）: 複数選択時にプロパティペインへ
  左/中央/右揃え・上/中央/下揃え・縦横等間隔の8ボタン
- テキストエリアの揃え: 単独（非連鎖）エリアに横揃え（左/中央/右）と
  縦揃え（上/中央/下）。リンク連鎖のエリアは左上起点固定のまま
- 修正（B6）: 太い線の端子（矢印・●）が線幅に埋もれる。
  kimetron 1.6.0 で cap マーカーを線幅スケール化（viewBox 付き
  userSpaceOnUse）、印刷出力側も同率で拡大
- 画像リサイズ: アスペクト比ロックは kimetron の `resizeAspect`
  フックへ移行し、角ドラッグでライブ拘束（確定時補正は辺ドラッグ
  用に残置）

## [0.5.0] - 2026-10-27

シェイプ頂点編集のエンジン化（kimetron 1.5.0）と曲線ツール。

- 曲線ツール（〜）: ドラッグで浅い弧を配置し、頂点グリップで
  形を整える最小実装（連続クリックによる多点入力は未実装 —
  kimetron P49 予定）。印刷も Catmull-Rom 展開で対応
- 頂点グリップ（F21）を kimetron 側の頂点編集機構へ移行
  （P48 — `.ki-vtx` ハンドル＋`vertex` mode）。グリップの
  ダブルクリックで頂点削除、選択中の曲線/多角形の線上を
  ダブルクリックで頂点追加ができるようになった。
  アプリ側の独自オーバーレイ（Grips.tsx）は廃止
- 修正: 直線・曲線のプロパティに塗り色欄が出ていた
  （開いた chord なので fill は常に none — 誤解を招くため非表示化）
- kimetron submodule を v1.5.0 へ更新

## [0.4.0] - 2026-10-27

溜まった不具合の一掃と編集力の拡充（v0.4.0-plan.md の B1–B5・F21–F24）。
kimetron は 1.4.1 へ更新（枠幅・shape svg の修正を取り込み）。

- グリップ（頂点編集）: 単一選択の line/curve/polygon の
  アンカー点に □ グリップを表示し、ドラッグで頂点を直接編集。
  全頂点で bbox を再正規化（退縮辺は中点へ畳み込み）、
  グリッドスナップ・回転オブジェクト・Undo に対応
- 線の端子・線種: 直線/曲線に 始点/終点（なし/矢印/●）と
  線種（実線/破線/点線）を追加。キャンバスは kimetron の
  cap/dash 描画をそのまま使用、印刷は mm viewBox で
  マーカー・破線を実寸再現（線幅の印刷換算も修正）
- テキスト属性の拡充: 太字・斜体・下線・文字色を TextAreaData
  に追加し、計測・描画・印刷・一括編集のすべてに反映
- スナップ一時解除: Alt 押下中はグリッド/オブジェクト吸着を
  無効化（ドラッグ・リサイズ・回転・グリップ編集に共通適用）
- 直線ツール: 水平/垂直方向に引いた線は対角 chord ではなく
  辺中央アンカーの真っ直ぐな線として生成（sethera 準拠）。
  ドラッグ始点を chord の先頭点として保持
- 変更: 用紙の透過の既定値を 100% → 50%
  （新規作成時も同値。書庫は保存値を復元）
- 修正: シェイプの塗り色とプロパティ表示の不一致。
  rgba/#rrggbbaa のアルファを無視して表示・不透明色で上書きしていた。
  各色に不透明度（%）欄を追加し、色変更時はアルファを維持する
  （初期 fill を #rrggbbaa 形式へ統一）
- 修正: 水平・垂直の直線が消える不具合。リサイズで幅/高さが
  0 近辺（最小 0.001mm）になると、shape 用 <svg> 要素が
  0 サイズとなり要素ごと描画が無効化されていた
  （overflow:visible では救済不可）。kimetron 側で svg
  ビューポートに 1px 下限を設け、印刷出力にも 0.1mm 下限を適用
- 修正: 線幅 0 でも枠線が残る不具合。kimetron 1.4.1 で
  .ki-obj の枠幅を style.width 由来に変更して根本解消、
  アプリ側暫定 CSS を撤去（rect はネイティブ描画へ委譲）
- 修正: 単一テキストエリア選択時に太字・斜体・下線・文字色を
  変更できない不具合。連鎖ペインに B/I/U・文字色の
  コントロールを追加（従来は複数選択時のみ設定可能だった）
- 修正: テキストエリアの塗りが下のシェイプを隠す不具合。
  既定 fill を撤去し透明に変更

## [0.3.0] - 2026-10-27

視認性・ナビゲーションの自動化・多言語化（v0.3.0-plan.md の G1–G5）。

- ページフィット＆左上合わせ: ページ全体が収まる倍率に自動ズームし、
  ページ左上（ルーラー原点）をキャンバス左上へ。ナビ/新規/開く時に適用、
  メニューの「枠 ページを全体表示」ボタンで手動実行も可能
- ルーラー改良: ページ枠の上辺・左辺に沿う帯へ移動、
  5mm グリッド整合の刻み
- 用紙の透過設定: 文書プロパティにスライダー（0–100%）。
  0% でフレームのみ。書庫・Undo/Redo 履歴に含まれる
- プロパティペイン折りたたみ: 右ペインを右方向へ最小化
- 英語対応: メニュー最上段の「Aa」ボタンで ja/en 切替
  （localStorage 永続化）。メニュー・ペイン・ダイアログ・
  ヒント・ステータス・ページタグ・バッジを全翻訳。
  アイコンは EN 時に英字/記号へ切替
- 起動時のデモデータを撤去（空ドキュメントで起動）
- GitHub Pages 用ワークフロー追加（現時点では手動実行のみ）

## [0.2.0] - 2026-10-27

制作実務の精度と回復力（v0.2.0-plan.md の F14–F18・F20）。

- ルーラー: アクティブページ枠の上辺・左辺に沿う mm 目盛り。
  ページと一緒にパン/ズーム追従、5mm グリッド整合の刻み、
  カーソル位置マーカー、ON/OFF 切替
- 名前を付けて保存: ファイル名入力ダイアログ（既定は文書タイトル）。
  文書プロパティにタイトル欄、書庫に title/createdAt/updatedAt
  メタ情報を格納・復元
- Undo/Redo: doc＋連鎖＋ページ＋設定の統合スナップショット履歴。
  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y、メニューボタン、
  500ms 連続編集を1エントリに畳む・100件上限
- 連鎖途中挿入: 「このエリアの後に連鎖エリアを追加」で
  選択エリアの直後に中間挿入
- ワイヤー右クリック切断（Del 以外の切断経路）
- 画像リサイズのアスペクト比拘束（ロック ON 時、確定時に補正）
- ショートカット: Ctrl+S 名前を付けて保存、
  `beforeunload` 未保存警告
- 修正: 中ボタンパンでオートスクロールが発火し画面全体が
  動いてしまう不具合（ドキュメント scroll 禁止＋中ボタン既定動作抑止）
- 修正: 新規エリアの ID がデモ/読込オブジェクトと衝突する不具合
  （既存 ID を走査して空きを採番）

## [0.1.0] - 2026-10-27

初回リリース。「方眼紙に実寸で置いていく、ページ跨ぎ文字送りつきの
印刷物ファーストなページレイアウトエディタ」の歩く骨格
（v0.1.0-plan.md の F1–F13）。

- ページモデル: A4/A3 × 縦横、ワールド mm 座標で縦並び。
  追加・任意位置挿入・削除（枠のみ）、用紙差替えでオブジェクト座標不変
- アクティブページ: ページ枠クリックで選択。ナビ・削除・強調が連動
- テキスト連鎖: 表示専用エリア＋貪欲配分、あふれバッジ、
  線形一方通行リンク（末尾→先頭）、巻き戻し切断、連鎖編集ペイン
- 画像: ファイル選択→実寸ゴースト→クリック確定。mm編集・アスペクト比
  ロック・Z-order（右クリックメニュー）
- シェイプ: 矩形・楕円・直線（ドラッグ配置・mm線幅・一括編集）
- 実寸印刷: 同一ドキュメント内オーバーレイ＋beforeprint 対応、
  `@page` 動的設定、ページ番号フッター（ON/OFF可）
- 書庫: 独自 .slm 形式（zip: doc.json＋画像バイナリ）。新規/開く/保存
- 画面構成: 左メニュー（折りたたみ）＋キャンバス＋右プロパティの3ペイン、
  ページナビ（フローティング・折りたたみ可）、ステータスバー
- テーマ: 標準（OS連動）/ ライト / ダーク / クワイエット
- グリッド: 5mm 方眼紙＋10mm 主線、5mm スナップ
