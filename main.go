package main

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type FolderRule struct {
	Topic      string
	Case       string
	Department string
	Author     string
	NewsType   string
}

var folderRules map[string]FolderRule

func main() {
	// اگر کاربر هیچ دستوری وارد نکرد (مثلاً دابل‌کلیک روی exe)،
	// به‌طور پیش‌فرض "serve" را اجرا کن تا PocketBase بالا بیاید.
	if len(os.Args) == 1 {
		os.Args = append(os.Args, "serve")
	}

	app := pocketbase.New()
	baseDir := "./import_files"

	// مسیر فایل CSV قوانین
	csvPath := filepath.Join(baseDir, "logic.csv")

	var err error
	folderRules, err = loadFolderRulesFromCSV(csvPath)
	if err != nil {
		log.Fatalf("❌ خطا در بارگذاری فایل قوانین (%s): %v", csvPath, err)
	}
	log.Printf("✅ %d قانون از فایل CSV بارگذاری شد.", len(folderRules))
	debugFolderMatching(baseDir)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		go func() {
			time.Sleep(2 * time.Second)
			log.Println("=========================================")
			log.Println("شروع عملیات ورود انبوه و سازماندهی فایل‌ها...")
			log.Println("=========================================")

			processImportDirectories(app, baseDir)
		}()
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// ============================================================
// processImportDirectories - پیمایش پوشه‌ها و پردازش فایل‌ها
// ============================================================
func processImportDirectories(app *pocketbase.PocketBase, baseDir string) {
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		log.Printf("خطا در خواندن پوشه اصلی: %v", err)
		return
	}

	totalSuccess := 0
	totalFailed := 0

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		folderName := entry.Name()
		rule, exists := folderRules[folderName]
		if !exists {
			log.Printf("⚠️ پوشه [%s] در جدول قوانین نیست؛ نادیده گرفته شد.", folderName)
			continue
		}

		folderPath := filepath.Join(baseDir, folderName)

		yesDir := filepath.Join(folderPath, "yes")
		noDir := filepath.Join(folderPath, "no")
		os.MkdirAll(yesDir, os.ModePerm)
		os.MkdirAll(noDir, os.ModePerm)

		files, err := os.ReadDir(folderPath)
		if err != nil {
			log.Printf("خطا در خواندن پوشه %s: %v", folderName, err)
			continue
		}

		var errorLogs []string

		for _, file := range files {
			if file.IsDir() {
				continue
			}

			ext := strings.ToLower(filepath.Ext(file.Name()))
			if ext != ".docx" && ext != ".doc" {
				continue
			}

			filePath := filepath.Join(folderPath, file.Name())

			err := processSingleFile(app, filePath, rule)

			if err == nil {
				destPath := filepath.Join(yesDir, file.Name())
				os.Rename(filePath, destPath)
				totalSuccess++
				log.Printf("✅ موفق: %s -> yes/", file.Name())
			} else {
				destPath := filepath.Join(noDir, file.Name())
				os.Rename(filePath, destPath)
				totalFailed++

				logMsg := fmt.Sprintf("[%s] فایل: %s | علت خطا: %v", time.Now().Format("15:04:05"), file.Name(), err)
				errorLogs = append(errorLogs, logMsg)
				log.Printf("❌ خطا: %s -> no/ (%v)", file.Name(), err)
			}
		}

		if len(errorLogs) > 0 {
			logFilePath := filepath.Join(noDir, "error_log.txt")
			f, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
			if err == nil {
				for _, l := range errorLogs {
					f.WriteString(l + "\n")
				}
				f.Close()
			}
		}
	}

	log.Println("=========================================")
	log.Printf("پایان فرآیند! کل فایل‌های موفق: %d | کل فایل‌های ناموفق: %d", totalSuccess, totalFailed)
	log.Println("=========================================")
}

