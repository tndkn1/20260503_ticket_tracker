# 要件定義書

## 1. システム概要

**システム名**: ITSM Incident Tracker

IT サービス管理における障害・問い合わせ・作業インシデントを一元管理し、優先度別 SLA の遵守状況、対応履歴、担当状況を可視化する。

## 2. 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js 16.2.4 App Router / React 19.2 / Tailwind CSS 4 |
| UI | shadcn 系コンポーネント / Base UI / lucide-react / sonner |
| バックエンド | Next.js Route Handlers |
| データベース | SQLite（ローカル） / Turso libSQL（本番） |
| ORM | Drizzle ORM |
| 認証 | JWT Cookie / PBKDF2 / GitHub OAuth |
| 通知 | Slack Incoming Webhook |
| デプロイ | Vercel |

## 3. ユーザー種別

| 種別 | 権限 |
|---|---|
| `admin` | 全機能利用可。削除済み表示と一括論理削除が可能 |
| `member` | インシデント起票、閲覧、更新が可能。削除操作は不可 |

## 4. 機能要件

### 4.1 認証

- ユーザー名とパスワードでログインできる。
- パスワードは PBKDF2、100,000 イテレーション、SHA-256、salt 付きで保存する。
- ログイン成功時に `itsm_session` Cookie を発行する。
- Cookie は HttpOnly / SameSite=Lax / 本番 Secure / 8 時間有効とする。
- GitHub OAuth ログインに対応する。
- GitHub OAuth の `state` は JWT 署名付きで、5 分有効とする。
- GitHub ログイン時は `github_id` またはメールアドレスで既存ユーザーを検索し、未連携ユーザーには GitHub ID を紐付ける。
- 既存ユーザーがない場合は `member` ロールで自動作成する。
- `/login`、`/api/auth/login`、`/api/auth/github`、`/api/auth/github/callback` は未認証でアクセス可能とする。
- その他の画面/API は未認証時に `/login?from=<元パス>` へリダイレクトする。

### 4.2 インシデント一覧

- トップページ `/` に KPI とインシデント一覧を表示する。
- 通常は `deleted_at IS NULL` のインシデントのみ表示する。
- admin は「削除済みを表示」スイッチで削除済みインシデントのみ表示できる。
- 一覧は起票日時の降順で表示する。
- 表示項目はチェックボックス、ID、タイトル、優先度、ステータス、SLA（解決）、起票者、担当者、起票日とする。
- キーワード検索はタイトル、説明、起票者を対象とする。
- 優先度フィルタは `all / p1 / p2 / p3 / p4` とする。
- ステータスフィルタは `new / assigned / in_progress / resolved / closed` の単一選択とし、同じステータスを再クリックすると解除する。
- 削除済みでない行をクリックすると詳細画面へ遷移する。
- admin のみチェックボックス選択と一括削除ボタンを利用できる。

### 4.3 インシデント起票

- 入力項目はタイトル、説明、優先度、担当者とする。
- タイトルと説明は必須。
- 優先度のデフォルトは `p3`。
- 担当者は自由入力で、ダイアログを開いた時点のログインユーザー名を初期値とする。
- 起票者はログインユーザー名を自動設定する。
- ID は `sequences` テーブルを使って `INC-0001` 形式で採番する。
- 優先度に応じた SLA 応答期限と解決期限を保存する。
- 起票時に `audit_log` へ `status = new` のログを記録する。
- `SLACK_WEBHOOK_URL` が設定されている場合は Slack に起票通知を送信する。

### 4.4 インシデント詳細・更新

- 詳細画面 `/incidents/[id]` でインシデント本体と監査ログを表示する。
- ヘッダーに ID、優先度、ステータス、SLA 応答バッジ、SLA 解決バッジを表示する。
- タイトルはインライン編集できる。
- 更新パネルで更新者、ステータス、優先度、担当者、コメントを入力できる。
- コメントのみの更新も監査ログに記録する。
- クイック遷移ボタンは UI 上の推奨遷移を表示する。
- サーバー側ではステータス遷移ルールを強制しない。
- 更新可能フィールドは `status`、`priority`、`assignee`、`title`、`description`。
- `status` が `new` 以外へ初回遷移した時に `responded_at` を記録する。
- `status` が `resolved` または `closed` へ初回遷移した時に `resolved_at` を記録する。
- ステータス変更時に Slack 通知を送信する。

UI 上のクイック遷移:

| 現在 | 次に遷移可能 |
|---|---|
| `new` | `assigned` / `in_progress` / `closed` |
| `assigned` | `in_progress` / `resolved` / `closed` |
| `in_progress` | `resolved` / `closed` |
| `resolved` | `closed` / `in_progress` |
| `closed` | なし |

### 4.5 インシデント削除

- 削除は admin のみ可能。
- 一覧で複数選択し、一括論理削除する。
- 論理削除は `deleted_at` に削除日時を保存する。
- 削除操作は `audit_log` に `field = deleted_at` として記録する。
- 削除済み行は半透明、タイトル取り消し線、「削除済」表示で区別する。
- 削除済み行から詳細画面へは遷移しない。

### 4.6 SLA 管理

| 優先度 | ラベル | 応答期限 | 解決期限 |
|---|---|---:|---:|
| `p1` | Critical | 15 分 | 4 時間 |
| `p2` | High | 60 分 | 8 時間 |
| `p3` | Medium | 4 時間 | 24 時間 |
| `p4` | Low | 24 時間 | 72 時間 |

