# 機能デモンストレーション & 技術ガイド

本ドキュメントは、ITSM インシデント管理システムの各機能の実装・動作・設計思想を開発者向けに詳しく解説します。

---

## 目次

1. [認証システム](#認証システム)
2. [インシデント管理](#インシデント管理)
3. [SLA 管理](#sla-管理)
4. [ダッシュボード](#ダッシュボード)
5. [監査ログ](#監査ログ)
6. [Slack 統合](#slack-統合)
7. [API 仕様](#api-仕様)

---

## 認証システム

### 1.1 概要

本システムの認証は 2 つの方式に対応：
- **パスワード認証** — PBKDF2（100,000 イテレーション）でハッシュ化
- **GitHub OAuth** — OAuth 2.0 フロー + メール自動リンク

### 1.2 パスワード認証フロー

```
ユーザー入力
    ↓
[POST /api/auth/login]
    ├─ ユーザー名でユーザー検索
    ├─ 入力パスワード + salt を PBKDF2 ハッシュ化
    ├─ DB のハッシュと定数時間比較
    └─ 成功時：JWT セッション Cookie 発行
        ├─ 有効期限：8 時間
        ├─ HttpOnly / SameSite=Lax / Secure（本番）
        └─ ペイロード：{ userId, role, iat, exp }
```

**実装ポイント：**
- パスワード比較は定数時間比較で、タイミング攻撃を防止
- PBKDF2 は jose ライブラリの `pbkdf2` 関数を使用
- Cookie は自動的にブラウザで管理、JS からアクセス不可

### 1.3 GitHub OAuth フロー

```
ユーザー: [GitHub でログイン] クリック
    ↓
[GET /api/auth/github]
    ├─ JWT 署名付き state パラメータを生成
    ├─ GitHub OAuth URL に state を含めてリダイレクト
    └─ CSRF 対策：state を Cookie ではなく JWT で署名
        
GitHub ユーザー認可
    ↓
[GET /api/auth/github/callback?code=...&state=...]
    ├─ state JWT を検証（署名・有効期限）
    ├─ コールバック code で アクセストークン取得
    ├─ GitHub API でユーザー情報・メール取得
    ├─ メールで既存ユーザーを検索
    │  ├─ 見つかった → GitHub ID を紐付け
    │  └─ 見つからない → 新規ユーザーを member ロールで作成
    └─ セッション Cookie 発行
        
ダッシュボード遷移
```

**実装ポイント：**
- CSRF state は JWT 署名で保護（Cookie 不要）
- 初回ログイン時に自動ユーザー作成（member ロール）
- メールで既存ユーザーを自動検索・リンク

### 1.4 セッション管理

**ルート保護：**

| パス | 認証 | リダイレクト |
|-----|:---:|-----------|
| `/login` | ✗ | （認証済みなら `/` へ） |
| `/api/auth/login` | ✗ | — |
| `/api/auth/github` | ✗ | — |
| `/api/auth/github/callback` | ✗ | — |
| その他すべて | ✓ | 未認証は `/login?from=<元パス>` へ |

**中間ウェア実装（middleware.ts）：**

```typescript
// 認証チェックと自動リダイレクト
export function middleware(request: NextRequest) {
  // セッション Cookie から JWT を取得
  // 有効期限・署名を検証
  // 無効 → /login へリダイレクト
}
```

---

## インシデント管理

### 2.1 概要

インシデントの起票・追跡・解決を一元管理します。

**ライフサイクル：**

```
起票（new）
    ↓
割当・開始（assigned → in_progress）
    ↓
解決（resolved）
    ↓
クローズ（closed）
```

### 2.2 インシデント起票

**エンドポイント：**
```
POST /api/incidents
Content-Type: application/json

{
  "title": "ログインシステムが応答しない",
  "description": "午前9時ごろからログインが失敗するようになりました",
  "priority": "p1",           // 任意、デフォルト: p3
  "assignee": "operator_001"  // 任意
}
```

**サーバー処理：**

```
1. 入力バリデーション
   ├─ title / description: 必須
   ├─ priority: p1 | p2 | p3 | p4（デフォルト p3）
   └─ assignee: 存在するユーザーか確認

2. ID 採番
   ├─ sequences テーブルから incident の値を取得
   ├─ "INC-{value}" で ID 作成
   └─ sequences を increment

3. SLA 期限計算
   ├─ priority に応じた SLA 設定を取得（sla_config）
   ├─ 現在時刻 + 期限（分）= deadline（Unix ms）
   └─ sla_response_deadline / sla_resolve_deadline に保存

4. インシデント作成
   └─ incidents テーブルに INSERT
      ├─ status: "new"
      ├─ reporter: ログインユーザー（自動設定）
      ├─ created_at: 現在時刻
      └─ updated_at: 現在時刻

5. 監査ログ記録
   └─ audit_log テーブルに INSERT（field=各フィールド）

6. Slack 通知
   └─ SLACK_WEBHOOK_URL が設定されていれば通知送信
      ├─ 優先度絵文字（🔴 P1 等）
      ├─ インシデント ID / タイトル
      ├─ 起票者
      └─ ステータス

レスポンス: 201 Created
{
  "id": "INC-0001",
  "title": "...",
  "status": "new",
  "priority": "p1",
  "sla_response_deadline": 1715330700000,
  "sla_resolve_deadline": 1715345100000,
  ...
}
```

### 2.3 インシデント更新

**エンドポイント：**
```
PATCH /api/incidents/[id]
Content-Type: application/json

{
  "status": "in_progress",    // 任意
  "priority": "p2",           // 任意
  "assignee": "admin",        // 任意
  "title": "...",             // 任意
  "comment": "対応中"         // 任意（監査ログにのみ記録）
}
```

**サーバー処理：**

```
1. インシデント取得
   └─ 指定 ID が存在するか確認

2. ステータス遷移時の自動処理
   ├─ new 以外への初回遷移
   │  └─ responded_at を現在時刻に設定
   ├─ resolved / closed への遷移
   │  └─ resolved_at を現在時刻に設定
   └─ 遷移ルール（UI 設計指針、サーバー側では強制しない）
      ├─ new      → assigned | in_progress | closed
      ├─ assigned → in_progress | resolved | closed
      ├─ in_progress → resolved | closed
      ├─ resolved → closed | in_progress
      └─ closed  → （遷移不可）

3. フィールド更新
   └─ incidents テーブルを UPDATE
      ├─ status / priority / assignee / title の変更を適用
      └─ updated_at を現在時刻に更新

4. 監査ログ記録
   └─ 変更されたフィールドごとに audit_log に INSERT
      ├─ incident_id / actor / field
      ├─ old_value / new_value / comment
      └─ created_at: 現在時刻

5. Slack 通知
   ├─ ステータス変更 → 変更者・変更前後ステータスを通知
   └─ SLA 違反（sla_response_breached / sla_resolve_breached） → 違反アラート

レスポンス: 200 OK
{ 更新後のインシデント情報 }
```

### 2.4 SLA 状態の自動設定

**初回応答の自動記録：**

```
ステータス遷移（new → 他）時
    ↓
responded_at が未設定
    ↓
現在時刻を responded_at に設定
    ↓
sla_response_breached を確認
    ├─ 現在時刻 > sla_response_deadline → true
    └─ 現在時刻 <= sla_response_deadline → false
```

**解決の自動記録：**

```
ステータス遷移（→ resolved / closed）時
    ↓
resolved_at が未設定
    ↓
現在時刻を resolved_at に設定
    ↓
sla_resolve_breached を確認
    ├─ 現在時刻 > sla_resolve_deadline → true
    └─ 現在時刻 <= sla_resolve_deadline → false
```

---

## SLA 管理

### 3.1 SLA 設定

**デフォルト設定（sla_config テーブル）：**

| priority | response_minutes | resolve_minutes |
|----------|-----------------|-----------------|
| p1 | 15 | 240 |
| p2 | 60 | 480 |
| p3 | 240 | 1440 |
| p4 | 1440 | 4320 |

**期限計算式：**

```
sla_response_deadline = インシデント作成時刻 + (response_minutes × 60 × 1000)
sla_resolve_deadline = インシデント作成時刻 + (resolve_minutes × 60 × 1000)
```

### 3.2 SLA バッジ表示ロジック

**フロントエンド実装：**

```typescript
// 60秒ごとに now を更新
setInterval(() => {
  setNow(Date.now());
}, 60000);

// 残り時間を計算・表示
function formatSlaRemaining(deadline: number, responded: boolean) {
  if (responded) return "応答済";
  
  const remaining = deadline - now;
  if (remaining < 0) {
    return `${Math.abs(remaining) / 60000 | 0}m 超過`; // 赤
  }
  
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  
  if (remaining < 30 * 60000) {
    return `${hours}h ${minutes}m`; // オレンジ（警告）
  }
  return `${hours}h ${minutes}m`; // 緑（正常）
}

// バッジの背景色
function getSlaColor(deadline: number, responded: boolean): string {
  if (responded) return "bg-blue-100";
  
  const remaining = deadline - now;
  if (remaining < 0) return "bg-red-100";         // 赤：超過
  if (remaining < 30 * 60000) return "bg-orange-100"; // オレンジ：警告
  return "bg-green-100";                          // 緑：正常
}
```

### 3.3 SLA 違反チェック API

**エンドポイント：**
```
POST /api/sla-check

自動実行：cron / Vercel Cron Function / 外部スケジューラー
```

**処理フロー：**

```
1. アクティブなインシデントを取得
   └─ status が new | assigned | in_progress のもの

2. 各インシデントについて期限チェック
   ├─ 応答期限チェック
   │  ├─ responded_at が未設定 && 現在時刻 > sla_response_deadline
   │  └─ sla_response_breached = true
   │
   └─ 解決期限チェック
      ├─ resolved_at が未設定 && 現在時刻 > sla_resolve_deadline
      └─ sla_resolve_breached = true

3. 違反検知時の処理
   ├─ incidents テーブルを UPDATE
   ├─ audit_log に記録
   └─ Slack アラート送信
      ├─ インシデント ID / タイトル
      ├─ 違反種別（応答 or 解決）
      └─ 超過時間

レスポンス: 200 OK
{
  "checked": 8,
  "breached": 2,
  "alerts": [
    { "incidentId": "INC-0008", "type": "resolve", "overdueMs": 300000 },
    ...
  ]
}
```

---

## ダッシュボード

### 4.1 KPI 計算ロジック

**エンドポイント：**
```
GET /api/stats
```

**計算内容：**

```typescript
interface StatsResponse {
  totalIncidents: number;      // COUNT(*)
  openIncidents: number;        // COUNT WHERE status IN (new, assigned, in_progress)
  p1Active: number;             // COUNT WHERE status != closed AND priority = p1
  slaResponseBreach: number;    // COUNT WHERE sla_response_breached = true
  slaResolveBreach: number;     // COUNT WHERE sla_resolve_breached = true
  avgResolutionTimeMs: number;  // AVG(resolved_at - created_at) WHERE resolved_at IS NOT NULL
}
```

### 4.2 統計情報の自動更新

**設計方針：**
- 自動再取得なし
- ユーザーの**手動リロード**またはフィルタ変更時に再取得
- 理由：SLA 計算は 60 秒ごとだが、統計は頻繁に変わらない

**実装：**

```typescript
// ダッシュボード読み込み時
useEffect(() => {
  fetchStats();
}, []);

// フィルタ変更時
const handleFilterChange = (status: string) => {
  fetchStats(); // 再取得
};

// 手動リロード
<button onClick={() => fetchStats()}>🔄 リロード</button>
```

---

## 監査ログ

### 5.1 ログ記録対象

**フィールド変更ログ：**
- status / priority / assignee / title / responded_at / resolved_at
- 各変更時に old_value / new_value / actor / timestamp を記録

**コメントログ：**
- コメント入力時も audit_log に記録
- field = "comment" で、new_value = コメント内容

### 5.2 ログの保存形式

```
audit_log テーブル

id: 1
incident_id: "INC-0001"
actor: "admin"
field: "status"
old_value: "new"
new_value: "in_progress"
comment: NULL
created_at: 1715330745000

id: 2
incident_id: "INC-0001"
actor: "operator_001"
field: "comment"
old_value: NULL
new_value: "対応中です"
comment: NULL
created_at: 1715330800000
```

### 5.3 タイムライン表示

**フロントエンド実装：**

```typescript
// インシデント詳細ページで取得
const { timeline } = await fetch(`/api/incidents/${id}`).then(r => r.json());

// 新しい順にソート
const sortedTimeline = timeline.sort((a, b) => b.created_at - a.created_at);

// レンダリング
sortedTimeline.map(entry => (
  <div key={entry.id}>
    <time>{new Date(entry.created_at).toLocaleString('ja-JP')}</time>
    <strong>{entry.actor}</strong>
    {entry.field === 'comment' ? (
      <p>コメント: {entry.new_value}</p>
    ) : (
      <p>フィールド [{entry.field}] を {entry.old_value} → {entry.new_value} に変更</p>
    )}
  </div>
))
```

---

## Slack 統合

### 6.1 Webhook 設定

**環境変数：**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
```

**未設定時：**
- Slack 通知は送信されない（エラーにはならない）
- ログに `SLACK_WEBHOOK_URL not configured` と出力

### 6.2 通知タイプ別テンプレート

#### インシデント起票通知

```json
{
  "text": "🔴 P1 インシデント起票",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*新しいインシデント*\n*ID:* INC-0001\n*タイトル:* ログインシステムが応答しない\n*優先度:* 🔴 P1 Critical\n*起票者:* admin"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "応答期限: 15分\n解決期限: 4時間"
      }
    }
  ]
}
```

#### ステータス変更通知

```json
{
  "text": "ステータス変更",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*ステータス変更*\n*ID:* INC-0001\n*変更者:* admin\n*変更前:* new → *変更後:* in_progress"
      }
    }
  ]
}
```

#### SLA 違反アラート

```json
{
  "text": "🚨 SLA 違反アラート",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*SLA 違反*\n*ID:* INC-0001\n*違反種別:* 解決期限超過\n*超過時間:* 45分\n*優先度:* 🔴 P1"
      }
    }
  ]
}
```

### 6.3 実装パターン

```typescript
async function notifySlack(message: SlackMessage) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('SLACK_WEBHOOK_URL not configured');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send Slack notification', error);
    // エラー時も処理は続行
  }
}
```

---

## API 仕様

### 7.1 認証 API

#### `POST /api/auth/login`

```
Request:
{
  "username": "operator_001",
  "password": "secretpassword"
}

