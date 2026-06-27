# Requirements Document

## Introduction

`office-lunch` は、日々のランチ内容・費用・写真を日付ごとに記録する個人利用向け React Web アプリケーションです。カレンダービューから任意の日付を選択し、ランチ記録の作成・確認・編集・削除を行えます。月間コスト概算や店別集計を通じて、食費の振り返りや再訪判断の材料を提供します。データはブラウザ内（IndexedDB）に保存され、バックエンドや認証機能は持ちません。

## Glossary

- **App**: office-lunch アプリケーション全体
- **Calendar**: 月単位でランチ記録の有無を視覚的に示し、日付選択を可能にするUIコンポーネント
- **LunchRecord**: 1件のランチ記録。日付・カテゴリ・メニュー・店・食事代・評価・写真・メモを持つ
- **LunchCategory**: ランチのカテゴリ。`eat_out`（外食）・`takeout`（購入）・`home`（自炊）の3種類
- **Shop**: 店舗情報。名称と一意のIDを持つ
- **Rating**: 1〜5の整数で表すランチの評価。未評価は `0` または未定義として扱う
- **Cost**: ランチ1回分の食事代（円、整数）。未入力も許容する
- **MonthlySummary**: 表示中の月に記録された食事代の合計・件数・平均単価
- **ShopStats**: 店ごとの利用回数・平均評価・平均食事代の集計情報
- **Storage**: IndexedDB（`office-lunch-db` v2）を使ったブラウザ内ローカルストレージ層
- **RecordForm**: ランチ記録の作成・編集フォームコンポーネント（現在 App.tsx に統合）

## Implementation Notes

現在の実装状況（2026年6月時点）：

- すべての機能が `src/App.tsx` 単一コンポーネントに実装されている。コンポーネント分割（`src/components/`）は未実施
- スタイルは `src/styles.css` に記述。`src/style/` ディレクトリへの移動は未実施
- 写真はリサイズ・圧縮なしで Base64 DataURL として IndexedDB に保存される
- 削除操作は確認ダイアログなしで即時実行される
- カテゴリのデフォルト値は `eat_out`（外食）
- 集計で Cost が `0` の記録は未入力扱いとして合計・平均から除外される
- 店別集計の平均評価が `0` の場合は「-」ではなく `0 / 5` 相当の数値として保持される（表示は `averageRating` が truthy のときのみ `X / 5` を出力）

---

## Requirements

### Requirement 1: カレンダービュー表示

**User Story:** 個人利用者として、月単位のカレンダーを見て任意の日付を選択したい。そうすることで、その日のランチ記録をすばやく確認・操作できる。

#### Acceptance Criteria

1. WHEN App が起動したとき、THE Calendar SHALL 現在の年月を表示した状態でカレンダーを画面に表示する（6週×7日 = 42マスの固定グリッド）
2. WHEN ユーザーがカレンダー上の日付をタップまたはクリックしたとき、THE Calendar SHALL その日付を選択状態にしてハイライト表示し、表示月をその日付の月に更新する
3. WHEN ユーザーが「←」ボタンを操作したとき、THE Calendar SHALL 表示月を1ヶ月前に切り替える
4. WHEN ユーザーが「→」ボタンを操作したとき、THE Calendar SHALL 表示月を1ヶ月後に切り替える
5. WHILE ある日付に LunchRecord が1件以上存在するとき、THE Calendar SHALL そのカテゴリに応じた色（eat_out: 赤、takeout: 青、home: 緑）のドットマーカーをセル右下に表示する
6. WHEN ユーザーが日付を選択したとき、THE App SHALL 選択日付に紐づく LunchRecord の内容をフォームに反映して表示する
7. WHEN ユーザーが LunchRecord が存在しない日付を選択したとき、THE App SHALL 空のフォームを表示し「まだ記録がありません。」と案内する
8. THE Calendar SHALL 「今日」ボタンを表示し、クリック時に表示月と選択日を今日の日付に戻す

---

### Requirement 2: ランチ記録の作成

**User Story:** 個人利用者として、選択した日付にランチ記録を新規作成したい。そうすることで、その日の食事内容を記録として残せる。

