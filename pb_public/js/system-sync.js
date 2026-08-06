// تابع کمکی برای اطمینان از دسترسی به نمونه سراسری PocketBase
function getPb() {
    if (!window.pb && typeof PocketBase !== 'undefined') {
        window.pb = new PocketBase(window.location.origin);
    }
    return window.pb;
}

document.addEventListener('DOMContentLoaded', async () => {
    const pbInstance = getPb();

    // بررسی وجود pb و اعتبارسنجی نشست کاربر
    if (!pbInstance || !pbInstance.authStore || !pbInstance.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    // فراخوانی مجدد رندر هدر پس از اطمینان از مقداردهی pb
    if (typeof window.renderGlobalHeader === 'function') {
        window.renderGlobalHeader();
    }
});

// تابع ثبت لوگ در UI
function logStatus(message, isError = false) {
    const container = document.getElementById('status-container');
    const logBox = document.getElementById('status-log');
    if (container) container.classList.remove('hidden');
    
    const time = new Date().toLocaleTimeString('fa-IR');
    const colorClass = isError ? 'text-rose-400' : 'text-emerald-400';
    
    const item = document.createElement('div');
    item.className = colorClass;
    item.innerText = `[${time}] ${message}`;
    
    logBox.appendChild(item);
    logBox.scrollTop = logBox.scrollHeight;
}

// ------------------- Export JSON -------------------
async function exportDataToJSON() {
    try {
        logStatus("شروع فرایند استخراج داده‌ها (JSON)...");
        
        const activePb = getPb();
        if (!activePb) throw new Error("ارتباط با PocketBase برقرار نیست.");

        // استخراج کلیه داده‌های مربوطه بر اساس منطق دسترسی دسته‌بندی پروژه
        const [reports, topics, cases, comments] = await Promise.all([
            activePb.collection('reports').getFullList({ sort: '-created', requestKey: null }),
            activePb.collection('topics').getFullList({ requestKey: null }),
            activePb.collection('cases').getFullList({ requestKey: null }),
            activePb.collection('comments').getFullList({ requestKey: null })
        ]);

        const exportPayload = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            data: {
                topics,
                cases,
                reports,
                comments
            }
        };

        const jsonString = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sahab_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        logStatus(`خروجی موفقیت‌آمیز انجام شد. تعداد کل گزارش‌ها: ${reports.length}`);
    } catch (err) {
        console.error("Export error:", err);
        logStatus(`خطا در خروجی گرفتن: ${err.message}`, true);
    }
}

// ------------------- Export ZIP (شامل پیوست‌ها) -------------------
async function exportDataToZIP() {
    if (typeof JSZip === 'undefined') {
        logStatus("کتابخانه JSZip بارگذاری نشده است.", true);
        return;
    }

    try {
        logStatus("در حال جمع‌آوری داده‌ها و فایل‌های پیوست...");
        const zip = new JSZip();

        const activePb = getPb();
        if (!activePb) throw new Error("ارتباط با PocketBase برقرار نیست.");

        const [reports, topics, cases, comments] = await Promise.all([
            activePb.collection('reports').getFullList({ sort: '-created', requestKey: null }),
            activePb.collection('topics').getFullList({ requestKey: null }),
            activePb.collection('cases').getFullList({ requestKey: null }),
            activePb.collection('comments').getFullList({ requestKey: null })
        ]);

        const exportPayload = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            data: { topics, cases, reports, comments }
        };

        // افزودن دیتای متنی JSON به ZIP
        zip.file("data.json", JSON.stringify(exportPayload, null, 2));

        // فولدر اختصاصی رسانه‌ها
        const mediaFolder = zip.folder("media");

        logStatus("در حال دریافت فایل‌های پیوست از سرور...");
        
        for (const r of reports) {
            // دریافت تصویر کاور
            if (r.cover_image) {
                try {
                    const imgUrl = activePb.files.getUrl(r, r.cover_image);
                    const res = await fetch(imgUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        mediaFolder.file(`reports/${r.id}/${r.cover_image}`, blob);
                    }
                } catch (e) {
                    console.warn(`امکان دانلود فایل ${r.cover_image} وجود نداشت.`);
                }
            }

            // دریافت فایل‌های پیوست multi-file
            if (r.attachments && Array.isArray(r.attachments)) {
                for (const file of r.attachments) {
                    try {
                        const fileUrl = activePb.files.getUrl(r, file);
                        const res = await fetch(fileUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            mediaFolder.file(`reports/${r.id}/${file}`, blob);
                        }
                    } catch (e) {
                        console.warn(`امکان دانلود پیوست ${file} وجود نداشت.`);
                    }
                }
            }
        }

        logStatus("در حال فشرده‌سازی و ایجاد فایل ZIP...");
        const content = await zip.generateAsync({ type: "blob" });
        
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sahab_full_export_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        logStatus("فایل ZIP با موفقیت دانلود شد.");
    } catch (err) {
        console.error("ZIP Export Error:", err);
        logStatus(`خطا در ساخت ZIP: ${err.message}`, true);
    }
}