- SLA バッジは残り時間を `3h 20m`、`25m`、`-40m` の形式で表示する。
- 期限 30 分前から warning 表示とする。
- 期限超過時は breached 表示とする。
- 応答済みは `応答済`、解決済みは `SLA達成` と表示する。
- トップページは 60 秒ごと、詳細ページは 30 秒ごとにローカル時刻を更新してバッジを再計算する。
- `GET /api/sla-check` と `POST /api/sla-check` は active なインシデントを確認し、未検知の応答違反または解決違反にフラグを立てる。
- 本番環境の `/api/sla-check` は `Authorization: Bearer <CRON_SECRET>` を必須とする。
- SLA 違反検知時は Slack アラートを送信する。

### 4.7 ダッシュボード

`GET /api/stats` は削除済みを除外して以下を返す。

| フィールド | 内容 |
|---|---|
| `total` | 総インシデント数 |
| `openCount` | `new + assigned + in_progress` |
| `byStatus` | ステータス別件数 |
| `byPriority` | 優先度別件数 |
| `slaResponseBreached` | 応答 SLA 違反件数 |
| `slaResolveBreached` | 解決 SLA 違反件数 |
| `avgResolveMinutes` | 平均解決時間（分、未解決のみなら `null`） |

### 4.8 Slack 通知

`SLACK_WEBHOOK_URL` が設定されている場合のみ通知する。未設定時は何もしない。

| イベント | 内容 |
|---|---|
| 起票 | 優先度、ID、タイトル、ステータス、起票者 |
| ステータス変更 | ID、変更前後ステータス、タイトル、更新者 |
| SLA 違反 | ID、タイトル、違反種別、優先度、担当者 |

## 5. データベース設計

### `incidents`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | TEXT | 主キー。例: `INC-0001` |
| `title` | TEXT | タイトル |
| `description` | TEXT | 説明 |
| `status` | TEXT | `new / assigned / in_progress / resolved / closed` |
| `priority` | TEXT | `p1 / p2 / p3 / p4` |
| `assignee` | TEXT | 担当者 |
| `reporter` | TEXT | 起票者 |
| `responded_at` | INTEGER | 初回応答日時（unix ms） |
| `resolved_at` | INTEGER | 解決日時（unix ms） |
| `sla_response_deadline` | INTEGER | 応答期限（unix ms） |
| `sla_resolve_deadline` | INTEGER | 解決期限（unix ms） |
| `sla_response_breached` | INTEGER | 応答違反フラグ |
| `sla_resolve_breached` | INTEGER | 解決違反フラグ |
| `deleted_at` | INTEGER | 論理削除日時（unix ms） |
| `created_at` | INTEGER | 作成日時（unix ms） |
| `updated_at` | INTEGER | 更新日時（unix ms） |

### `audit_log`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER | 主キー |
| `incident_id` | TEXT | インシデント ID |
| `actor` | TEXT | 操作者 |
| `field` | TEXT | 変更フィールド |
| `old_value` | TEXT | 変更前 |
| `new_value` | TEXT | 変更後 |
| `comment` | TEXT | コメント |
| `created_at` | INTEGER | 記録日時（unix ms） |

### `users`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | TEXT | 主キー |
| `username` | TEXT | ユーザー名（一意） |
| `email` | TEXT | メールアドレス（一意） |
| `password_hash` | TEXT | PBKDF2 ハッシュ。GitHub 専用ユーザーは nullable |
| `github_id` | TEXT | GitHub ユーザー ID |
| `role` | TEXT | `admin / member` |
| `created_at` | INTEGER | 作成日時（unix ms） |

### `sla_config`

| カラム | 型 | 説明 |
|---|---|---|
| `priority` | TEXT | 主キー |
| `response_minutes` | INTEGER | 応答期限（分） |
| `resolve_minutes` | INTEGER | 解決期限（分） |

### `sequences`

| カラム | 型 | 説明 |
|---|---|---|
| `name` | TEXT | 主キー |
| `value` | INTEGER | 現在値 |

## 6. API 一覧

| メソッド | パス | 概要 |
|---|---|---|
| `POST` | `/api/auth/login` | パスワードログイン |
| `GET` | `/api/auth/github` | GitHub OAuth 開始 |
| `GET` | `/api/auth/github/callback` | GitHub OAuth コールバック |
| `POST` | `/api/auth/logout` | ログアウト |
| `GET` | `/api/auth/me` | セッションユーザー取得 |
| `GET` | `/api/incidents` | インシデント一覧取得 |
| `POST` | `/api/incidents` | インシデント起票 |
| `DELETE` | `/api/incidents` | 一括論理削除（admin のみ） |
| `GET` | `/api/incidents/[id]` | 詳細と監査ログ取得 |
| `PATCH` | `/api/incidents/[id]` | インシデント更新 |
| `GET` | `/api/stats` | KPI 取得 |
| `GET` / `POST` | `/api/sla-check` | SLA 違反チェック |

## 7. 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | 必須 | JWT 署名シークレット |
| `DB_PATH` | 任意 | ローカル SQLite パス。デフォルト `data/itsm.db` |
| `TURSO_DATABASE_URL` | 本番 | Turso 接続 URL。設定時は Turso を使用 |
| `TURSO_AUTH_TOKEN` | 本番 | Turso 認証トークン |
| `GITHUB_CLIENT_ID` | GitHub 利用時 | OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub 利用時 | OAuth App Client Secret |
| `SLACK_WEBHOOK_URL` | 任意 | Slack Incoming Webhook URL |
| `CRON_SECRET` | SLA チェック定期実行時 | `/api/sla-check` の Bearer 認証用シークレット |
