/**
 * سیستم خروجی جامع (اطلاعات و فایل‌های فیزیکی) به‌صورت Zip
 */
async function exportZip() {
    const exportBtn = document.querySelector('button[onclick="exportZip()"]');
    const originalBtnText = exportBtn ? exportBtn.innerHTML : '';

    try {
        if (typeof JSZip === 'undefined') {
            alert('کتابخانه JSZip بارگذاری نشده است.');
            return;
        }

        // استخراج شناسه گزارش‌های انتخاب‌شده از Set مربوطه
        const selectedIds = Array.from(window.selectedReportIds || []);
        if (selectedIds.length === 0) {
            alert('لطفاً حداقل یک گزارش را از جدول انتخاب کنید.');
            return;
        }

        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '⏳ در حال بسته‌بندی...';
        }

        const zip = new JSZip();
        const pbInstance = window.pb || (typeof PocketBase !== 'undefined' ? new PocketBase(window.location.origin) : null);

        if (!pbInstance) {
            throw new Error('نمونه PocketBase یافت نشد.');
        }

        // ساخت شرط فیلتر PocketBase برای دریافت فقط گزارش‌های انتخاب‌شده
        const reportsFilter = selectedIds.map(id => `id = "${id}"`).join(' || ');

        // ۱. دریافت داده‌های گزارش‌های انتخاب‌شده و موارد وابسته
        const reports = await pbInstance.collection('reports').getFullList({
            filter: reportsFilter,
            sort: '-created'
        });

        const [reportVersions, comments, cases, topics, usersRaw] = await Promise.all([
            pbInstance.collection('report_versions').getFullList({ sort: '-created' }),
            pbInstance.collection('comments').getFullList({ sort: '-created' }),
            pbInstance.collection('cases').getFullList({ sort: '-created' }),
            pbInstance.collection('topics').getFullList({ sort: '-created' }),
            pbInstance.collection('users').getFullList({ sort: '-created' })
        ]);

        // استخراج کلیه شناسه‌های ریلیشن‌های وابسته به گزارش‌های انتخاب‌شده
        const validReportIds = new Set(reports.map(r => r.id));
        const relatedCaseIds = new Set();
        const relatedTopicIds = new Set();
        const relatedUserIds = new Set();

        reports.forEach(r => {
            if (r.author) relatedUserIds.add(r.author);
            if (r.department) relatedUserIds.add(r.department);
            if (r.submitter) relatedUserIds.add(r.submitter);

            if (Array.isArray(r.cases_rel)) {
                r.cases_rel.forEach(id => relatedCaseIds.add(id));
            }
            if (Array.isArray(r.topics_rel)) {
                r.topics_rel.forEach(id => relatedTopicIds.add(id));
            }
        });

        // فیلتر کردن نسخه گزارش‌ها و کامنت‌های مربوط به گزارش‌های انتخاب‌شده
        const filteredVersions = reportVersions.filter(v => validReportIds.has(v.report));
        const filteredComments = comments.filter(c => validReportIds.has(c.report));

        // اضافه کردن شناسه نویسندگان کامنت‌ها و نسخه‌ها به کاربران مرتبط
        filteredVersions.forEach(v => { if (v.author) relatedUserIds.add(v.author); });
        filteredComments.forEach(c => { if (c.author) relatedUserIds.add(c.author); });

        // فیلتر کردن کیس‌ها، موضوعات و کاربران متمایز و مرتبط
        const filteredCases = cases.filter(c => relatedCaseIds.has(c.id));
        const filteredTopics = topics.filter(t => relatedTopicIds.has(t.id));
        const filteredUsersRaw = usersRaw.filter(u => relatedUserIds.has(u.id));

        // حذف فیلدهای حساس کاربران
        const safeUsers = filteredUsersRaw.map(user => {
            const { password, tokenKey, ...safeUser } = user;
            return safeUser;
        });

        // ساخت شیء اصلی JSON
        const exportData = {
            exported_at: new Date().toISOString(),
            data: {
                reports,
                report_versions: filteredVersions,
                comments: filteredComments,
                cases: filteredCases,
                topics: filteredTopics,
                users: safeUsers
            }
        };

        zip.file("data.json", JSON.stringify(exportData, null, 2));

        // ۲. دانلود فایل‌های فیزیکی مرتبط
        const filesFolder = zip.folder("files");

        const getFileUrlSafe = (record, filename) => {
            if (typeof pbInstance.getFileUrl === 'function') {
                return pbInstance.getFileUrl(record, filename);
            }
            if (pbInstance.files && typeof pbInstance.files.getUrl === 'function') {
                return pbInstance.files.getUrl(record, filename);
            }
            return `/api/files/${record.collectionId || record.collectionName}/${record.id}/${filename}`;
        };

        // الف) فایل‌های فیزیکی گزارش‌های انتخاب شده (کاور و پیوست‌ها)
        for (const report of reports) {
            if (report.cover_image) {
                const url = getFileUrlSafe(report, report.cover_image);
                await fetchAndAddToZip(filesFolder, `reports/${report.id}/${report.cover_image}`, url);
            }
            if (Array.isArray(report.attachments)) {
                for (const fileName of report.attachments) {
                    const url = getFileUrlSafe(report, fileName);
                    await fetchAndAddToZip(filesFolder, `reports/${report.id}/${fileName}`, url);
                }
            }
        }

        // ب) آواتار کاربران مرتبط
        for (const user of filteredUsersRaw) {
            if (user.avatar) {
                const url = getFileUrlSafe(user, user.avatar);
                await fetchAndAddToZip(filesFolder, `users/${user.id}/${user.avatar}`, url);
            }
        }

        // ۳. استخراج نام کاربر جاری و ساخت نام فایل زیپ بر اساس الگوی درخواستی
        let userName = "unknown";
        if (pbInstance.authStore && pbInstance.authStore.model && pbInstance.authStore.model.name) {
            userName = pbInstance.authStore.model.name;
        }

        let dateStr = "";
        let timeStr = "";

        if (typeof persianDate !== 'undefined') {
            const pd = new persianDate();
            dateStr = pd.format("YYMMDD");
            timeStr = pd.format("HHmm");
        } else {
            const now = new Date();
            dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");
            timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        }

        const zipFileName = `${userName}_${dateStr}_${timeStr}.zip`;

        // تولید و دانلود فایل زیپ
        const content = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error('خطا در خروجی زیپ:', error);
        alert('خطا در دریافت خروجی: ' + error.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnText;
        }
    }
}