Response: 200 OK
{
  "user": {
    "id": "user-001",
    "username": "operator_001",
    "role": "member"
  }
}

Cookie: _session=eyJhbGciOi...; HttpOnly; SameSite=Lax; Path=/
```

#### `GET /api/auth/github`

```
Redirect:
https://github.com/login/oauth/authorize?
  client_id=...&
  redirect_uri=http://localhost:3000/api/auth/github/callback&
  state=eyJhbGciOi...
```

#### `GET /api/auth/github/callback?code=...&state=...`

```
Processing:
1. state JWT を検証
2. code でアクセストークン取得
3. GitHub API で ユーザー情報取得
4. メール照合 or 新規作成

Redirect: / (ダッシュボード)

Cookie: _session=...; HttpOnly; SameSite=Lax; Path=/
```

#### `POST /api/auth/logout`

```
Response: 200 OK
Cookie: _session=; Max-Age=0; Path=/
Redirect: /login
```

#### `GET /api/auth/me`

```
Response: 200 OK
{
  "id": "user-001",
  "username": "operator_001",
  "email": "operator@example.com",
  "role": "member",
  "createdAt": 1715000000000
}

Response: 401 Unauthorized (未認証時)
```

### 7.2 インシデント API

#### `GET /api/incidents`

```
Query Parameters:
?status=new&priority=p1&keyword=login&limit=50&offset=0

