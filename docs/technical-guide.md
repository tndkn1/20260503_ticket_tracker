# 技術ガイド

このドキュメントは、現在の実装に基づく開発者向けガイドです。

## アーキテクチャ

- App Router の `src/app` 配下に画面と Route Handlers を配置している。
- UI は主に Client Component で実装している。
- API は `src/app/api/**/route.ts` に集約している。
- DB アクセスは `src/db/index.ts` の `getDb()` 経由で行う。
- `TURSO_DATABASE_URL` がある場合は Turso/libSQL、ない場合はローカル SQLite を使用する。

## 主要ディレクトリ

| パス | 内容 |
|---|---|
| `src/app/page.tsx` | KPI とインシデント一覧 |
| `src/app/login/page.tsx` | ログイン画面 |
| `src/app/incidents/[id]/page.tsx` | 詳細・更新画面 |
| `src/app/api` | 認証、インシデント、統計、SLA API |
| `src/components` | UI とインシデント関連コンポーネント |
| `src/db` | Drizzle スキーマ、マイグレーション、seed |
| `src/lib` | 認証、ID、SLA、Slack、汎用ユーティリティ |
| `migrations` | 手動 SQL マイグレーション履歴 |

## 認証

### セッション

`src/lib/auth.ts` が JWT の署名、検証、Cookie オプション、PBKDF2 ハッシュを提供する。

- Cookie 名: `itsm_session`
- 有効期限: 8 時間
- Cookie 属性: HttpOnly / SameSite=Lax / 本番 Secure
- JWT payload: `userId`、`username`、`email`、`role`

### パスワードログイン

`POST /api/auth/login`

1. `username` と `password` を受け取る。
2. `users.username` でユーザーを検索する。
3. `password_hash` と入力パスワードを PBKDF2 で検証する。
4. 成功時に JWT Cookie をセットしてユーザー情報を返す。

### GitHub OAuth

`GET /api/auth/github`

- `from` クエリを JWT 署名付き `state` に入れる。
- `scope=read:user user:email` で GitHub 認可画面へリダイレクトする。
- `GITHUB_CLIENT_ID` 未設定時は 503 を返す。

`GET /api/auth/github/callback`

- `state` の署名と期限を検証する。
- `code` をアクセストークンへ交換する。
- GitHub user API と email API からユーザー情報を取得する。
- `github_id`、次に `email` で既存ユーザーを検索する。
- 既存ユーザーに `github_id` がなければリンクする。
- 存在しなければ `member` ロールで自動作成する。
- 成功時は `from` へリダイレクトする。

### ルート保護

`src/middleware.ts` が保護を担当する。

公開パス:

- `/login`
- `/api/auth/login`
- `/api/auth/github`
- `/api/auth/github/callback`
- `/_next`
- `/favicon`

それ以外は JWT を検証し、未認証なら `/login?from=<pathname>` へリダイレクトする。認証済みリクエストには `x-user-id`、`x-username`、`x-user-role` をレスポンスヘッダーとして付与する。

## データアクセス

`getDb()` は環境変数で接続先を切り替える。

```ts
if (process.env.TURSO_DATABASE_URL) {
  // Turso/libSQL
} else {
  // better-sqlite3: DB_PATH or data/itsm.db
}
```

ローカルマイグレーションは `src/db/migrate.ts`、Turso マイグレーションは `src/db/migrate-turso.ts` が担当する。どちらも `deleted_at` 追加済みスキーマに対応している。

## インシデント API

### `GET /api/incidents`

クエリ:

| 名前 | 内容 |
|---|---|
| `status` | 一致するステータスのみ |
| `priority` | 一致する優先度のみ |
| `q` | タイトル、説明、起票者を部分一致検索 |
| `includeDeleted=true` | admin の場合のみ削除済みだけを返す |

実装上、まず削除済み条件で DB 取得し、その後 `status`、`priority`、`q` をメモリ上でフィルタする。

### `POST /api/incidents`

必須:

- `title`
- `description`

任意:

- `priority`。未指定時 `p3`
- `assignee`

処理:

1. `x-username` から起票者を決定する。
2. `sequences.name = incident` を更新し、`INC-0001` 形式の ID を作る。
3. `computeSlaDeadlines()` で期限を計算する。
4. `incidents` に作成する。
5. `audit_log` に `status = new` の起票ログを入れる。
6. Slack 起票通知を送る。

### `DELETE /api/incidents`

- `getSession()` でセッションを読み、`admin` 以外は 403。
- body は `{ "ids": ["INC-0001"] }`。
- 対象ごとに `deleted_at` と `updated_at` を更新する。
- `audit_log` に `field = deleted_at` を記録する。

### `GET /api/incidents/[id]`

レスポンス:

```json
{
  "incident": {},
  "log": []
}
```

監査ログは API では昇順で返し、画面側で反転して新しい順に表示する。

### `PATCH /api/incidents/[id]`

必須:

- `actor`

更新対象:

- `status`
- `priority`
- `assignee`
- `title`
- `description`
- `comment`

変更があったフィールドごとに監査ログを作成する。コメントがあり、他フィールド変更がない場合は `field = comment` としてコメントのみ記録する。

自動処理:

- `new` から別ステータスへ初回遷移した場合、`responded_at` を設定する。
- `resolved` または `closed` へ初回遷移した場合、`resolved_at` を設定する。
- その時点で期限超過していれば SLA 違反フラグを立てる。
- ステータス変更時のみ Slack 通知を送る。

注意:

- サーバー側ではステータス遷移の妥当性を強制していない。
- クイック遷移の制御は UI 上の補助である。

## SLA

`src/lib/sla.ts` に SLA のデフォルト値と表示用ヘルパーがある。

| 優先度 | 応答 | 解決 |
|---|---:|---:|
| `p1` | 15 分 | 240 分 |
| `p2` | 60 分 | 480 分 |
| `p3` | 240 分 | 1440 分 |
| `p4` | 1440 分 | 4320 分 |

`GET /api/sla-check` と `POST /api/sla-check` は `resolved` と `closed` 以外を対象にする。未検知の違反だけを更新し、Slack に通知する。

このルートは middleware の通常ログイン保護からは除外し、Route Handler 側で `CRON_SECRET` を使った Bearer 認証を行う。本番環境では `Authorization: Bearer <CRON_SECRET>` が必要。ローカル開発では `CRON_SECRET` なしでも実行できる。

レスポンスは以下。

```json
{
  "checked": 8,
  "responseBreached": 1,
  "resolveBreached": 2
}
```

## 統計 API

`GET /api/stats` は削除済みを除外して集計する。

```ts
{
  total: number;
  openCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  slaResponseBreached: number;
  slaResolveBreached: number;
  avgResolveMinutes: number | null;
}
```

平均解決時間は `resolved_at - created_at` の平均を分単位に丸める。

## Slack

`src/lib/slack.ts` が通知を担当する。`SLACK_WEBHOOK_URL` が未設定なら何も送信しない。送信エラーは握りつぶすため、ユーザー操作は Slack 障害で失敗しない。

通知イベント:

- 起票: `notifyIncidentCreated`
- ステータス変更: `notifyStatusChanged`
- SLA 違反: `notifySlaBreached`

## 開発メモ

- Next.js 16 の Route Handler では動的ルートの `params` が Promise として扱われているため、`await params` する。
- 詳細ページの `params` も `Promise<{ id: string }>` として受け、Client Component では `use(params)` で展開している。
- `npm run dev` は `npm run migrate && next dev`。
- `vercel.json` の build command は `npm run build`。