// ============================================================
// debugFolderMatching - فقط برای عیب‌یابی تطبیق نام‌ها
// ============================================================
func debugFolderMatching(baseDir string) {
	log.Println("========= 🔍 دیباگ تطبیق نام پوشه‌ها و CSV =========")

	// چاپ تمام کلیدهای CSV با byte representation
	log.Println("📄 کلیدهای موجود در CSV:")
	for k := range folderRules {
		log.Printf("  CSV Key: [%s] | len=%d | hex=% x", k, len(k), []byte(k))
	}

	// چاپ نام پوشه‌های موجود
	entries, _ := os.ReadDir(baseDir)
	log.Println("📁 نام پوشه‌های موجود در import_files:")
	for _, e := range entries {
		if e.IsDir() {
			log.Printf("  Folder:  [%s] | len=%d | hex=% x", e.Name(), len(e.Name()), []byte(e.Name()))
		}
	}

	log.Println("=======================================================")
}

// ============================================================
// processSingleFile - پردازش یک فایل Word و ثبت رکورد در PocketBase
// ============================================================
func processSingleFile(app *pocketbase.PocketBase, filePath string, rule FolderRule) error {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return err
	}
	modTime := fileInfo.ModTime()

	htmlContent, err := extractTextFromDocx(filePath)
	if err != nil {
		return fmt.Errorf("استخراج متن ناموفق بود: %w", err)
	}

	lines := strings.Split(htmlContent, "\n")
	cleanTitle := "بدون عنوان"
	reStripTags := regexp.MustCompile("<[^>]*>")

	for _, l := range lines {
		plainText := strings.TrimSpace(reStripTags.ReplaceAllString(l, ""))
		if plainText != "" {
			sanitized := sanitizeTitle(plainText)
			if sanitized != "" {
				cleanTitle = sanitized
				break
			}
		}
	}

	topicID, err := getOrCreateRecord(app, "topics", "title", rule.Topic)
	if err != nil {
		return fmt.Errorf("خطا در ثبت Topic: %w", err)
	}

	caseID, err := getOrCreateRecord(app, "cases", "title", rule.Case)
	if err != nil {
		return fmt.Errorf("خطا در ثبت Case: %w", err)
	}

	depID, err := getDepartmentUserID(app, rule.Department)
	if err != nil {
		return fmt.Errorf("خطا در یافتن دپارتمان (%s): %w", rule.Department, err)
	}

	authorID, err := getAuthorUserID(app, rule.Author, depID)
	if err != nil {
		return fmt.Errorf("خطا در تعیین نویسنده (%s): %w", rule.Author, err)
	}

	randomSuffix := make([]byte, 3)
	rand.Read(randomSuffix)
	automationID := fmt.Sprintf("BULK-%s-%s", modTime.Format("20060102-150405"), hex.EncodeToString(randomSuffix))

	collection, err := app.FindCollectionByNameOrId("reports")
	if err != nil {
		return err
	}

	record := core.NewRecord(collection)
	record.Set("title", cleanTitle)
	record.Set("content", htmlContent)
	record.Set("abstract", cleanTitle)

	formattedModTime := modTime.UTC().Format("2006-01-02 15:04:05.000Z")
	record.Set("occurrence_date", formattedModTime)
	record.Set("created", formattedModTime)
	record.Set("automation_id", automationID)
	record.Set("topics_rel", []string{topicID})
	record.Set("cases_rel", []string{caseID})
	record.Set("department", depID)
	record.Set("author", authorID)
	record.Set("news_type", rule.NewsType)
	record.Set("classification", "سری")
	record.Set("priority", "فوری")
	record.Set("evaluation", "صحت دارد")
	record.Set("version", 1)

	return app.Save(record)
}

