# 要件定義書

## 1. システム概要

**システム名**: ITSM インシデント管理システム  
**目的**: IT サービス管理（ITSM）における障害・インシデントの起票・追跡・解決を一元管理し、SLA 遵守状況を可視化する。

---

## 2. 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router) / React 19 / Tailwind CSS 4 / shadcn UI |
| バックエンド | Next.js API Routes (サーバーレス) |
| データベース | SQLite（ローカル開発） / Turso libSQL（本番） |
| ORM | Drizzle ORM |
| 認証 | JWT (jose) / PBKDF2 パスワードハッシュ / GitHub OAuth |
| デプロイ | Vercel |

---

## 3. ユーザー種別

| 種別 | 権限 |
|---|---|
| `admin` | 全機能利用可 |
| `member` | 全機能利用可（現状 admin と同等） |

---

## 4. 機能要件

### 4.1 認証

#### 4.1.1 パスワードログイン

- ユーザー名とパスワードで認証する
- パスワードは PBKDF2（100,000 イテレーション、SHA-256）でハッシュ化して保存する
- 認証成功時に JWT セッション Cookie（有効期限 8 時間、HttpOnly / SameSite=Lax）を発行する

#### 4.1.2 GitHub OAuth ログイン

- GitHub アカウントで認証できる
- コールバック時に GitHub からユーザー情報・メールアドレスを取得する
- 既存ユーザーが GitHub アカウントを連携していない場合はメールで照合して自動リンクする
- 初回ログイン時は `member` ロールでユーザーを自動作成する
- CSRF 対策として JWT 署名付き state パラメータを使用する（Cookie 不要）

#### 4.1.3 ログアウト

- セッション Cookie を削除してログアウトする

#### 4.1.4 ルート保護

以下のパスは認証不要（公開）：

- `/login`
- `/api/auth/login`
- `/api/auth/github`（コールバック含む）

それ以外の全パスは有効なセッションが必要。未認証の場合は `/login?from=<元パス>` へリダイレクトする。

---

### 4.2 インシデント管理

#### 4.2.1 インシデント一覧

- 全インシデントを起票日時の降順で一覧表示する
- 表示項目：ID、タイトル、優先度、ステータス、SLA（解決）、起票者、担当者、起票日
- フィルタリング機能：
  - キーワード検索（タイトル・説明・起票者）
  - 優先度フィルタ（全件 / p1 / p2 / p3 / p4）
  - ステータスボタン（new / assigned / in_progress / resolved / closed）
- 行クリックでインシデント詳細画面へ遷移する

#### 4.2.2 インシデント起票

- 入力項目：
  - タイトル（必須）
  - 説明（必須）
  - 優先度（任意、デフォルト p3）
  - 担当者（任意）
- 起票者はログインユーザーを自動設定する
- インシデント ID は `INC-0001` 形式の連番（DB 管理）で自動採番する
- 優先度に応じた SLA 期限を自動計算して保存する
- 起票時に Slack 通知を送信する
- 起票時の監査ログを記録する

#### 4.2.3 インシデント詳細

表示項目：
- ID、優先度バッジ、ステータスバッジ、SLA 応答バッジ、SLA 解決バッジ
- タイトル（インライン編集可）、起票者、起票日時
- 説明文
- SLA 詳細（応答期限・応答日時 / 解決期限・解決日時）
- タイムライン（変更履歴・コメント、新しい順）

#### 4.2.4 インシデント更新

更新可能な項目：
- ステータス（ステータス遷移ルールに従う）
- 優先度
- 担当者
- タイトル
- コメント（監査ログにのみ記録）

ステータス遷移ルール（UI 上の設計指針、サーバー側での強制は未実装）：

| 現在 | 次に遷移可能 |
|---|---|
| new | assigned / in_progress / closed |
| assigned | in_progress / resolved / closed |
| in_progress | resolved / closed |
| resolved | closed / in_progress |
| closed | なし |

> **注意**: 現在の `PATCH /api/incidents/[id]` 実装ではサーバー側の遷移バリデーションは行っていない。遷移ルールは UI の設計指針として定義しているが、不正遷移はサーバーで拒否されない。

更新時の自動処理：
- 初回の "new" 以外への遷移時に `respondedAt` を記録する
- resolved / closed への遷移時に `resolvedAt` を記録する
- ステータス変更時に Slack 通知を送信する
- 変更されたフィールドすべての監査ログを記録する

---

### 4.3 SLA 管理

#### 4.3.1 SLA 設定（デフォルト値）

| 優先度 | 応答期限 | 解決期限 |
|---|---|---|
| P1 (Critical) | 15 分 | 4 時間 |
| P2 (High) | 60 分 | 8 時間 |
| P3 (Medium) | 4 時間 | 24 時間 |
| P4 (Low) | 24 時間 | 72 時間 |

#### 4.3.2 SLA バッジ表示

- 残り時間を常時表示する（「Xh Ym」形式）
- 状態に応じて色分け：
  - 緑：期限まで 30 分以上
  - オレンジ：期限まで 30 分未満（警告）
  - 赤：期限超過（SLA 違反）
- 応答済み / 解決済みの場合は「応答済」「SLA 達成」を表示する

#### 4.3.3 SLA 違反検知

- 定期実行（`POST /api/sla-check`）でアクティブなインシデントを確認する
- 違反検知時に `slaResponseBreached` / `slaResolveBreached` フラグを立てる
- 違反時に Slack アラートを送信する

---

### 4.4 ダッシュボード（統計）

表示する KPI：
- 総インシデント数
- オープン件数（new + assigned + in_progress）
- P1 アクティブ件数
- SLA 応答違反件数
- SLA 解決違反件数
- 平均解決時間

