# X Score - Tweet Engagement Analyzer

X（旧Twitter）のタイムライン上のツイートを、公開されている[Xのアルゴリズム](https://github.com/xai-org/x-algorithm)に基づいて分析し、エンゲージメントスコアを表示するChrome拡張機能です。

![X Score Badge](https://img.shields.io/badge/Chrome-Extension-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 機能

- **リアルタイムスコア表示**: タイムライン上の各ツイートにアルゴリズムスコアバッジを表示
- **詳細分析ポップアップ**: バッジをクリックすると詳細な分析結果を表示
- **エンゲージメント指標**: いいね数、返信数、リポスト数、表示回数、エンゲージメント率を一覧表示
- **コンテンツ分析**: 文字数、ハッシュタグ、メンション、絵文字、メディアの有無を分析
- **スコア内訳**: 各アクションがスコアにどれだけ寄与しているかを可視化

## スクリーンショット

### スコアバッジ
各ツイートのアクションバー（いいね、リポストボタンの横）にスコアバッジが表示されます。

スコアに応じて色分けされます：
| スコア | 色 | 意味 |
|--------|------|------|
| 50以上 | 赤オレンジ | バイラル級 |
| 20以上 | 緑 | 高エンゲージメント |
| 10以上 | 青 | 中程度 |
| 10未満 | グレー | 低エンゲージメント |

### 詳細ポップアップ
バッジをクリックすると、以下の情報を含む詳細ポップアップが表示されます：

- **Engagement**: 実際のエンゲージメント数値
- **Content Analysis**: ツイート内容の分析結果
- **Score Breakdown**: スコア計算の内訳

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

3. **バッジをクリック**すると、詳細な分析ポップアップが表示されます

4. スクロールすると新しいツイートにも自動的にスコアが付与されます

## アルゴリズムについて

このツールは[xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)で公開されているXの「For You」フィードアルゴリズムの概要に基づいています。

### スコア計算式

```
Final Score = Σ (weight_i × P(action_i)) × multiplier
```

### アクション重み付け

| アクション | 重み | 説明 |
|-----------|------|------|
| いいね (favorite) | 1.0 | 基本的なエンゲージメント |
| 返信 (reply) | 11.0 | 会話を生むコンテンツとして高評価 |
| リポスト (repost) | 20.0 | 拡散力の指標 |
| 引用 (quote) | 30.0 | 最も価値のあるエンゲージメント |
| フォロー | 50.0 | 新規フォロワー獲得 |

### ネガティブアクション（ペナルティ）

| アクション | 重み |
|-----------|------|
| 興味なし | -100 |
| ミュート | -300 |
| ブロック | -500 |
| 報告 | -1000 |

### コンテンツ品質ボーナス

- **最適な文字数** (50-200文字): x1.2
- **質問形式**: x1.15
- **ハッシュタグ** (1-2個): x1.1
- **画像付き**: x1.3
- **動画付き**: x1.5
- **高エンゲージメント率** (>5%): x1.5

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

- このツールのスコアは推定値であり、実際のXアルゴリズムの内部スコアとは異なる場合があります
- Xのアルゴリズムは随時更新されるため、計算結果が実際のパフォーマンスと異なる可能性があります
- 個人利用・教育目的でお使いください

## 貢献

プルリクエストやイシューの報告を歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)をご覧ください。

## 関連リンク

- [X Algorithm (xai-org)](https://github.com/xai-org/x-algorithm) - 公式アルゴリズム概要
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)

---

Made with curiosity about how social media algorithms work.
