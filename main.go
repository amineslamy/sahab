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
	"ابطحی":                {"روحانیون سیاسی", "ابطحی", "70", "عمار", "اصل25"},
	"اسلو":                 {"موسسات", "اسلو", "60", "مهدی بصیر", "اصل25"},
	"امیری فر":             {"روحانیون سیاسی", "امیری فر", "70", "بهشتی", "اصل25"},
	"ایازی":                {"روحانیون سیاسی", "ایازی", "70", "بهشتی", "اصل25"},
	"ایرج":                 {"روحانیت شاخص", "ایرج", "60", "مصطفی غروی", "اصل25"},
	"آرش":                  {"موسسات", "آرش", "60", "مهدی بصیر", "اصل25"},
	"بهار":                 {"روحانیون سیاسی", "بهار", "70", "بهشتی", "اصل25"},
	"پژمان":                {"روحانیون سیاسی", "پژمان", "70", "سبحان", "محیط"},
	"تابان":                {"موسسات", "تابان", "60", "مهدی بصیر", "اصل25"},
	"جنت":                  {"روحانیت شاخص", "جنت", "50", "کمیل", "اصل25"},
	"جنگل":                 {"موسسات", "جنگل", "60", "شیرمردی", "محیط"},
	"دری":                  {"موسسات", "دری", "60", "شیرمردی", "محیط"},
	"یاسر":                 {"روحانیت شاخص", "یاسر", "50", "سید روح الله", "اصل25"},
	"حافظ":                 {"روحانیت شاخص", "حافظ", "50", "سید روح الله", "اصل25"},
	"حکمت":                 {"بین الملل", "حکمت", "60", "طالب", "اصل25"},
	"خلیل":                 {"روحانیت شاخص", "خلیل", "50", "مصطفی", "اصل25"},
	"اسفاروف":              {"بین الملل", "اسفاروف", "60", "حمد الله", "اصل25"},
	"اقبال":                {"روحانیت شاخص", "اقبال", "50", "سید روح الله", "اصل25"},
	"سراب":                 {"موسسات", "سراب", "60", "مرتضی آیت", "محیط"},
	"سرائر":                {"بین الملل", "سرائر", "60", "طالب", "اصل25"},
	"سیامک":                {"موسسات", "سیامک", "60", "مهدی بصیر", "اصل25"},
	"سید مهدی شهرستانی":    {"روحانیون سیاسی", "سید مهدی شهرستانی", "70", "جابر", "محیط"},
	"شریف":                 {"روحانیون سیاسی", "شریف", "70", "سید محمود", "اصل25"},
	"شورا":                 {"موسسات", "شورا", "60", "مجتبی صادقی", "محیط"},
	"صفر":                  {"موسسات", "صفر", "60", "حاج اسدالله", "محیط"},
	"صفین":                 {"روحانیون سیاسی", "صفین", "60", "ابوالفضل", "محیط"},
	"عشقعلی":               {"روحانیت شاخص", "عشقعلی", "50", "امیرحسین مصباح", "اصل25"},
	"غلام":                 {"روحانیت شاخص", "غلام", "50", "صادق", "اصل25"},
	"قابل":                 {"روحانیون سیاسی", "قابل", "70", "بهشتی", "اصل25"},
	"قربان":                {"موسسات", "قربان", "60", "مصطفی غروی", "اصل25"},
	"مازنی":                {"روحانیت شاخص", "مازنی", "70", "بهشتی", "اصل25"},
	"محفل":                 {"روحانیون سیاسی", "محفل", "70", "حسین اسدی", "محیط"},
	"مدینه":                {"روحانیت شاخص", "مدینه", "50", "غروی", "اصل25"},
	"مسیح":                 {"روحانیون سیاسی", "مسیح", "70", "عمار", "اصل25"},
	"ممتاز":                {"موسسات", "ممتاز", "60", "مهدی بصیر", "محیط"},
	"منتجب":                {"روحانیون سیاسی", "منتجب", "70", "بهشتی", "اصل25"},
	"منصور":                {"روحانیت شاخص", "منصور", "60", "سید محمود", "اصل25"},
	"ناظم":                 {"روحانیت شاخص", "ناظم", "50", "سید محمود", "اصل25"},
	"نجف":                  {"روحانیون سیاسی", "نجف", "50", "زمانی", "محیط"},
	"نصوص":                 {"بین الملل", "نصوص", "60", "علوی", "محیط"},
	"نواب":                 {"موسسات", "نواب", "60", "فاضل", "اصل25"},
	"واسع":                 {"بین الملل", "واسع", "60", "مصطفی غروی", "اصل25"},
	"هم نوا":               {"موسسات", "هم نوا", "60", "مرتضی آیت", "اصل25"},
	"صلواتی":               {"روحانیون سیاسی", "صلواتی", "70", "زمانی", "اصل25"},
	"پدرام":                {"موسسات", "پدرام", "60", "مهدی بصیر", "اصل25"},
	"میرزا":                {"روحانیون سیاسی", "میرزا", "60", "حسین اسدی", "اصل25"},
	"سینا":                 {"موسسات", "سینا", "60", "مهدی بصیر", "اصل25"},
	"بازرس":                {"روحانیون سیاسی", "بازرس", "70", "نامشخص", "اصل25"},
	"حاضری":                {"روحانیون سیاسی", "حاضری", "70", "نامشخص", "اصل25"},
	"دردکشان":              {"روحانیون سیاسی", "دردکشان", "نامشخص", "نامشخص", "اصل25"},
	"سراج":                 {"روحانیون سیاسی", "سراج", "نامشخص", "نامشخص", "اصل25"},
	"سعیدیان":              {"روحانیون سیاسی", "سعیدیان", "نامشخص", "نامشخص", "اصل25"},
	"سید ابوالفضل موسویان": {"روحانیون سیاسی", "موسویان", "نامشخص", "نامشخص", "اصل25"},
	"طوسی":                 {"موسسات", "طوسی", "60", "مهدی بصیر", "اصل25"},
	"محلوجی":               {"نامشخص", "محلوجی", "نامشخص", "نامشخص", "اصل25"},
	"منتظر القائم":         {"روحانیون سیاسی", "منتظر القائم", "نامشخص", "نامشخص", "اصل25"},
	"شیخ رباط":             {"نامشخص", "شیخ رباط", "نامشخص", "نامشخص", "اصل25"},
}