#### Acceptance Criteria

1. WHEN ユーザーが LunchRecord が存在しない日付を選択したとき、THE RecordForm SHALL カテゴリが `eat_out` に設定された空の入力フォームを表示する
2. WHEN ユーザーがフォームを送信したとき、THE App SHALL LunchRecord を Storage に保存する
3. WHEN LunchRecord の保存が完了したとき、THE Calendar SHALL 該当日付にカテゴリ色のドットマーカーを追加表示する
4. THE LunchRecord SHALL `date`・`category` の2項目を必須フィールドとして持つ
5. THE LunchRecord SHALL `menuName`・`shopId`・`shopName`・`cost`・`rating`・`photo`・`memo` を任意フィールドとして持つ
6. WHEN 保存が成功したとき、THE App SHALL 「保存しました。」のステータスメッセージを表示する

---

### Requirement 3: ランチ記録の編集

**User Story:** 個人利用者として、既存のランチ記録を編集したい。そうすることで、入力内容を後から修正できる。

#### Acceptance Criteria

1. WHEN ユーザーが既存の LunchRecord を持つ日付を選択したとき、THE RecordForm SHALL `category`・`menuName`・`shopId`・`shopName`・`cost`・`rating`・`photo`・`memo` の既存値をフォームに反映して表示する
2. WHEN ユーザーが編集後にフォームを送信したとき、THE App SHALL Storage 内の該当 LunchRecord を更新し `updatedAt` を現在日時で更新する
3. WHEN LunchRecord の更新が完了したとき、THE App SHALL フォームの表示内容に更新後の内容を反映する
4. WHEN LunchRecord の更新が完了したとき、THE Calendar SHALL 該当日付のドットマーカーのカテゴリ色を更新後のカテゴリに合わせて更新する
5. WHEN 更新が成功したとき、THE App SHALL 「保存しました。」のステータスメッセージを表示する

---

### Requirement 4: ランチ記録の削除

**User Story:** 個人利用者として、誤って登録したランチ記録を削除したい。そうすることで、不要なデータを取り除ける。

#### Acceptance Criteria

1. WHILE 選択日付に LunchRecord が存在するとき、THE RecordForm SHALL 「削除」ボタンを表示する
2. WHEN ユーザーが「削除」ボタンをクリックしたとき、THE App SHALL 確認なしで Storage から該当の LunchRecord を即時削除する
3. WHEN LunchRecord の削除が完了したとき、THE Calendar SHALL 該当日付のドットマーカーを消去する
4. WHEN 削除が成功したとき、THE App SHALL 「削除しました。」のステータスメッセージを表示する
5. IF Storage からの削除操作が失敗したとき、THEN THE App SHALL 「削除に失敗しました。」のエラーメッセージを表示する

---

### Requirement 5: カテゴリ選択と店フォームの表示制御

**User Story:** 個人利用者として、カテゴリに応じて適切な入力フォームのみ表示されるようにしたい。そうすることで、無関係な入力欄が表示されず操作がシンプルになる。

#### Acceptance Criteria

1. WHEN ユーザーが LunchCategory として `eat_out` または `takeout` を選択したとき、THE RecordForm SHALL 店選択フォームを表示する
2. WHEN ユーザーが LunchCategory として `home` を選択したとき、THE RecordForm SHALL 店選択フォームを非表示にし、`shopId`・`newShopName`・`shopName` フィールドをクリアする
3. WHILE 店選択フォームが表示されているとき、THE RecordForm SHALL Storage に登録済みの Shop のドロップダウンと「新しい店を追加」オプションを表示する
4. WHEN ユーザーがドロップダウンで「新しい店を追加」を選択したとき、THE RecordForm SHALL 新規店名を入力するテキストフィールドを表示する
5. WHEN ユーザーが既存 Shop をドロップダウンで選択したとき、THE RecordForm SHALL 新規店名テキストフィールドを非表示にする
6. WHEN ユーザーが新規店名を入力して保存したとき、THE App SHALL 同名の Shop が Storage に存在しない場合にのみ新規 Shop として追加し、既存の場合は既存 Shop を使用する
7. IF `eat_out` または `takeout` カテゴリで「新しい店を追加」が選択されたまま新規店名が空文字のとき、THEN THE App SHALL 「外食・購入の場合は店名を入力してください。」と表示して保存を拒否する