/**
 * دریافت فایل از سرور و افزودن آن به Zip
 */
async function fetchAndAddToZip(zipFolder, relativePath, url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            zipFolder.file(relativePath, blob);
        }
    } catch (e) {
        console.warn(`فایل در آدرس ${url} دریافت نشد:`, e);
    }
}
/**
 * مرتب‌سازی ترتیبی کامنت‌ها (ابتدا کامنت‌های مادر، سپس فرزندان)
 */
function sortCommentsByDependency(comments) {
    const sorted = [];
    const insertedIds = new Set();
    let remaining = [...comments];

    let loopSafety = 0;
    while (remaining.length > 0 && loopSafety < 100) {
        loopSafety++;
        const nextBatch = [];
        const uninserted = [];

        for (const item of remaining) {
            // اگر کامنت والد ندارد یا والد آن قبلاً پردازش شده است
            if (!item.parent || insertedIds.has(item.parent)) {
                nextBatch.push(item);
                insertedIds.add(item.id);
            } else {
                uninserted.push(item);
            }
        }

        // در صورت وجود چرخه یا نبود والد، جهت جلوگیری از حلقه بینهایت مابقی اضافه می‌شوند
        if (nextBatch.length === 0) {
            sorted.push(...uninserted);
            break;
        }

        sorted.push(...nextBatch);
        remaining = uninserted;
    }

    return sorted;
}
/**
 * تابع شروع عملیات ایمپورت داده‌ها و فایل‌های فیزیکی از فایل ZIP به همراه نوار پیشرفت
 */