// ============================================================
// loadFolderRulesFromCSV - خواندن قوانین از CSV (با پشتیبانی از کاما و Tab)
// ============================================================
func loadFolderRulesFromCSV(csvPath string) (map[string]FolderRule, error) {
	raw, err := os.ReadFile(csvPath)
	if err != nil {
		return nil, fmt.Errorf("خطا در خواندن فایل CSV: %w", err)
	}

	// حذف BOM UTF-8 در صورت وجود (فایل‌های ذخیره‌شده در Excel)
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})

	// تابع کمکی برای پارس با جداکننده دلخواه
	parse := func(comma rune) ([][]string, error) {
		r := csv.NewReader(bytes.NewReader(raw))
		r.Comma = comma
		r.FieldsPerRecord = -1
		r.TrimLeadingSpace = true
		r.LazyQuotes = true
		return r.ReadAll()
	}

	// تلاش اول: کاما
	records, err := parse(',')
	// اگر خطا داشت یا ستون‌ها کمتر از ۳ بود، با Tab امتحان کن
	if err != nil || len(records) == 0 || (len(records) > 0 && len(records[0]) < 3) {
		log.Println("ℹ️ تلاش مجدد برای خواندن CSV با جداکننده Tab...")
		records, err = parse('\t')
		if err != nil {
			return nil, fmt.Errorf("خطا در خواندن CSV (هم با کاما و هم با Tab): %w", err)
		}
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("فایل CSV خالی است یا فقط هدر دارد")
	}

	rules := make(map[string]FolderRule)

	for i, row := range records {
		if len(row) == 0 {
			continue
		}

		// پاک‌سازی هر سلول: حذف فاصله اضافی و BOM
		for j := range row {
			row[j] = strings.TrimSpace(strings.TrimPrefix(row[j], "\ufeff"))
		}

		// رد کردن هدر (خط اول)
		if i == 0 {
			first := strings.ToLower(row[0])
			if strings.Contains(first, "folder") ||
				strings.Contains(first, "پوشه") ||
				strings.Contains(first, "نام") ||
				first == "name" {
				continue
			}
		}

		// رد کردن خطوط خالی
		if row[0] == "" {
			continue
		}

		getCol := func(idx int) string {
			if idx < len(row) && row[idx] != "" {
				return row[idx]
			}
			return "نامشخص"
		}

		folderName := row[0]
		rules[folderName] = FolderRule{
			Topic:      getCol(1),
			Case:       getCol(2),
			Department: getCol(3),
			Author:     getCol(4),
			NewsType:   normalizeNewsType(getCol(5)), // ← نرمال‌سازی
		}
	}

	return rules, nil
}

// ============================================================
func getDepartmentUserID(app *pocketbase.PocketBase, deptCode string) (string, error) {
	record, err := app.FindFirstRecordByFilter(
		"users",
		"role = 'department' && (dept_code = {:code} || user_code = {:code} || name = {:code})",
		dbx.Params{"code": deptCode},
	)
	if err != nil || record == nil {
		record, err = app.FindFirstRecordByFilter(
			"users",
			"dept_code = {:code} || user_code = {:code} || name = {:code}",
			dbx.Params{"code": deptCode},
		)
	}

	if err == nil && record != nil {
		return record.Id, nil
	}

	return "", fmt.Errorf("کاربر دپارتمان با کد یا نام '%s' در سیستم یافت نشد", deptCode)
}