---

### Requirement 6: 星評価の登録と表示

**User Story:** 個人利用者として、ランチを1〜5の星で評価したい。そうすることで、後から食事の満足度を直感的に確認できる。

#### Acceptance Criteria

1. WHILE RecordForm が表示されているとき、THE RecordForm SHALL 1〜5の★ボタンを並べた星評価UIを表示し、初期状態は未選択（`rating: 0`）とする
2. WHEN ユーザーが選択済みの星を再度クリックしたとき、THE RecordForm SHALL 評価を未選択（`rating: 0`）に戻す
3. THE LunchRecord SHALL `rating` が未定義（`undefined`）または `0` の状態を「未評価」として許容する
4. WHEN LunchRecord を表示するとき、THE RecordForm SHALL `rating` が `1` 以上の場合に対応する数の星を `filled`（オレンジ）で、残りを未選択色で表示する

---

### Requirement 7: 食事代の記録

**User Story:** 個人利用者として、食事代を数値で記録したい。そうすることで、月間のランチ費用を後から集計できる。

#### Acceptance Criteria

1. WHILE RecordForm が表示されているとき、THE RecordForm SHALL `type="number"` かつ `min="0"` の食事代入力フィールドを表示する
2. THE LunchRecord SHALL `cost` が未入力（`undefined`）の状態を許容する
3. IF `cost` フィールドに負の数値または非数値が入力されたとき、THEN THE App SHALL 「食事代は0以上の数値で入力してください。」と表示して保存を拒否する
4. THE App SHALL `cost` が `0` の記録を月間サマリーおよび店別集計の金額計算から除外する（未入力と同等に扱う）

---

### Requirement 8: 写真アップロードと表示

**User Story:** 個人利用者として、ランチの写真をアップロードして記録に添付したい。そうすることで、後から視覚的に食事内容を振り返れる。

#### Acceptance Criteria

1. WHILE RecordForm が表示されているとき、THE RecordForm SHALL `accept="image/*"` のファイル入力UIを表示する
2. WHEN ユーザーが画像ファイルを選択したとき、THE RecordForm SHALL `FileReader` API で Base64 DataURL に変換し、フォーム内にプレビュー画像を表示する
3. IF 選択ファイルの `type` が `image/` で始まらない場合、THEN THE App SHALL 「画像ファイルを選択してください。」と表示し写真を登録しない
4. WHEN LunchRecord を保存するとき、THE App SHALL 写真データ（`id`・`mimeType`・`dataUrl`）を LunchRecord の `photo` フィールドとして IndexedDB に保存する（圧縮・リサイズなし）
5. WHEN LunchRecord を表示するとき、THE App SHALL `photo` が存在する場合に `img` 要素でプレビュー表示し、「写真を削除」ボタンを表示する
6. WHEN ユーザーが「写真を削除」ボタンをクリックしたとき、THE RecordForm SHALL フォームの `photo` フィールドをクリアしプレビューを消去する
7. WHILE `photo` が未設定のとき、THE RecordForm SHALL 「写真未登録」のプレースホルダーを表示する

---

### Requirement 9: 月間コスト概算の表示

**User Story:** 個人利用者として、表示中の月のランチ代の合計・件数・平均単価を確認したい。そうすることで、月間の食費を手軽に把握できる。

#### Acceptance Criteria

1. WHILE Calendar が特定の年月を表示しているとき、THE App SHALL その月に属する LunchRecord のうち `cost` が `1` 以上のものの合計金額を MonthlySummary として日本円形式（`¥X,XXX`）で表示する
2. WHILE Calendar が特定の年月を表示しているとき、THE App SHALL その月の全 LunchRecord の件数を「X件」として表示する
3. WHILE Calendar が特定の年月を表示しているとき、THE App SHALL その月の `cost` が `1` 以上のレコードの平均金額（`Math.round` で四捨五入）を日本円形式で表示し、「金額入力あり X件」を補足表示する
4. WHEN 表示中の月に `cost` が `1` 以上の LunchRecord が0件のとき、THE App SHALL 合計金額および平均金額を `¥0` として表示する
5. WHEN ユーザーが表示月を切り替えたとき、THE App SHALL MonthlySummary を切り替え後の月のデータで再計算して即時更新する

