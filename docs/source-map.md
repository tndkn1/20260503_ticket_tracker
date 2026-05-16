# ソースコード一覧

## プロジェクトルート

| ファイル | 概要 |
|---|---|
| `next.config.ts` | Next.js 設定ファイル |
| `tsconfig.json` | TypeScript コンパイラ設定 |
| `eslint.config.mjs` | ESLint 設定 |
| `postcss.config.mjs` | PostCSS 設定（Tailwind CSS ビルド用） |
| `components.json` | shadcn UI コンポーネント設定 |
| `vercel.json` | Vercel デプロイ設定 |
| `package.json` | 依存関係・スクリプト定義 |

---

## `src/app/` — ページ・API ルート（Next.js App Router）

### ページ

| ファイル | 概要 |
|---|---|
| `layout.tsx` | アプリ全体のルートレイアウト。フォント・Toaster・Vercel Analytics / Speed Insights を配置 |
| `page.tsx` | ダッシュボード（インシデント一覧）画面。統計カード・フィルタ・一覧テーブル・起票ダイアログを含む |
| `globals.css` | グローバル CSS（Tailwind CSS・shadcn テーマ変数） |
| `login/page.tsx` | ログイン画面。パスワード認証・GitHub OAuth ログインボタンを提供 |
| `incidents/[id]/page.tsx` | インシデント詳細・更新画面。ステータス変更・優先度変更・担当者変更・タイムライン表示 |
| `admin/page.tsx` | 管理画面（admin ロール専用）。ユーザー一覧・新規ユーザー追加フォーム |

### API ルート — 認証

| ファイル | 概要 |
|---|---|
| `api/auth/login/route.ts` | `POST` パスワード認証。JWT セッション Cookie を発行 |
| `api/auth/logout/route.ts` | `POST` ログアウト。セッション Cookie を削除 |
| `api/auth/me/route.ts` | `GET` ログインユーザー情報（id / username / email / role）を返す |
| `api/auth/github/route.ts` | `GET` GitHub OAuth 認証を開始。JWT 署名付き state を生成してリダイレクト |
| `api/auth/github/callback/route.ts` | `GET` GitHub OAuth コールバック。state 検証・ユーザー照合・自動登録・セッション発行 |

### API ルート — インシデント

| ファイル | 概要 |
|---|---|
| `api/incidents/route.ts` | `GET` インシデント一覧取得（フィルタ・削除済み表示対応）/ `POST` インシデント起票 / `DELETE` 一括論理削除（admin 専用） |
| `api/incidents/[id]/route.ts` | `GET` インシデント詳細・監査ログ取得 / `PATCH` インシデント更新（ステータス・優先度・担当者・タイトル・コメント） |

### API ルート — その他

| ファイル | 概要 |
|---|---|
| `api/stats/route.ts` | `GET` ダッシュボード統計情報（総件数・未解決・SLA 違反・平均解決時間）を返す |
| `api/sla-check/route.ts` | `POST` SLA 違反チェック（定期実行用）。違反フラグ更新・Slack アラート送信 |
| `api/admin/users/route.ts` | `GET` ユーザー一覧取得 / `POST` ユーザー新規作成（admin 専用） |

---

## `src/middleware.ts`

| ファイル | 概要 |
|---|---|
| `middleware.ts` | 全ルートの認証ガード。JWT セッション検証・未認証時のリダイレクト・`x-user-id` / `x-username` / `x-user-role` ヘッダー付与 |

---

## `src/components/` — UI コンポーネント

### インシデント関連

| ファイル | 概要 |
|---|---|
| `incidents/incident-table.tsx` | インシデント一覧テーブル。チェックボックス選択・削除済み行の視覚化・行クリックで詳細遷移 |
| `incidents/create-dialog.tsx` | インシデント起票ダイアログ。タイトル・説明・優先度・担当者（ログインユーザーをデフォルト設定） |

### 共通コンポーネント

| ファイル | 概要 |
|---|---|
| `priority-badge.tsx` | 優先度バッジ（P1〜P4 を色分け表示） |
| `status-badge.tsx` | ステータスバッジ（new / assigned / in_progress / resolved / closed） |
| `sla-badge.tsx` | SLA 残り時間バッジ。残り時間・警告・違反を色分け表示（応答・解決の 2 種類） |
| `stat-card.tsx` | ダッシュボード統計カード |
| `user-menu.tsx` | ヘッダーのユーザーメニュー。ユーザー名・ロール表示・ログアウトボタン |

### shadcn UI プリミティブ（`ui/`）

| ファイル | 概要 |
|---|---|
| `ui/badge.tsx` | バッジコンポーネント |
| `ui/button.tsx` | ボタンコンポーネント |
| `ui/card.tsx` | カードコンポーネント |
| `ui/checkbox.tsx` | チェックボックスコンポーネント |
| `ui/dialog.tsx` | モーダルダイアログコンポーネント |
| `ui/input.tsx` | テキスト入力コンポーネント |
| `ui/label.tsx` | ラベルコンポーネント |
| `ui/select.tsx` | セレクトボックスコンポーネント |
| `ui/separator.tsx` | 区切り線コンポーネント |
| `ui/sonner.tsx` | トースト通知コンポーネント（Sonner） |
| `ui/switch.tsx` | トグルスイッチコンポーネント |
| `ui/table.tsx` | テーブルコンポーネント |
| `ui/textarea.tsx` | テキストエリアコンポーネント |

---

## `src/db/` — データベース

| ファイル | 概要 |
|---|---|
| `schema.ts` | Drizzle ORM スキーマ定義（incidents / audit_log / sla_config / users / sequences テーブル） |
| `index.ts` | DB 接続の取得。`TURSO_DATABASE_URL` が設定されていれば Turso、なければ SQLite を使用 |
| `migrate.ts` | ローカル SQLite 用マイグレーションスクリプト |
| `migrate-turso.ts` | Turso（本番）用マイグレーションスクリプト |
| `seed-user.ts` | 初期ユーザー作成スクリプト（CLI から実行） |

---

## `src/lib/` — ユーティリティ

| ファイル | 概要 |
|---|---|
| `auth.ts` | JWT セッション発行・検証・PBKDF2 パスワードハッシュ・定数時間比較 |
| `id.ts` | インシデント ID 生成（`INC-0001` 形式） |
| `sla.ts` | SLA 期限計算・残り時間フォーマット・状態判定 |
| `slack.ts` | Slack Webhook 通知（インシデント起票・ステータス変更・SLA 違反） |
| `utils.ts` | Tailwind クラス結合ユーティリティ（`cn` 関数） |

---

## `docs/`

| ファイル | 概要 |
|---|---|
| `requirements.md` | システム要件定義書（機能要件・非機能要件・DB 設計・API 一覧） |
| `source-map.md` | 本ファイル。ソースコード一覧と概要 |
