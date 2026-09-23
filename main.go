package main

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
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

var folderRules = map[string]FolderRule{
	"ابطحی":                {"روحانیون سیاسی", "ابطحی", "70", "عمار", "خط"},
	"اسلو":                 {"موسسات", "اسلو", "60", "مهدی بصیر", "خط"},
	"امیری فر":             {"روحانیون سیاسی", "امیری فر", "70", "بهشتی", "خط"},
	"ایازی":                {"روحانیون سیاسی", "ایازی", "70", "بهشتی", "خط"},
	"ایرج":                 {"روحانیت شاخص", "ایرج", "60", "مصطفی غروی", "خط"},
	"آرش":                  {"موسسات", "آرش", "60", "مهدی بصیر", "خط"},
	"بهار":                 {"روحانیون سیاسی", "بهار", "70", "بهشتی", "خط"},
	"پژمان":                {"روحانیون سیاسی", "پژمان", "70", "سبحان", "محیط"},
	"تابان":                {"موسسات", "تابان", "60", "مهدی بصیر", "خط"},
	"جنت":                  {"روحانیت شاخص", "جنت", "50", "کمیل", "خط"},
	"جنگل":                 {"موسسات", "جنگل", "60", "شیرمردی", "محیط"},
	"دری":                  {"موسسات", "دری", "60", "شیرمردی", "محیط"},
	"یاسر":                 {"روحانیت شاخص", "یاسر", "50", "سید روح الله", "خط"},
	"حافظ":                 {"روحانیت شاخص", "حافظ", "50", "سید روح الله", "خط"},
	"حکمت":                 {"بین الملل", "حکمت", "60", "طالب", "خط"},
	"خلیل":                 {"روحانیت شاخص", "خلیل", "50", "مصطفی", "خط"},
	"اسفاروف":              {"بین الملل", "اسفاروف", "60", "حمد الله", "خط"},
	"اقبال":                {"روحانیت شاخص", "اقبال", "50", "سید روح الله", "خط"},
	"سراب":                 {"موسسات", "سراب", "60", "مرتضی آیت", "محیط"},
	"سرائر":                {"بین الملل", "سرائر", "60", "طالب", "خط"},
	"سیامک":                {"موسسات", "سیامک", "60", "مهدی بصیر", "خط"},
	"سید مهدی شهرستانی":    {"روحانیون سیاسی", "سید مهدی شهرستانی", "70", "جابر", "محیط"},
	"شریف":                 {"روحانیون سیاسی", "شریف", "70", "سید محمود", "خط"},
	"شورا":                 {"موسسات", "شورا", "60", "مجتبی صادقی", "محیط"},
	"صفر":                  {"موسسات", "صفر", "60", "حاج اسدالله", "محیط"},
	"صفین":                 {"روحانیون سیاسی", "صفین", "60", "ابوالفضل", "محیط"},
	"عشقعلی":               {"روحانیت شاخص", "عشقعلی", "50", "امیرحسین مصباح", "خط"},
	"غلام":                 {"روحانیت شاخص", "غلام", "50", "صادق", "خط"},
	"قابل":                 {"روحانیون سیاسی", "قابل", "70", "بهشتی", "خط"},
	"قربان":                {"موسسات", "قربان", "60", "مصطفی غروی", "خط"},
	"مازنی":                {"روحانیت شاخص", "مازنی", "70", "بهشتی", "خط"},
	"محفل":                 {"روحانیون سیاسی", "محفل", "70", "حسین اسدی", "محیط"},
	"مدینه":                {"روحانیت شاخص", "مدینه", "50", "غروی", "خط"},
	"مسیح":                 {"روحانیون سیاسی", "مسیح", "70", "عمار", "خط"},
	"ممتاز":                {"موسسات", "ممتاز", "60", "مهدی بصیر", "محیط"},
	"منتجب":                {"روحانیون سیاسی", "منتجب", "70", "بهشتی", "خط"},
	"منصور":                {"روحانیت شاخص", "منصور", "60", "سید محمود", "خط"},
	"ناظم":                 {"روحانیت شاخص", "ناظم", "50", "سید محمود", "خط"},
	"نجف":                  {"روحانیون سیاسی", "نجف", "50", "زمانی", "محیط"},
	"نصوص":                 {"بین الملل", "نصوص", "60", "علوی", "محیط"},
	"نواب":                 {"موسسات", "نواب", "60", "فاضل", "خط"},
	"واسع":                 {"بین الملل", "واسع", "60", "مصطفی غروی", "خط"},
	"هم نوا":               {"موسسات", "هم نوا", "60", "مرتضی آیت", "خط"},
	"صلواتی":               {"روحانیون سیاسی", "صلواتی", "70", "زمانی", "خط"},
	"پدرام":                {"موسسات", "پدرام", "60", "مهدی بصیر", "خط"},
	"میرزا":                {"روحانیون سیاسی", "میرزا", "60", "حسین اسدی", "خط"},
	"سینا":                 {"موسسات", "سینا", "60", "مهدی بصیر", "خط"},
	"بازرس":                {"روحانیون سیاسی", "بازرس", "70", "نامشخص", "خط"},
	"حاضری":                {"روحانیون سیاسی", "حاضری", "70", "نامشخص", "خط"},
	"دردکشان":              {"روحانیون سیاسی", "دردکشان", "نامشخص", "نامشخص", "خط"},
	"سراج":                 {"روحانیون سیاسی", "سراج", "نامشخص", "نامشخص", "خط"},
	"سعیدیان":              {"روحانیون سیاسی", "سعیدیان", "نامشخص", "نامشخص", "خط"},
	"سید ابوالفضل موسویان": {"روحانیون سیاسی", "موسویان", "نامشخص", "نامشخص", "خط"},
	"طوسی":                 {"موسسات", "طوسی", "60", "مهدی بصیر", "خط"},
	"محلوجی":               {"نامشخص", "محلوجی", "نامشخص", "نامشخص", "خط"},
	"منتظر القائم":         {"روحانیون سیاسی", "منتظر القائم", "نامشخص", "نامشخص", "خط"},
	"شیخ رباط":             {"نامشخص", "شیخ رباط", "نامشخص", "نامشخص", "خط"},
}