func main() {
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

	text, err := extractTextFromDocx(filePath)
	if err != nil {
		return fmt.Errorf("استخراج متن ناموفق بود: %w", err)
	}

	lines := strings.Split(text, "\n")
	var cleanLines []string
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed != "" {
			cleanLines = append(cleanLines, trimmed)
		}
	}

	if len(cleanLines) == 0 {
		return fmt.Errorf("محتوای متنی داخل فایل یافت نشد")
	}

	rawTitle := cleanLines[0]
	cleanTitle := sanitizeTitle(rawTitle)
	if cleanTitle == "" && len(cleanLines) > 1 {
		cleanTitle = sanitizeTitle(cleanLines[1])
	}
	if cleanTitle == "" {
		cleanTitle = "بدون عنوان"
	}

	htmlContent := ""
	for _, l := range cleanLines {
		htmlContent += fmt.Sprintf("<p>%s</p>", l)
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
	var sb strings.Builder
	var paragraphText strings.Builder

	for {
		t, tokenErr := decoder.Token()
		if tokenErr != nil {
			break
		}

		switch elem := t.(type) {
		case xml.StartElement:
			if elem.Name.Local == "p" {
				// انتهای پاراگراف قبلی را ثبت کن
				if paragraphText.Len() > 0 {
					line := strings.TrimSpace(paragraphText.String())
					if line != "" {
						sb.WriteString(line + "\n")
					}
					paragraphText.Reset()
				}
			} else if elem.Name.Local == "br" {
				paragraphText.WriteString("\n")
			}
		case xml.CharData:
			// متن‌ها مستقیماً و بدون اسپیس اجباری اضافه می‌شوند (اسپیس‌های خود متن حفظ می‌شوند)
			paragraphText.WriteString(string(elem))
		}
	}

	// ثبت آخرین پاراگراف
	if paragraphText.Len() > 0 {
		line := strings.TrimSpace(paragraphText.String())
		if line != "" {
			sb.WriteString(line + "\n")
		}
	}

	extracted := sb.String()
	if strings.TrimSpace(extracted) == "" {
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