// ------------------- Import Data -------------------
async function importDataFromFile() {
    const fileInput = document.getElementById('import-file-input');
    if (!fileInput || !fileInput.files.length) {
        alert("لطفاً ابتدا یک فایل JSON یا ZIP انتخاب کنید.");
        return;
    }

    const file = fileInput.files[0];
    const isZip = file.name.endsWith('.zip');
    const isJson = file.name.endsWith('.json');

    if (!isZip && !isJson) {
        alert("فرمت فایل انتخاب‌شده معتبر نیست. (فقط json یا zip)");
        return;
    }

    try {
        logStatus(`در حال پردازش فایل ${file.name}...`);

        if (isJson) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            await processImportData(parsed.data || parsed);
        } else if (isZip) {
            if (typeof JSZip === 'undefined') {
                logStatus("کتابخانه JSZip برای پردازش ZIP آماده نیست.", true);
                return;
            }
            const zip = await JSZip.loadAsync(file);
            const dataJsonFile = zip.file("data.json");
            
            if (!dataJsonFile) {
                logStatus("فایل data.json در آرشیو ZIP یافت نشد.", true);
                return;
            }

            const jsonText = await dataJsonFile.async("string");
            const parsed = JSON.parse(jsonText);
            
            // پردازش داده‌های متنی
            await processImportData(parsed.data || parsed);
        }

        logStatus("عملیات ورود اطلاعات با موفقیت پایان یافت.");
    } catch (err) {
        console.error("Import Error:", err);
        logStatus(`خطا در ورود داده‌ها: ${err.message}`, true);
    }
}

// تابع اصلی ایجاد/بروزرسانی داده‌ها در دیتابیس
async function processImportData(payload) {
    const overwrite = document.getElementById('overwrite-existing')?.checked || false;

    const { topics = [], cases = [], reports = [], comments = [] } = payload;

    // ۱. ورود موضوعات (Topics)
    logStatus(`بررسی و ورود ${topics.length} موضوع...`);
    for (const item of topics) {
        await upsertRecord('topics', item, overwrite);
    }

    // ۲. ورود کیس‌ها (Cases)
    logStatus(`بررسی و ورود ${cases.length} کیس...`);
    for (const item of cases) {
        await upsertRecord('cases', item, overwrite);
    }

    // ۳. ورود گزارش‌ها (Reports)
    logStatus(`بررسی و ورود ${reports.length} گزارش...`);
    for (const item of reports) {
        await upsertRecord('reports', item, overwrite);
    }

    // ۴. ورود کامنت‌ها (Comments)
    logStatus(`بررسی و ورود ${comments.length} کامنت...`);
    for (const item of comments) {
        await upsertRecord('comments', item, overwrite);
    }
}

// تابع کمکی برای ایجاد یا بروزرسانی رکوردها
async function upsertRecord(collectionName, itemData, overwrite) {
    const activePb = getPb();
    if (!activePb) return;

    try {
        if (!itemData.id) return;

        let exists = false;
        try {
            await activePb.collection(collectionName).getOne(itemData.id, { requestKey: null });
            exists = true;
        } catch (e) {
            exists = false;
        }

        if (exists) {
            if (overwrite) {
                await activePb.collection(collectionName).update(itemData.id, itemData, { requestKey: null });
            }
        } else {
            await activePb.collection(collectionName).create(itemData, { requestKey: null });
        }
    } catch (err) {
        console.warn(`خطا در پردازش رکورد ${itemData.id} در کلکسیون ${collectionName}:`, err.message);
    }
}