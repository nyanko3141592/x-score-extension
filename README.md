# X Score - Tweet Engagement Analyzer

X（旧Twitter）のタイムライン上のツイートを、公開されている[Xのアルゴリズム](https://github.com/xai-org/x-algorithm)の重み付けに基づいて分析し、エンゲージメントスコアを視覚化するChrome拡張機能です。

![X Score Badge](https://img.shields.io/badge/Chrome-Extension-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 機能

- **リアルタイムスコア表示**: タイムライン上の各ツイートにアルゴリズムスコアバッジを表示
- **公式重み付け準拠**: Xが公開しているアルゴリズムの重み付けを使用
- **詳細分析ポップアップ**: バッジをクリックすると各アクションの寄与度を可視化
- **Premium認証表示**: 認証済みアカウントのブースト倍率を表示

## アルゴリズムの重み付け（公式値）

Xの公式ドキュメントに基づく重み付け：

### ポジティブシグナル

| アクション | 重み | 説明 |
|-----------|------|------|
| リプライ→会話継続 | **+75** | リプライが投稿者からエンゲージメントを得た場合 |
| リプライ | **+13.5** | ユーザーがツイートに返信 |
| プロフィールクリック+エンゲージ | **+12** | プロフィールを開いていいね/リプライ |
| 会話エンゲージメント | **+11** | 会話に入ってリプライ/いいね |
| 滞在時間 | **+10** | 会話に2分以上滞在 |
| リポスト | **+1** | リツイート |
| いいね | **+0.5** | いいね |
| 動画視聴 | **+0.005** | 動画の50%以上を視聴 |

### ネガティブシグナル（ペナルティ）

| アクション | 重み |
|-----------|------|
| 報告 | **-369** |
| 興味なし/ミュート/ブロック | **-74** |

### Premium認証ブースト

| 状況 | 倍率 |
|------|------|
| ネットワーク内 | **x4** |
| ネットワーク外 | **x2** |

## スコア計算式

```
Score = Σ (weight × P(action))
```

各アクションの確率 P(action) に対応する重みを掛けて合計します。

## インストール方法

### 方法1: ソースからインストール（推奨）

1. このリポジトリをクローンまたはダウンロード
   ```bash
   git clone https://github.com/YOUR_USERNAME/x-score-extension.git
   ```

2. Chromeで `chrome://extensions` を開く

3. 右上の「**デベロッパーモード**」をONにする

4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック

5. ダウンロードしたフォルダを選択

6. 拡張機能が追加されたら、x.comを開いてタイムラインを確認

### 方法2: ZIPダウンロード

1. このリポジトリの「Code」→「Download ZIP」をクリック

2. ZIPファイルを解凍

3. 上記の手順2〜6を実行

## 使い方

1. 拡張機能をインストール後、[x.com](https://x.com)にアクセス

2. タイムラインを表示すると、各ツイートのアクションバーに**スコアバッジ**が表示されます

3. **バッジをクリック**すると、詳細な分析ポップアップが表示されます：
   - エンゲージメント指標（いいね、リプライ、リポスト、表示回数）
   - 各アクションのスコア寄与度（バーグラフで視覚化）
   - コンテンツ分析（文字数、ハッシュタグ、メディア）

4. スクロールすると新しいツイートにも自動的にスコアが付与されます

## スコアの色分け

| スコア | 色 | 意味 |
|--------|------|------|
| 5.0以上 | 赤オレンジ | 非常に高いエンゲージメント |
| 2.0以上 | 緑 | 高エンゲージメント |
| 0.5以上 | 青 | 中程度 |
| 0.5未満 | グレー | 低エンゲージメント |

## ファイル構成

```
x-score-extension/
├── manifest.json    # Chrome拡張の設定ファイル
├── content.js       # メインロジック（スコア計算・UI）
├── styles.css       # スタイルシート
├── icons/
│   ├── icon16.png   # 16x16アイコン
│   ├── icon48.png   # 48x48アイコン
│   └── icon128.png  # 128x128アイコン
├── README.md        # このファイル
└── LICENSE          # MITライセンス
```

## 技術仕様

- **Manifest Version**: 3
- **対応サイト**: x.com, twitter.com
- **権限**: 最小限（ホストアクセスのみ）
- **ストレージ**: 使用なし（プライバシー重視）

## 注意事項

- P(action)（アクションの確率）は実際のエンゲージメント数から推定しています
- Xのアルゴリズムは随時更新されるため、最新の重み付けと異なる可能性があります
- 個人利用・教育目的でお使いください

## 参考資料

- [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) - X公式アルゴリズム（2024年公開）
- [twitter/the-algorithm](https://github.com/twitter/the-algorithm) - 旧Twitter公式アルゴリズム（2023年公開）
- [X Algorithm Ranking Factors - Social Media Today](https://www.socialmediatoday.com/news/x-formerly-twitter-open-source-algorithm-ranking-factors/759702/)

## 貢献

プルリクエストやイシューの報告を歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)をご覧ください。

---

Made with curiosity about how social media algorithms work.