func getAuthorUserID(app *pocketbase.PocketBase, authorName string, departmentUserID string) (string, error) {
	// 1. جستجو بر اساس username یا name
	record, err := app.FindFirstRecordByFilter(
		"users",
		"username = {:name} || name = {:name}",
		dbx.Params{"name": authorName},
	)
	if err == nil && record != nil {
		// ✅ تنظیم department_rel بر اساس ID دپارتمان (اسلایس)
		if departmentUserID != "" {
			record.Set("department_rel", []string{departmentUserID})
			if saveErr := app.Save(record); saveErr != nil {
				log.Printf("⚠️ هشدار: خطا در بروزرسانی department_rel کاربر %s: %v", authorName, saveErr)
			}
		}
		return record.Id, nil
	}

	// 2. در صورت عدم وجود، دریافت مجموعه users
	collection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return "", err
	}

	// 3. تولید username یکتا
	randomBuf := make([]byte, 3)
	rand.Read(randomBuf)
	genUsername := fmt.Sprintf("user_%s_%d", hex.EncodeToString(randomBuf), time.Now().Unix())

	// 4. محاسبه user_code جدید
	var maxCode int
	err = app.DB().Select("COALESCE(MAX(CAST(user_code AS INTEGER)), 900)").
		From("users").
		Where(dbx.NewExp("user_code GLOB '[0-9]*'")).
		Row(&maxCode)

	if err != nil || maxCode < 900 {
		maxCode = 900
	}
	nextUserCode := fmt.Sprintf("%d", maxCode+1)

	// 5. ساخت رکورد کاربر جدید
	newRecord := core.NewRecord(collection)
	newRecord.Set("name", authorName)
	newRecord.Set("username", genUsername)
	newRecord.Set("user_code", nextUserCode)
	newRecord.Set("role", "expert")
	newRecord.SetPassword("123456789")

	// ✅ تنظیم department_rel همان لحظه که رکورد ساخته می‌شود
	if departmentUserID != "" {
		newRecord.Set("department_rel", []string{departmentUserID})
	}

	err = app.Save(newRecord)
	if err != nil {
		// تلاش مجدد با fallbackCode
		fallbackCode := fmt.Sprintf("%d", time.Now().UnixNano()%899999+100000)
		newRecord.Set("user_code", fallbackCode)
		err = app.Save(newRecord)
		if err != nil {
			return "", fmt.Errorf("خطا در ایجاد کاربر نویسنده جدید: %w", err)
		}
	}

	return newRecord.Id, nil
}

// ============================================================
// sanitizeTitle - حذف عبارات ابتدایی مذهبی از عنوان
// ============================================================
func sanitizeTitle(text string) string {
	pattern := `(?i)^(بسمه تعالی|بسم الله الرحمن الرحیم|به نام خدا|بسمه‌تعالی|باسمه تعالی)[\s:\-,،]*`

	re := regexp.MustCompile(pattern)

	result := text
	for {
		cleaned := re.ReplaceAllString(result, "")
		if cleaned == result {
			break
		}
		result = cleaned
	}

	return strings.TrimSpace(result)
}

// ============================================================
// normalizeNewsType - نرمال‌سازی مقدار news_type
// مقادیر «25»، «اصل 25»، «اصل25»، «اصل ۲۵» → «خط»
// ============================================================
func normalizeNewsType(v string) string {
	// حذف فاصله اضافی
	v = strings.TrimSpace(v)

	// اگر خالی بود، مقدار پیش‌فرض
	if v == "" {
		return "خط"
	}

	// نرمال‌سازی اعداد فارسی/عربی به انگلیسی برای مقایسه
	normalized := v
	normalized = strings.ReplaceAll(normalized, "۲", "2")
	normalized = strings.ReplaceAll(normalized, "٢", "2")
	normalized = strings.ReplaceAll(normalized, "۵", "5")
	normalized = strings.ReplaceAll(normalized, "٥", "5")
	normalized = strings.ReplaceAll(normalized, "‌", "") // حذف نیم‌فاصله
	normalized = strings.ReplaceAll(normalized, " ", "") // حذف فاصله برای مقایسه

	// مقایسه با مقادیر معادل «اصل 25»
	switch normalized {
	case "25", "اصل25", "اصل٢٥", "اصل۲۵":
		return "خط"
	}

	// اگر «اصل 25» با فاصله بود
	if strings.Contains(v, "اصل") && strings.Contains(normalized, "25") {
		return "خط"
	}

	return v
}