func main() {
	// اگر کاربر هیچ دستوری وارد نکرد (مثلاً دابل‌کلیک روی exe)،
	// به‌طور پیش‌فرض "serve" را اجرا کن تا PocketBase بالا بیاید.
	if len(os.Args) == 1 {
		os.Args = append(os.Args, "serve")
	}

	app := pocketbase.New()
	baseDir := "./import_files"

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

	// استخراج عنوان از اولین پاراگراف یا تیتر تولیدشده
	lines := strings.Split(htmlContent, "\n")
	cleanTitle := "بدون عنوان"

	// پاک‌سازی تگ‌های HTML برای به‌دست آوردن عنوان متنی ساده (Clean Title)
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

	// استخراج یا ایجاد رکورد موضوع (Topic)
	topicID, err := getOrCreateRecord(app, "topics", "title", rule.Topic)
	if err != nil {
		return fmt.Errorf("خطا در ثبت Topic: %w", err)
	}

	// استخراج یا ایجاد رکورد پرونده (Case)
	caseID, err := getOrCreateRecord(app, "cases", "title", rule.Case)
	if err != nil {
		return fmt.Errorf("خطا در ثبت Case: %w", err)
	}

	// استخراج ID دپارتمان از جدول users بر اساس dept_code یا user_code با نقش department
	depID, err := getDepartmentUserID(app, rule.Department)
	if err != nil {
		return fmt.Errorf("خطا در یافتن دپارتمان (%s): %w", rule.Department, err)
	}

	// استخراج یا ایجاد نویسنده (Author)
	authorID, err := getAuthorUserID(app, rule.Author)
	if err != nil {
		return fmt.Errorf("خطا در تعیین نویسنده (%s): %w", rule.Author, err)
	}

	// تولید شناسه اتوماسیون یکتا جهت جلوگیری از تداخل با ایندکس UNIQUE
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

	// تبدیل تاریخ وقوع/تغییر فایل به فرمت استاندارد UTC برای PocketBase
	formattedModTime := modTime.UTC().Format("2006-01-02 15:04:05.000Z")

	record.Set("occurrence_date", formattedModTime)
	record.Set("created", formattedModTime) // تنظیم تاریخ ثبت رکورد معادل تاریخ وقوع/فایل
	record.Set("automation_id", automationID)

	// اصلاح مهم: ارسال اسلایس متنی به دلیل maxSelect: 10 در اسکیما
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
		// مقداردهی یا بروزرسانی department_rel بر اساس مقدار department کاربر
		deptVal := record.GetString("department")
		if deptVal != "" && (record.GetString("department_rel") == "" || record.GetString("department_rel") != deptVal) {
			record.Set("department_rel", deptVal)
			_ = app.Save(record)
		}
		return record.Id, nil
	}

	return "", fmt.Errorf("کاربر دپارتمان با کد یا نام '%s' در سیستم یافت نشد", deptCode)
}

func getAuthorUserID(app *pocketbase.PocketBase, authorName string) (string, error) {
	// 1. جستجو بر اساس username یا name
	record, err := app.FindFirstRecordByFilter(
		"users",
		"username = {:name} || name = {:name}",
		dbx.Params{"name": authorName},
	)
	if err == nil && record != nil {
		// مقداردهی یا بروزرسانی department_rel بر اساس مقدار department کاربر
		deptVal := record.GetString("department")
		if deptVal != "" && (record.GetString("department_rel") == "" || record.GetString("department_rel") != deptVal) {
			record.Set("department_rel", deptVal)
			_ = app.Save(record)
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

	// 4. محاسبه user_code جدید به صورت خودکار (پیدا کردن بزرگترین user_code عددی موجود)
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
	newRecord.SetPassword("123456789") // حداقل ۸ کاراکتر طبق اسکیما

	err = app.Save(newRecord)
	if err != nil {
		// اگر به هر دلیلی باز هم تداخل کد رخ داد، یک شناسه بر اساس نانوسانیه ثبت کن
		fallbackCode := fmt.Sprintf("%d", time.Now().UnixNano()%899999+100000)
		newRecord.Set("user_code", fallbackCode)
		err = app.Save(newRecord)
		if err != nil {
			return "", fmt.Errorf("خطا در ایجاد کاربر نویسنده جدید: %w", err)
		}
	}

	// اگر هنگام ایجاد کاربر جدید فیلد department تنظیم شد، فیلد department_rel را هم ست کنید
	deptVal := newRecord.GetString("department")
	if deptVal != "" {
		newRecord.Set("department_rel", deptVal)
		_ = app.Save(newRecord)
	}

	return newRecord.Id, nil
}

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

	// inTable := false
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