---

### Requirement 10: 店別集計の表示

**User Story:** 個人利用者として、店ごとの利用回数・平均評価・平均食事代を確認したい。そうすることで、よく使う店やコスパの良い店を把握できる。

#### Acceptance Criteria

1. THE App SHALL `shopId` が設定されている全カテゴリの LunchRecord を集計対象として ShopStats を常時表示する
2. THE ShopStats SHALL 店ごとの集計対象レコード件数を「X回」として表示する
3. THE ShopStats SHALL 店ごとの `rating` が `1` 以上のレコードの平均値（小数点第1位、`Math.round(x * 10) / 10`）を「X / 5」として表示する
4. THE ShopStats SHALL 店ごとの `cost` が `1` 以上のレコードの平均値（`Math.round` で四捨五入）を日本円形式で表示する
5. WHEN 店の集計対象レコードに `rating` が `1` 以上のものが0件のとき、THE ShopStats SHALL 平均評価を「-」として表示する
6. WHEN 店の集計対象レコードに `cost` が `1` 以上のものが0件のとき、THE ShopStats SHALL 平均食事代を「-」として表示する
7. THE ShopStats SHALL 利用回数が `1` 以上の店のみを一覧に含め、利用回数の多い順・同数の場合は店名の日本語50音順で表示する
8. WHEN 集計対象となる店が0件のとき、THE App SHALL 「店を選んだ記録が入ると、ここに集計が表示されます。」を表示する

---

### Requirement 11: データの永続化

**User Story:** 個人利用者として、ブラウザを再読み込みしてもランチ記録が保持されるようにしたい。そうすることで、入力したデータが失われず継続して利用できる。

#### Acceptance Criteria

1. THE Storage SHALL LunchRecord を `lunch-records`（`date` フィールドに unique インデックス）、Shop を `shops`（`name` フィールドに unique インデックス）という独立したオブジェクトストアで IndexedDB（DB名: `office-lunch-db` v2）に保存する
2. WHEN App が起動したとき、THE App SHALL `getAllRecords()` と `getAllShops()` を並行実行して全データを読み込みアプリ状態を初期化する
3. THE Storage SHALL `getAllRecords`・`saveRecord`・`deleteRecord`・`getAllShops`・`saveShop` の5つの操作を提供する
4. WHEN App が起動したとき、THE App SHALL `shopId` が未設定かつ `shopName` が設定されている旧形式の LunchRecord を検出し、対応する Shop レコードを自動生成して `shopId` を付与するマイグレーションを実行する
5. IF Storage への書き込みが失敗したとき、THEN THE App SHALL 「保存に失敗しました。」のエラーメッセージを表示する
6. IF データ読み込みが失敗したとき、THEN THE App SHALL 「保存済みデータの読み込みに失敗しました。」のエラーメッセージを表示する

---

### Requirement 12: レスポンシブ対応

**User Story:** 個人利用者として、スマートフォンからでもアプリを操作したい。そうすることで、外出先でもランチ記録を手軽に入力できる。

#### Acceptance Criteria

1. WHILE 画面幅が 881px 以上のとき、THE App SHALL カレンダーとレコードパネルを2カラムで横並びに表示する
2. WHEN 画面幅が 880px 以下になったとき、THE App SHALL カレンダーとレコードパネルを縦方向に積み重ねた1カラムレイアウトに切り替え、月間サマリーを1カラムに変更する
3. WHEN 画面幅が 560px 以下になったとき、THE App SHALL カレンダーのパディングを縮小し、フォームの食事代・評価行を縦積みレイアウトに変更する
4. THE App SHALL 最小画面幅 320px でレイアウト崩れなく表示する