async function handleStartImport() {
    const fileInput = document.getElementById('sync-zip-file');
    const importBtn = document.getElementById('btn-start-import');

    const progressContainer = document.getElementById('import-progress-container');
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    const progressPercent = document.getElementById('import-progress-percent');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('لطفاً یک فایل ZIP انتخاب کنید.');
        return;
    }

    const zipFile = fileInput.files[0];
    const originalBtnText = importBtn ? importBtn.innerHTML : '';

    const updateProgress = (current, total, message) => {
        if (!progressContainer) return;
        progressContainer.classList.remove('hidden');
        const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressPercent) progressPercent.innerText = `${percentage}%`;
        if (progressText) progressText.innerText = message;
    };

    try {
        if (typeof JSZip === 'undefined') {
            alert('کتابخانه JSZip بارگذاری نشده است.');
            return;
        }

        const pbInstance = window.pb || (typeof PocketBase !== 'undefined' ? new PocketBase(window.location.origin) : null);
        if (!pbInstance) {
            throw new Error('نمونه PocketBase یافت نشد.');
        }

        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '⏳ در حال بسته‌بندی داده‌ها...';
        }

        updateProgress(0, 100, 'در حال خواندن فایل ZIP...');

        // ۱. خواندن فایل زیپ
        const zip = await JSZip.loadAsync(zipFile);
        const jsonFile = zip.file("data.json");

        if (!jsonFile) {
            throw new Error('فایل data.json در ریشه فایل ZIP یافت نشد.');
        }

        const jsonText = await jsonFile.async("text");
        const parsedData = JSON.parse(jsonText);

        if (!parsedData || !parsedData.data) {
            throw new Error('ساختار data.json معتبر نیست.');
        }

        const {
            users = [],
            cases = [],
            topics = [],
            reports = [],
            comments = [],
            report_versions = []
        } = parsedData.data;

        // مرتب‌سازی ترتیبی کامنت‌ها (والد قبل از فرزند)
        const sortedComments = sortCommentsByDependency(comments);

        // محاسبه مجموع کل آیتم‌ها جهت نمایش دقیق درصد
        const totalItems = users.length + cases.length + topics.length + reports.length + sortedComments.length + report_versions.length; 
        let processedItems = 0;

        if (totalItems === 0) {
            updateProgress(100, 100, 'هیچ داده‌ای برای ایمپورت یافت نشد.');
            alert('فایل ZIP حاوی داده‌ای برای ایمپورت نیست.');
            return;
        }

        // آمارگیری مجزا برای گزارش‌ها و سایر آیتم‌ها
        const reportStats = {
            created: new Set(),
            updated: new Set(),
            skipped: new Set(),
            failed: new Set()
        };

        const otherStats = {
            created: new Set(),
            updated: new Set(),
            skipped: new Set(),
            failed: new Set()
        };

        const processResult = (record, res, isReport = false) => {
            if (res && res.status && record && record.id) {
                const targetStats = isReport ? reportStats : otherStats;
                if (targetStats[res.status]) {
                    targetStats[res.status].add(record.id);
                }
            }
        };

        // تعریف فازهای اجرای ترتیبی (Sequential Multi-Phase)
        const importPhases = [
            {
                phaseName: 'فاز ۱: داده‌های پایه (کاربران، کیس‌ها، موضوعات)',
                collections: [
                    {
                        name: 'users',
                        label: 'کاربر',
                        items: users,
                        getFileMap: (u) => ({ avatar: `files/users/${u.id}/${u.avatar}` }),
                        isReport: false
                    },
                    {
                        name: 'cases',
                        label: 'کیس',
                        items: cases,
                        getFileMap: () => ({}),
                        isReport: false
                    },
                    {
                        name: 'topics',
                        label: 'موضوع',
                        items: topics,
                        getFileMap: () => ({}),
                        isReport: false
                    }
                ]
            },
            {
                phaseName: 'فاز ۲: داده‌های اصلی (گزارش‌ها)',
                collections: [
                    {
                        name: 'reports',
                        label: 'گزارش',
                        items: reports,
                        getFileMap: (r) => {
                            const filePathsMap = {};
                            if (r.cover_image) {
                                filePathsMap['cover_image'] = `files/reports/${r.id}/${r.cover_image}`;
                            }
                            if (Array.isArray(r.attachments) && r.attachments.length > 0) {
                                filePathsMap['attachments'] = r.attachments.map(att => `files/reports/${r.id}/${att}`);
                            }
                            return filePathsMap;
                        },
                        isReport: true
                    }
                ]
            },
            {
                phaseName: 'فاز ۳: داده‌های وابسته (کامنت‌ها و نسخه‌های گزارش)',
                collections: [
                    {
                        name: 'comments',
                        label: 'کامنت',
                        items: sortedComments,
                        getFileMap: () => ({}),
                        isReport: false
                    },
                    {
                        name: 'report_versions',
                        label: 'نسخه گزارش',
                        items: report_versions,
                        getFileMap: () => ({}),
                        isReport: false
                    }
                ]
            }
        ];

        // اجرای ترتیبی فاز به فاز
        for (const phase of importPhases) {
            updateProgress(processedItems, totalItems, `شروع ${phase.phaseName}...`);

            for (const config of phase.collections) {
                for (const item of config.items) {
                    const itemIdentifier = item.title || item.name || item.username || item.id;
                    updateProgress(processedItems, totalItems, `در حال بررسی ${config.label}: ${itemIdentifier}`);

                    const filePathsMap = config.getFileMap(item);
                    const res = await importRecordWithFiles(pbInstance, zip, config.name, item, filePathsMap);

                    processResult(item, res, config.isReport);
                    processedItems++;
                    updateProgress(processedItems, totalItems, `${config.label} بررسی شد (${processedItems}/${totalItems})`);
                }
            }

            // صحت‌سنجی فاز ۲: اگر ثبت گزارش‌های اصلی کلاً با خطا مواجه شد و هیچ گزارشی ثبت/بروزرسانی نشد، ادامه ندهیم
            if (phase.phaseName.includes('فاز ۲')) {
                const repCreated = reportStats.created.size;
                const repUpdated = reportStats.updated.size;
                const repFailed = reportStats.failed.size;

                if (reports.length > 0 && repCreated === 0 && repUpdated === 0 && repFailed === reports.length) {
                    throw new Error('پردازش فاز ۲ (گزارش‌ها) با خطا مواجه شد. از ثبت داده‌های وابسته (کامنت‌ها و نسخه‌ها) جلوگیری شد.');
                }
            }
        }

