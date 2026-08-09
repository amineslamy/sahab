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

// توابع کمکی جهت پردازش، دانلود و ساخت ساختار OpenXML تصویر در فایل Word
async function fetchImageAsBuffer(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch (e) {
        console.warn('خطا در دریافت تصویر:', e);
        return null;
    }
}

function getImageDimensions(arrayBuffer) {
    try {
        const bytes = new Uint8Array(arrayBuffer);
        // بررسی هدر PNG
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
            const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
            return { width, height };
        }
        // بررسی هدر JPEG/JPG
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
            let offset = 2;
            while (offset < bytes.length) {
                if (bytes[offset] !== 0xFF) break;
                const marker = bytes[offset + 1];
                if (marker === 0xC0 || marker === 0xC2) {
                    const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
                    const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
                    return { width, height };
                }
                offset += 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
            }
        }
    } catch (e) {
        console.warn('خطا در محاسبه ابعاد تصویر:', e);
    }
    return { width: 400, height: 300 }; // مقدار پیش‌فرض
}

function buildDrawingXml(relId, imgId, widthPx, heightPx) {
    const maxWidthPx = 500; // حداکثر عرض تصویر در سند (بر حسب پیکسل)
    if (widthPx > maxWidthPx) {
        heightPx = Math.round((heightPx * maxWidthPx) / widthPx);
        widthPx = maxWidthPx;
    }
    const cx = Math.round(widthPx * 9525);
    const cy = Math.round(heightPx * 9525);

    return `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r>
            <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                    <wp:extent cx="${cx}" cy="${cy}"/>
                    <wp:docPr id="${imgId}" name="Image ${imgId}"/>
                    <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                            <pic:pic>
                                <pic:nvPicPr>
                                    <pic:cNvPr id="${imgId}" name="Picture ${imgId}"/>
                                    <pic:cNvPicPr/>
                                </pic:nvPicPr>
                                <pic:blipFill>
                                    <a:blip r:embed="${relId}"/>
                                    <a:stretch><a:fillRect/></a:stretch>
                                </pic:blipFill>
                                <pic:spPr>
                                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                                </pic:spPr>
                            </pic:pic>
                        </a:graphicData>
                    </a:graphic>
                </wp:inline>
            </w:drawing>
        </w:r>
    </w:p>`;
}

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

            // آماده‌سازی آرایه تصاویر این خبر
            const reportImages = [];

            // پردازش تصویر شاخص (کاور)
            if (report.cover_image) {
                const coverUrl = pb.files.getUrl(report, report.cover_image);
                const buffer = await fetchImageAsBuffer(coverUrl);
                if (buffer) {
                    reportImages.push({ type: 'cover', buffer, ext: report.cover_image.split('.').pop().toLowerCase() });
                }
            }

            // پردازش پیوست‌های تصویری
            const attachmentImages = [];
            if (Array.isArray(report.attachments)) {
                for (const attFile of report.attachments) {
                    const ext = attFile.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        const attUrl = pb.files.getUrl(report, attFile);
                        const buffer = await fetchImageAsBuffer(attUrl);
                        if (buffer) {
                            attachmentImages.push({ buffer, ext });
                        }
                    }
                }
            }

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
                comments: comments,
                // نگهداری موقت برای تزریق XML
                _coverImage: reportImages.find(i => i.type === 'cover'),
                _attachmentImages: attachmentImages,
                cover_image_xml: '',
                attachments_images: []
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

        // ۱. ویرایش [Content_Types].xml برای اطمینان از ثبت انواع پسوندهای تصویر
        let contentTypesXml = zip.file("[Content_Types].xml") ? zip.file("[Content_Types].xml").asText() : "";
        if (contentTypesXml) {
            const imageExtensions = [
                { ext: 'png', mime: 'image/png' },
                { ext: 'jpg', mime: 'image/jpeg' },
                { ext: 'jpeg', mime: 'image/jpeg' },
                { ext: 'gif', mime: 'image/gif' },
                { ext: 'webp', mime: 'image/webp' }
            ];
            for (const { ext, mime } of imageExtensions) {
                if (!contentTypesXml.includes(`Extension="${ext}"`)) {
                    contentTypesXml = contentTypesXml.replace(
                        '</Types>',
                        `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
                    );
                }
            }
            zip.file("[Content_Types].xml", contentTypesXml);
        }

        // ۲. آماده‌سازی فایل روابط word/_rels/document.xml.rels
        let relsXml = zip.file("word/_rels/document.xml.rels") ? zip.file("word/_rels/document.xml.rels").asText() : "";
        if (!relsXml) {
            relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
        }

        let imgCounter = 1;

        // تزریق فایل‌های تصویر به zip و تعریف رابطه
        for (const rep of reportsData) {
            if (rep._coverImage) {
                const relId = `rImgId${imgCounter}`;
                const imgPath = `word/media/image_${imgCounter}.${rep._coverImage.ext}`;
                zip.file(imgPath, rep._coverImage.buffer);

                relsXml = relsXml.replace('</Relationships>', `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_${imgCounter}.${rep._coverImage.ext}"/></Relationships>`);

                const dims = getImageDimensions(rep._coverImage.buffer);
                rep.cover_image_xml = buildDrawingXml(relId, imgCounter, dims.width, dims.height);
                imgCounter++;
            }

            if (rep._attachmentImages && rep._attachmentImages.length > 0) {
                rep.attachments_images = [];
                for (const attImg of rep._attachmentImages) {
                    const relId = `rImgId${imgCounter}`;
                    const imgPath = `word/media/image_${imgCounter}.${attImg.ext}`;
                    zip.file(imgPath, attImg.buffer);

                    relsXml = relsXml.replace('</Relationships>', `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_${imgCounter}.${attImg.ext}"/></Relationships>`);

                    const dims = getImageDimensions(attImg.buffer);
                    rep.attachments_images.push({
                        attachment_xml: buildDrawingXml(relId, imgCounter, dims.width, dims.height)
                    });
                    imgCounter++;
                }
            }
        }

        zip.file("word/_rels/document.xml.rels", relsXml);

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