// ============================================================
// extractTextFromDocx - استخراج متن و ساختار از فایل Word
// ============================================================
func extractTextFromDocx(filePath string) (string, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	var documentFile *zip.File
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			documentFile = f
			break
		}
	}

	if documentFile == nil {
		return "", fmt.Errorf("فایل ورد معتبر نیست یا شامل document.xml نمی‌باشد")
	}

	rc, err := documentFile.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(rc)

	decoder := xml.NewDecoder(buf)
	var mainBuilder strings.Builder

	inParagraph := false
	inRun := false
	inBold := false
	inItalic := false
	headingTag := "" // ذخیره تگ h1 تا h4

	inCell := false
	var currentRow []string
	var currentCell strings.Builder
	var paragraphBuilder strings.Builder

	for {
		t, tokenErr := decoder.Token()
		if tokenErr != nil {
			break
		}

		switch elem := t.(type) {
		case xml.StartElement:
			switch elem.Name.Local {
			case "tbl":
				mainBuilder.WriteString("<table border=\"1\" style=\"border-collapse: collapse; width: 100%;\">\n")
			case "tr":
				currentRow = []string{}
			case "tc":
				inCell = true
				currentCell.Reset()
			case "p":
				inParagraph = true
				paragraphBuilder.Reset()
				headingTag = ""
			case "pStyle":
				for _, attr := range elem.Attr {
					if attr.Name.Local == "val" {
						val := strings.ToLower(attr.Value)
						if strings.Contains(val, "heading") || strings.Contains(val, "1") || strings.Contains(val, "2") || strings.Contains(val, "3") {
							if strings.Contains(val, "1") {
								headingTag = "h1"
							} else if strings.Contains(val, "2") {
								headingTag = "h2"
							} else if strings.Contains(val, "3") {
								headingTag = "h3"
							} else {
								headingTag = "h4"
							}
						}
					}
				}
			case "r":
				inRun = true
				inBold = false
				inItalic = false
			case "b":
				inBold = true
			case "i":
				inItalic = true
			case "br":
				if inCell {
					currentCell.WriteString("<br>")
				} else {
					paragraphBuilder.WriteString("<br>")
				}
			}

		case xml.EndElement:
			switch elem.Name.Local {
			case "r":
				inRun = false
			case "p":
				inParagraph = false
				pText := strings.TrimSpace(paragraphBuilder.String())
				if pText != "" {
					var formattedP string
					if headingTag != "" {
						formattedP = fmt.Sprintf("<%s>%s</%s>\n", headingTag, pText, headingTag)
					} else {
						formattedP = fmt.Sprintf("<p>%s</p>\n", pText)
					}

					if inCell {
						currentCell.WriteString(formattedP)
					} else {
						mainBuilder.WriteString(formattedP)
					}
				}
			case "tc":
				inCell = false
				currentRow = append(currentRow, fmt.Sprintf("<td style=\"padding: 6px; border: 1px solid #ccc;\">%s</td>", strings.TrimSpace(currentCell.String())))
			case "tr":
				if len(currentRow) > 0 {
					mainBuilder.WriteString("  <tr>" + strings.Join(currentRow, "") + "</tr>\n")
				}
			case "tbl":
				mainBuilder.WriteString("</table>\n")
			}

		case xml.CharData:
			text := string(elem)
			if inRun && strings.TrimSpace(text) != "" {
				if inBold {
					text = "<b>" + text + "</b>"
				}
				if inItalic {
					text = "<i>" + text + "</i>"
				}
			}

			if inCell {
				currentCell.WriteString(text)
			} else if inParagraph {
				paragraphBuilder.WriteString(text)
			}
		}
	}

	extracted := strings.TrimSpace(mainBuilder.String())
	if extracted == "" {
		return "", fmt.Errorf("محتوای متنی داخل فایل یافت نشد")
	}

	return extracted, nil
}

// ============================================================
// getOrCreateRecord - یافتن یا ایجاد رکورد در یک مجموعه
// ============================================================
func getOrCreateRecord(app *pocketbase.PocketBase, collectionName, fieldName, value string) (string, error) {
	record, err := app.FindFirstRecordByData(collectionName, fieldName, value)
	if err == nil && record != nil {
		return record.Id, nil
	}

	collection, err := app.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return "", err
	}

	newRecord := core.NewRecord(collection)
	newRecord.Set(fieldName, value)
	err = app.Save(newRecord)
	if err != nil {
		return "", err
	}
	return newRecord.Id, nil
}
