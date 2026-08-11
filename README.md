# test-claude-code

## note-writer

note.comの特定タグから直近30日の高評価記事を集め、8観点で採点し、
本文を保存せず抽象化した「型」だけを残して、そこから新しい記事を書き
2回自己レビューするパイプラインツール。`note_writer/` 以下に実装されている。

### パイプライン

1. **集める** (`note_writer/collector.py`)
   - `note.com/hashtag/{tag}` から直近30日分の記事を収集
   - 各URLは `robots.txt` で許可されている場合のみ対象 (取得できない場合は
     許可しない側に倒す fail-closed。`note_writer/robots.py`)
   - 同一URLの再取得は6時間以上空ける (`note_writer/fetch_state.py`)
   - そのタグに残った記事群の「スキ中央値」以上、かつ最低30スキ以上、の
     両方を満たす記事だけを残す (`note_writer/filters.py`)

2. **共通点を出す** (`note_writer/scorer.py`, `note_writer/patterns.py`)
   - 残った記事をフック/課題設定/具体性/信頼性/構成/読みやすさ/実行可能性/
     独自性の8観点で0〜10点採点 (LLM呼び出し)
   - 合計60点以上の記事だけ、本文から「型」(抽象化した構造パターン)を
     抽出してSQLiteに保存
   - 本文そのものは一切保存しない。`Pattern` データクラスに本文用の
     フィールドは存在せず、さらに各フィールドは400文字を超えると
     `PatternValidationError` で保存を拒否する二重の防御になっている

3. **書く** (`note_writer/writer.py`)
   - 保存した型の上位N件を渡して記事本文を執筆
   - 自分で読み直して直す、を2回繰り返す(批評→修正のパスを2周)
   - 使った型のID一覧を返す

4. **記録する** (`note_writer/usage_tracker.py`)
   - 公開した記事IDと使用した型のIDを記録
   - 公開後のスキ数を時系列で追記し、あとで型ごとの成果を分析できるようにする

### 使い方

```bash
pip install -e ".[llm]"   # requests + anthropic
export ANTHROPIC_API_KEY=...

# 1. 集める
note-writer collect --tag Python > articles.json

# 2. 共通点を出す(スコアリング + 型の抽出・保存)
note-writer distill --tag Python --input articles.json

# 3. 書く(型を渡して執筆 + 2パス自己レビュー)
note-writer write --tag Python --topic "初心者向けの型テクニック" > draft.md

# 4. 公開後の記録
note-writer record-likes --article-id art001 --publish \
  --topic "初心者向けの型テクニック" --url https://note.com/me/n/xxxx \
  --pattern "Python:abc123,Python:def456"
note-writer record-likes --article-id art001 --likes 42
```

状態(6時間間隔の記録・保存した型・公開記録)は既定で `./data/` 配下に
JSON/SQLiteとして保存される (`--data-dir` で変更可能)。

### 既知の制約

- `note_writer/note_client.py` の `HttpNoteClient` は、note.comのハッシュ
  タグページに埋め込まれた `__NEXT_DATA__` JSON を解析する実装になって
  いるが、実際のキー構造(`DEFAULT_NOTE_LIST_PATHS` / `DEFAULT_BODY_PATHS`)
  は本番のnote.comページに対して未検証。この開発環境からはnote.comへの
  外部通信が許可されておらず確認できなかったため、実運用前に実際の
  ページのJSON構造を確認し、必要であれば `note_list_extractor` /
  `body_extractor` を差し替えること。
- スコアリング・型抽出・執筆・自己レビューはすべてLLM呼び出し
  (`note_writer/llm.py` の `LLMClient` インターフェース) に委譲している。
  既定実装はAnthropic API (`ANTHROPIC_API_KEY` が必要)。

### テスト

```bash
pip install -e ".[dev]"
python -m pytest
```

ロボッツ規則・6時間間隔・中央値/下限フィルタ・8軸採点のバリデーション・
型ストアが本文を一切保持しないこと・2パス自己レビュー・記録の永続化・
パイプライン全体の結合、をそれぞれユニットテストとしてカバーしている
(すべてフェイクのLLM/HTTPクライアントで、外部通信なしに実行可能)。
