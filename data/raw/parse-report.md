# 資料來源與解析報告

## 原始來源
- 《臺中市長億高中簡鈺珣：歷屆基測會考字形題總整理教師版.docx》（249 列）
- 《基測會考字音題總整理教師版.docx》（178 列）

原始檔存放於使用者本機 Downloads，未收錄進本 repo（皆為 Word 二進位檔）。
`xingxing_raw.json` / `yinyin_raw.json` 是逐列原樣抽取的乾淨文字（題目欄＋教師標註答案欄），
是後續一切結構化的唯一依據，任何解析腳本都不修改這兩份檔案。

## 解析流程
1. `scripts/parse_xingxing.py` / `scripts/parse_yinyin.py`：依「（年代-次-題號）」標籤把
   連續列分組（同一考題的甲乙丙丁分項），再依「「」括號數量＋答案格式」決定每個子題的
   呈現模式（`char`＝單一括號挑正確字、`reading`＝括號內為注音需選出對應漢字、
   `judge`＝整句無括號需先判斷對錯、有錯字再依序填入正確字）。
2. 249 列字形題 → 66 個題組（含 8 個格式不規則、走 judge-mode fallback 的題組，
   全部保留教師原答案文字，不猜測錯字在句中的確切位置）。
3. 178 列字音題 → 45 個題組，全數乾淨解析（含跨列分項題如 91-2-21、99-2-17）。
4. `scripts/merge.py`：合併兩批題組、指派穩定 id（`xf0001…`／`xy0001…`）、依年份
   （≤102＝基測，≥103＝會考）標記 level，**不修改任何 parts 內容**。
5. 誘答選項（`distractors`／`zhuyinDistractors`）由 7 個 subagent 分批產生（形近字／
   音近字，禁止與正解重複），輸出於 `distractors_char_batch_*.json` /
   `distractors_zhuyin_batch_*.json`，由 `scripts/merge_distractors.py` 併入，
   同樣不觸碰任何 `correct`/`correctZhuyin`/`answers` 欄位。
6. `scripts/validate.mjs` 為硬性關卡：檢查 id 唯一、level 合法、examTag 可解析、
   誘答選項齊全且不重複、judge 模式的錯誤子題有答案陣列、無簡體字殘留。

## 結果
- 427 列原始資料 → 111 個題組（`xf`×66、`xy`×45）→ 589 道可出題的子題
- `node scripts/validate.mjs` → 0 errors, 0 warnings, ALL CLEAN
