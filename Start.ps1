# ۱. اجرای پاکت‌بیس در پس‌زمینه و به‌صورت مخفی
Start-Process -FilePath ".\pocketbase.exe" -ArgumentList "serve" -WindowStyle Hidden

# ۲. باز کردن آدرس در مرورگر پیش‌فرض سیستم
Start-Process "http://127.0.0.1:8090"