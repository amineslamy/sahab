package main

import (
	"embed"
	"log"
	"os/exec"
	"syscall"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

//go:embed all:pb_public
var publicFS embed.FS

func main() {
	app := pocketbase.New()

	// سرو فایل‌های فرانت‌اند
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/{path...}", apis.Static(publicFS, true))

		// باز کردن مرورگر پس از آماده‌سازی سرور در یک پردازش موازی
		go func() {
			time.Sleep(1500 * time.Millisecond) // ۱.۵ ثانیه صبر برای لود کامل
			openBrowserHidden("http://127.0.0.1:8090")
		}()

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// تابع باز کردن مرورگر بدون ایجاد پنجره اضافه
func openBrowserHidden(url string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}

