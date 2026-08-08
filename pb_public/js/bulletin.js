/**
 * مدیریت خروجی بولتن به فرمت Word بر اساس الگوی اختصاصی docx
 */

// ۱. تابع کمکی برای تبدیل تاریخ میلادی به شمسی
function formatJalaliDate(dateString) {
    if (!dateString) return '---';
    try {
        if (typeof persianDate !== 'undefined') {
            const pDate = new persianDate(new Date(dateString));
            return pDate.format('YYYY/MM/DD');
        }
        return dateString.split('T')[0];
    } catch (e) {
        return dateString;
    }
}

// // ۲. تابع کمکی تبدیل تصویر از URL به ArrayBuffer برای تزریق به docx
// async function fetchImageAsBuffer(imageUrl) {
//     try {
//         const response = await fetch(imageUrl);
//         if (!response.ok) return null;
//         const arrayBuffer = await response.arrayBuffer();
//         return new Uint8Array(arrayBuffer);
//     } catch (e) {
//         console.warn('خطا در دریافت تصویر:', e);
//         return null;
//     }
// }
// تابع کمکی برای تبدیل کدهای HTML به متن ساختاریافته و پاراگراف‌بندی‌شده
function convertHtmlToCleanText(htmlString) {
    if (!htmlString) return '';

    // ۱. ایجاد یک DOM Parser موقت برای پیمایش تگ‌ها
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // ۲. تبدیل تگ‌های جداکننده و پاراگراف‌ها به خط جدید
    const blockElements = doc.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6, li');
    blockElements.forEach(el => {
        if (el.tagName.toLowerCase() === 'br') {
            el.replaceWith('\n');
        } else {
            el.prepend('\n');
        }
    });

    // ۳. استخراج متن تمیز و حذف تگ‌های اضافه
    let cleanText = doc.body.textContent || doc.body.innerText || '';

    // ۴. اصلاح فواصل و خطوط خالی متوالی
    cleanText = cleanText
        .split('\n')
        .map(line => line.trim())
        .filter((line, index, arr) => line !== '' || (index > 0 && arr[index - 1] !== ''))
        .join('\n');

    return cleanText.trim();
}
// ۳. تابع اصلی خروجی گرفتن از بولتن
async function exportBulletin() {
    // ۱. بررسی انتخاب اخبار توسط کاربر
    // فرض بر این است که متغیر selectedReportIds در main.js نگهداری می‌شود
    const selectedIds = Array.from(window.selectedReportIds || []);

    if (!selectedIds || selectedIds.length === 0) {
        alert('لطفاً حداقل یک خبر را برای خروجی بولتن انتخاب کنید.');
        return;
    }

    try {
        // نمایش حالت در حال بارگذاری روی دکمه یا اعلان ساده
        console.log(`در حال دریافت اطلاعات ${selectedIds.length} خبر...`);

        // ۲. دریافت داده کامل اخبار از PocketBase به همراه روابط (Expand)
        const pb = window.pb; // استفاده از نمونه PocketBase موجود
        if (!pb) {
            alert('ارتباط با پایگاه داده برقرار نیست.');
            return;
        }

        const reportsData = [];

        for (const id of selectedIds) {
            // دریافت اطلاعات خبر با expand کردن تمام روابط
            const report = await pb.collection('reports').getOne(id, {
                expand: 'cases_rel,topics_rel,submitter,author,department'
            });

            // دریافت کامنت‌های مربوط به این خبر
            let comments = [];
            try {
                const commentsRecords = await pb.collection('comments').getFullList({
                    filter: `report = "${id}"`,
                    expand: 'author',
                    sort: 'created'
                });

                comments = commentsRecords.map(c => ({
                    type: c.type || 'کامنت',
                    author_name: c.expand?.author?.name || c.expand?.author?.username || 'ناشناس',
                    created_jalali: formatJalaliDate(c.created),
                    text: c.text || ''
                }));
            } catch (err) {
                console.warn(`خطا در دریافت کامنت‌های خبر ${id}:`, err);
            }

            // استخراج نام موضوعات و کیس‌ها
            const topicsNames = report.expand?.topics_rel
                ? (Array.isArray(report.expand.topics_rel) ? report.expand.topics_rel.map(t => t.title || t.name).join('، ') : report.expand.topics_rel.title)
                : '---';

            const casesNames = report.expand?.cases_rel
                ? (Array.isArray(report.expand.cases_rel) ? report.expand.cases_rel.map(c => c.title || c.name).join('، ') : report.expand.cases_rel.title)
                : '---';

            // // پردازش تصویر کاور (در صورت وجود)
            // let coverImageData = null;
            // if (report.cover_image) {
            //     const imageUrl = pb.files.getUrl(report, report.cover_image);
            //     coverImageData = await fetchImageAsBuffer(imageUrl);
            // }

            // ساخت شیء نهایی داده‌های این خبر برای الگو
            reportsData.push({
                title: report.title || 'بدون عنوان',
                automation_id: report.automation_id || '---',
                occurrence_date_jalali: formatJalaliDate(report.occurrence_date),
                classification: report.classification || 'عادی',
                priority: report.priority || 'عادی',
                news_type: report.news_type || 'آشکار',
                evaluation: report.evaluation || 'در دست بررسی',
                author_name: report.expand?.author?.name || report.expand?.author?.username || '---',
                submitter_name: report.expand?.submitter?.name || report.expand?.submitter?.username || '---',
                department_name: report.expand?.department?.name || '---',
                created_jalali: formatJalaliDate(report.created),
                updated_jalali: formatJalaliDate(report.updated),
                topics_names: topicsNames,
                cases_names: casesNames,
                abstract: convertHtmlToCleanText(report.abstract || ''),
                content: convertHtmlToCleanText(report.content || ''),
                comments: comments
            });
        }

        // ۳. خواندن فایل الگوی Word از پوشه templates
        const templateResponse = await fetch('templates/template.docx');
        if (!templateResponse.ok) {
            throw new Error('فایل الگوی template.docx در مسیر templates پیدا نشد.');
        }
        const templateBuffer = await templateResponse.arrayBuffer();

        // ۴. تاریخ تنظیم بولتن (امروز)
        const todayJalali = formatJalaliDate(new Date().toISOString());

        // ۵. رندر و تزریق داده‌ها با docxtemplater و PizZip
        if (typeof PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') {
            throw new Error('کتابخانه‌های docxtemplater یا PizZip در مرورگر بارگذاری نشده‌اند.');
        }

        const zip = new PizZip(templateBuffer);
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
        });

        doc.render({
            bulletin_date: todayJalali,
            reports: reportsData
        });

        const renderedBuffer = doc.getZip().generate({
            type: 'uint8array',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        // ۶. دانلود فایل خروجی نهایی
        const blob = new Blob([renderedBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        // دریافت اطلاعات کاربر جاری از PocketBase
        const currentUser = pb.authStore?.model;
        const userName = currentUser?.name || currentUser?.username || 'کاربر';

        // استخراج تاریخ به فرمت YYMMDD و زمان به فرمت HHMM
        let formattedDateStr = '';
        let formattedTimeStr = '';

        try {
            const now = new Date();
            if (typeof persianDate !== 'undefined') {
                const pDate = new persianDate(now);
                formattedDateStr = pDate.format('YYMMDD');
                formattedTimeStr = pDate.format('HHmm');
            } else {
                formattedDateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
                formattedTimeStr = now.toTimeString().slice(0, 5).replace(':', '');
            }
        } catch (e) {
            formattedDateStr = '000000';
            formattedTimeStr = '0000';
        }

        const cleanUserName = userName.replace(/\s+/g, '_');
        const fileName = `${cleanUserName}-${formattedDateStr}-${formattedTimeStr}.docx`;
        if (typeof saveAs === 'function') {
            saveAs(blob, fileName);
        } else {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        }

        console.log('بولتن با موفقیت تولید و دانلود شد.');

    } catch (error) {
        console.error('خطا در تولید بولتن:', error);
        alert('خطایی هنگام تولید فایل بولتن رخ داد: ' + error.message);
    }
}