package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	// پیدا کردن مسیر دقیق پوشه‌ای که فایل اجرایی در آن قرار دارد
	exePath, err := os.Executable()
	if err != nil {
		return
	}
	dir := filepath.Dir(exePath)

	// تنظیم مسیر دقیق اجرای PocketBase
	pbPath := filepath.Join(dir, "pocketbase.exe")

	cmd := exec.Command(pbPath, "serve")
	cmd.Dir = dir // تنظیم Working Directory روی پوشه پروژه
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	err = cmd.Start()
	if err != nil {
		return
	}

	// افزایش مکث به ۳ ثانیه برای اطمینان از بالا آمدن کامل سرور روی پورت ۸۰۹۰
	time.Sleep(3 * time.Second)

	// باز کردن آدرس در مرورگر پیش‌فرض
	exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://127.0.0.1:8090").Start()
}