// محاسبه آمار گزارش‌های اصلی
        const repCreated = reportStats.created.size;
        const repUpdated = reportStats.updated.size;

        // ابتدا درصد و نوار پیشرفت را روی ۱۰۰٪ تنظیم می‌کنیم
        updateProgress(totalItems, totalItems, '');

        // سپس گزارش نهایی را به‌صورت HTML قرار می‌دهیم
        if (progressText) {
            if (repCreated === 0 && repUpdated === 0) {
                progressText.innerHTML = 'ℹ️ اطلاعات وارد شده تکراری بود و هیچ گزارش جدید یا تغییریافته‌ای ثبت نشد.';
            } else {
                let reportHTML = '✅ عملیات ایمپورت با موفقیت انجام شد:<br>';
                
                if (repCreated > 0) {
                    reportHTML += `<span style="color: #10b981; font-weight: bold;">• گزارش‌های جدید: ${repCreated}</span><br>`;
                }
                
                if (repUpdated > 0) {
                    reportHTML += `<span style="color: #3b82f6; font-weight: bold;">• گزارش‌های بروزرسانی‌شده: ${repUpdated}</span>`;
                }

                progressText.innerHTML = reportHTML;
            }
        }
        

        // بازخوانی جدول گزارش‌ها در صورت وجود تابع مربوطه
        if (typeof loadReports === 'function') {
            loadReports();
        }

    } catch (error) {
        console.error('خطا در فرایند ایمپورت:', error);
        if (progressText) {
            progressText.innerText = '❌ خطا در ایمپورت: ' + error.message;
        }
    }

    finally {
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = originalBtnText;
        }
        fileInput.value = '';
    }
}