Response: 200 OK
{
  "incidents": [
    {
      "id": "INC-0001",
      "title": "...",
      "description": "...",
      "priority": "p1",
      "status": "new",
      "assignee": "admin",
      "reporter": "operator_001",
      "respondedAt": null,
      "resolvedAt": null,
      "slaResponseDeadline": 1715330700000,
      "slaResolveDeadline": 1715345100000,
      "slaResponseBreached": false,
      "slaResolveBreached": false,
      "createdAt": 1715330700000,
      "updatedAt": 1715330700000
    },
    ...
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

#### `POST /api/incidents`

```
Request:
{
  "title": "ログインシステムが応答しない",
  "description": "午前9時ごろからログインが失敗するようになりました",
  "priority": "p1",
  "assignee": "operator_001"
}

Response: 201 Created
{
  "id": "INC-0010",
  "title": "...",
  "status": "new",
  "priority": "p1",
  ...
}

Actions:
- ID 採番
- SLA 期限計算
- 監査ログ記録
- Slack 通知送信
```

#### `GET /api/incidents/[id]`

```
Response: 200 OK
{
  "incident": { ... },
  "timeline": [
    {
      "id": 1,
      "actor": "admin",
      "field": "status",
      "oldValue": "new",
      "newValue": "in_progress",
      "comment": null,
      "createdAt": 1715330745000
    },
    ...
  ]
}
```

#### `PATCH /api/incidents/[id]`

```
Request:
{
  "status": "in_progress",
  "comment": "対応を開始しました"
}

Response: 200 OK
{ 更新後のインシデント情報 }

Actions:
- ステータス遷移（responded_at / resolved_at 自動設定）
- 監査ログ記録
- Slack 通知送信
```

### 7.3 統計 API

#### `GET /api/stats`

```
Response: 200 OK
{
  "totalIncidents": 45,
  "openIncidents": 8,
  "p1Active": 2,
  "slaResponseBreach": 1,
  "slaResolveBreach": 3,
  "avgResolutionTimeMs": 8100000
}
```

### 7.4 SLA チェック API

#### `POST /api/sla-check`

```
Request: (Body 不要)

Response: 200 OK
{
  "checked": 8,
  "breached": 2,
  "alerts": [
    {
      "incidentId": "INC-0001",
      "type": "resolve",
      "overdueMs": 300000
    }
  ]
}

実行方法:
- Vercel Cron Function で定期実行
- または外部スケジューラー（GitHub Actions / EasyCron 等）で定期呼び出し
```

---

## 参考

- 技術スタック：Next.js 16, React 19, Drizzle ORM, Turso libSQL
- 認証：jose (JWT), PBKDF2
- UI：Tailwind CSS 4, shadcn UI
- デプロイ：Vercel