ステータス別件数をボタン表示し、クリックで一覧をフィルタリングする。

---

### 4.5 監査ログ

- すべてのフィールド変更を記録する（変更前の値・変更後の値・変更者・日時）
- コメントのみの更新も記録する
- インシデント詳細画面のタイムラインに表示する（新しい順）

---

### 4.6 Slack 通知

`SLACK_WEBHOOK_URL` 環境変数が設定されている場合に以下のイベントで通知する：

| イベント | 内容 |
|---|---|
| インシデント起票 | 優先度絵文字 / ID / タイトル / ステータス / 起票者 |
| ステータス変更 | 変更者 / 変更前→変更後ステータス |
| SLA 違反 | 対象インシデント / 違反種別（応答 or 解決） |

---

## 5. 非機能要件

### 5.1 パフォーマンス

- SLA バッジの残り時間表示は 60 秒ごとにローカルの現在時刻（`now`）を更新して再計算する
- ダッシュボードの統計情報・インシデント一覧は自動再取得しない（手動リロードまたはフィルタ変更時に再取得）

### 5.2 セキュリティ

- セッション Cookie は HttpOnly / SameSite=Lax / Secure（本番環境）で発行する
- GitHub OAuth の CSRF 対策に JWT 署名付き state を使用する（Cookie 不要）
- パスワードは PBKDF2（100,000 イテレーション）でハッシュ化する
- パスワード比較は定数時間比較で実装する

### 5.3 可用性・デプロイ

- Vercel へのデプロイで本番運用する
- データベースは Turso（分散 SQLite）を使用する
- ローカル開発は SQLite ファイルを使用する

---

## 6. データベース設計

### incidents（インシデント）

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT | 主キー（例: INC-0001） |
| title | TEXT | タイトル |
| description | TEXT | 説明 |
| status | TEXT | new / assigned / in_progress / resolved / closed |
| priority | TEXT | p1 / p2 / p3 / p4 |
| assignee | TEXT | 担当者（nullable） |
| reporter | TEXT | 起票者 |
| responded_at | INTEGER | 初回応答日時（unix ms） |
| resolved_at | INTEGER | 解決日時（unix ms） |
| sla_response_deadline | INTEGER | SLA 応答期限（unix ms） |
| sla_resolve_deadline | INTEGER | SLA 解決期限（unix ms） |
| sla_response_breached | BOOLEAN | SLA 応答違反フラグ |
| sla_resolve_breached | BOOLEAN | SLA 解決違反フラグ |
| created_at | INTEGER | 作成日時（unix ms） |
| updated_at | INTEGER | 更新日時（unix ms） |

### audit_log（監査ログ）

| カラム | 型 | 説明 |
|---|---|---|
| id | INTEGER | 主キー（自動採番） |
| incident_id | TEXT | インシデント ID（外部キー） |
| actor | TEXT | 操作者 |
| field | TEXT | 変更フィールド名 |
| old_value | TEXT | 変更前の値 |
| new_value | TEXT | 変更後の値 |
| comment | TEXT | コメント（nullable） |
| created_at | INTEGER | 記録日時（unix ms） |

### users（ユーザー）

| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT | 主キー |
| username | TEXT | ユーザー名（一意） |
| email | TEXT | メールアドレス（一意） |
| password_hash | TEXT | PBKDF2 ハッシュ（nullable、GitHub ユーザー） |
| github_id | TEXT | GitHub ユーザー ID（nullable、一意） |
| role | TEXT | admin / member |
| created_at | INTEGER | 作成日時（unix ms） |

### sla_config（SLA 設定）

| カラム | 型 | 説明 |
|---|---|---|
| priority | TEXT | 主キー（p1/p2/p3/p4） |
| response_minutes | INTEGER | 応答期限（分） |
| resolve_minutes | INTEGER | 解決期限（分） |

### sequences（連番管理）

| カラム | 型 | 説明 |
|---|---|---|
| name | TEXT | 主キー（例: "incident"） |
| value | INTEGER | 現在の連番値 |

---

## 7. 画面一覧

| 画面 | URL | 認証 |
|---|---|---|
| ログイン | `/login` | 不要 |
| ダッシュボード（一覧） | `/` | 必要 |
| インシデント詳細・更新 | `/incidents/[id]` | 必要 |

---

## 8. API 一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | `/api/auth/login` | パスワードログイン |
| GET | `/api/auth/github` | GitHub OAuth 開始 |
| GET | `/api/auth/github/callback` | GitHub OAuth コールバック |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/me` | ログインユーザー情報取得 |
| GET | `/api/incidents` | インシデント一覧取得 |
| POST | `/api/incidents` | インシデント起票 |
| GET | `/api/incidents/[id]` | インシデント詳細・監査ログ取得 |
| PATCH | `/api/incidents/[id]` | インシデント更新 |
| POST | `/api/sla-check` | SLA 違反チェック（定期実行） |
| GET | `/api/stats` | 統計情報取得 |

---

## 9. 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | ✅ | JWT 署名シークレット（32 バイト以上推奨） |
| `TURSO_DATABASE_URL` | 本番のみ | Turso 接続 URL |
| `TURSO_AUTH_TOKEN` | 本番のみ | Turso 認証トークン |
| `GITHUB_CLIENT_ID` | GitHub 認証を使う場合 | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub 認証を使う場合 | GitHub OAuth App の Client Secret |
| `SLACK_WEBHOOK_URL` | 任意 | Slack 通知先 Webhook URL |
| `DB_PATH` | 任意 | ローカル SQLite ファイルパス（デフォルト: `data/itsm.db`） |