/**
 * تابع کمکی برای ثبت/بروزرسانی یک رکورد در PocketBase به همراه فایل‌های فیزیکی (Upsert)
 */
async function importRecordWithFiles(pbInstance, zip, collectionName, recordData, filePathsMap = {}) {
    const recordId = recordData.id;
    const collection = pbInstance.collection(collectionName);

    let existingRecord = null;
    if (recordId) {
        try {
            existingRecord = await collection.getOne(recordId);
        } catch (e) {
            existingRecord = null;
        }
    }

    const buildFormData = (isUpdate) => {
        const formData = new FormData();

        // تعیین شناسه رکورد هنگام ساخت رکورد جدید
        if (!isUpdate && recordData.id) {
            formData.append('id', recordData.id);
        }

        for (const [key, value] of Object.entries(recordData)) {
            // نادیده گرفتن فیلدهای فایل، سیستم و expand
            if (
                filePathsMap[key] ||
                key === 'id' ||
                key === 'created' ||
                key === 'updated' ||
                key === 'collectionId' ||
                key === 'collectionName' ||
                key === 'expand'
            ) {
                continue;
            }

            // مقادیر null یا undefined یا رشته‌های خالی (نظیر parent خالی) نادیده گرفته می‌شوند
            if (value === null || value === undefined || value === '') {
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) {
                    // جهت جلوگیری از خطای Validation در فیلدهای آرایه‌ای اجباری
                    formData.append(key, '');
                } else {
                    value.forEach(item => {
                        if (item !== null && item !== undefined && item !== '') {
                            formData.append(key, item);
                        }
                    });
                }
            } else if (typeof value === 'boolean') {
                formData.append(key, value ? 'true' : 'false');
            } else if (typeof value === 'object') {
                formData.append(key, JSON.stringify(value));
            } else {
                formData.append(key, String(value));
            }
        }

        return formData;
    };

    const attachFilesToFormData = async (formData) => {
        for (const [fieldName, zipPathOrPaths] of Object.entries(filePathsMap)) {
            if (Array.isArray(zipPathOrPaths)) {
                for (const path of zipPathOrPaths) {
                    const zipFile = zip.file(path);
                    if (zipFile) {
                        const blob = await zipFile.async("blob");
                        const fileName = path.split('/').pop();
                        formData.append(fieldName, blob, fileName);
                    }
                }
            } else if (zipPathOrPaths) {
                const zipFile = zip.file(zipPathOrPaths);
                if (zipFile) {
                    const blob = await zipFile.async("blob");
                    const fileName = zipPathOrPaths.split('/').pop();
                    formData.append(fieldName, blob, fileName);
                }
            }
        }
    };

    try {
        if (existingRecord) {
            try {
                const updateData = buildFormData(true);
                await attachFilesToFormData(updateData);
                await collection.update(recordId, updateData);
                return { status: 'updated' };
            } catch (err) {
                return { status: 'skipped', error: err };
            }
        } else {
            const createData = buildFormData(false);
            await attachFilesToFormData(createData);

            // در صورتی که ساخت با ID سفارشی ناموفق بود، یک بار بدون ارسال ID صریح تلاش می‌کند
            try {
                await collection.create(createData);
            } catch (createErr) {
                // چاپ دقیق خطا برای عیب‌یابی فیلدهای نامعتبر
                console.error(`[ایمپورت] جزییات خطای ۴۰۰ در ساخت ${collectionName}:`, createErr?.response?.data || createErr?.data || createErr);
                throw createErr;
            }
            return { status: 'created' };
        }
    } catch (error) {
        console.error(`خطا در پردازش رکورد در مجموعه ${collectionName}:`, error);
        return { status: 'failed', error: error };
    }
}