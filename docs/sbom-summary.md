# SBOM 概要

[sbom.spdx.json](./sbom.spdx.json) の概要情報。GitHub Dependency Graph から生成した SPDX 形式の SBOM を解析した結果。

> **注意**: 本ドキュメントは生成時点（2026-06-27）のスナップショットの要約であり、依存関係の更新に追従して自動更新されない。最新情報が必要な場合は `gh api repos/<owner>/<repo>/dependency-graph/sbom` で再取得すること。

---

## 1. ドキュメント情報

| 項目 | 内容 |
|---|---|
| 形式 | SPDX-2.3 |
| プロジェクト名 | `com.github.tndkn1/20260503_ticket_tracker` |
| 生成日時 | 2026-06-27T11:11:18Z |
| 生成元 | GitHub Dependency Graph |
| パッケージ総数 | 820 件 |

---

## 2. ライセンス分布

| ライセンス | 件数 |
|---|---|
| MIT | 688 |
| Apache-2.0 | 39 |
| ISC | 33 |
| MPL-2.0 | 13 |
| BSD-3-Clause | 10 |
| BSD-2-Clause AND LGPL-2.x/3.x AND MIT AND MPL-2.0（複合） | 10 |
| BSD-2-Clause | 8 |
| Apache-2.0 AND BSD-2-Clause AND LGPL-2.x/3.x AND MIT AND MPL-2.0（複合） | 3 |
| BlueOak-1.0.0 | 2 |
| その他（単発の複合ライセンス・OR 式など） | 約 13 |

**大半（約95%）が MIT / Apache-2.0 / ISC などの permissive ライセンスで、商用利用上の問題はない。**

---

## 3. 注目すべきライセンス

### LGPL を含むパッケージ（13件）

`sharp`（Next.js の画像最適化が依存する画像処理ライブラリ）のネイティブバイナリ群。

- `@img/sharp-libvips-*`（linux / darwin / win32 各アーキテクチャ向け）
- `@img/sharp-win32-*`

LGPL は動的リンクであれば商用利用に問題ないとされることが多いが、コピーレフト系ライセンスのため利用時は留意する。

### カスタム LicenseRef

`LicenseRef-scancode-other-permissive` が一部パッケージ（上記 LGPL 系と同じ libvips 関連）の `licenseConcluded` に使用されている。SPDX 仕様上の解決可能性を保つため、`hasExtractedLicensingInfos` に [ScanCode LicenseDB](https://scancode-licensedb.aboutcode.org/other-permissive.html) の定義を追加済み。

### ライセンス不明（NOASSERTION）

自リポジトリ自身（`com.github.tndkn1/20260503_ticket_tracker`）の1件のみ。依存パッケージ側にライセンス不明のものはない。

---

## 4. セキュリティ脆弱性との関係

本 SBOM 生成時点で検出されていた脆弱性（Dependabot）のうち、本番ランタイムに影響する `ws`（DoS, High）・`postcss`（XSS, Medium）は `package.json` の `overrides` で修正済み。残存する脆弱性は `shadcn` / `eslint` / `drizzle-kit` 等の開発ツール経由であり、本番に配信されるコードには含まれない。
