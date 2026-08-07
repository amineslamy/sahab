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

        // ۳. تولید و دانلود فایل زیپ
        const content = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `sahab_export_selected_${new Date().toISOString().slice(0, 10)}.zip`;
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