document.addEventListener('DOMContentLoaded', () => {
    const PB_URL = window.location.origin;
    const VERSIONS_COLLECTION = 'report_versions';

    const state = {
        pb: null,
        reportId: null,
        versions: [],
        currentReport: null,
        topicsMap: {},
        casesMap: {}
    };

    const $id = (id) => document.getElementById(id);

    async function boot() {
        try {
            state.pb = new PocketBase(PB_URL);
            const urlParams = new URLSearchParams(window.location.search);
            state.reportId = urlParams.get('id');

            if (state.reportId) {
                await fetchVersions();
            }
        } catch (err) {
            console.error('خطا در راه‌اندازی ماژول تاریخچه نسخه‌ها:', err);
        }
    }

    boot();

    async function fetchVersions() {
        try {
            // دریافت لیست کامل موضوعات، کیس‌ها و کاربران جهت نگاشت ID به عنوان فارسی
            const [topics, cases, users] = await Promise.all([
                state.pb.collection('topics').getFullList({ fields: 'id,title' }).catch(() => []),
                state.pb.collection('cases').getFullList({ fields: 'id,title' }).catch(() => []),
                state.pb.collection('users').getFullList({ fields: 'id,name,username' }).catch(() => [])
            ]);

            state.usersMap = {};
            users.forEach(u => { state.usersMap[u.id] = u.name || u.username || u.id; });
            topics.forEach(t => { state.topicsMap[t.id] = t.title; });
            cases.forEach(c => { state.casesMap[c.id] = c.title; });

            const [currentReport, currentComments, records] = await Promise.all([
                state.pb.collection('reports').getOne(state.reportId),
                state.pb.collection('comments').getFullList({
                    filter: `report = "${state.reportId}"`,
                    sort: '+created',
                    expand: 'author'
                }).catch(() => []),
                state.pb.collection(VERSIONS_COLLECTION).getFullList({
                    filter: `report = "${state.reportId}"`,
                    sort: '-version',
                    expand: 'author,submitter'
                })
            ]);

            state.currentReport = currentReport;
            state.currentComments = currentComments;
            state.versions = records;
            renderVersionsAccordion();
        } catch (err) {
            console.error('خطا در دریافت تاریخچه نسخه‌ها:', err);
        }
    }
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function stripTags(html) {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    // الگوریتم مقایسه کلمه‌ای با حفظ فاصله‌ها و عدم چسبندگی کلمات
    function diffWords(oldText, newText) {
        const str1 = String(oldText || '').trim();
        const str2 = String(newText || '').trim();

        if (!str1 && !str2) {
            return {
                oldHtml: '<span class="text-slate-400 italic">(خالی)</span>',
                newHtml: '<span class="text-slate-400 italic">(خالی)</span>'
            };
        }

        // استفاده از diffWordsWithSpace جهت حفظ دقیق فاصله‌ها بین کلمات
        const changes = Diff.diffWordsWithSpace(str1, str2);
        let oldHtml = '';
        let newHtml = '';

        changes.forEach(part => {
            const escapedValue = escapeHtml(part.value);
            if (part.added) {
                newHtml += `<mark class="inline mx-0.5 bg-cyan-100 text-cyan-900 px-1 py-0.5 rounded font-bold border border-cyan-300">${escapedValue}</mark>`;
            } else if (part.removed) {
                oldHtml += `<mark class="inline mx-0.5 bg-rose-100 text-rose-900 line-through px-1 py-0.5 rounded font-bold border border-rose-300">${escapedValue}</mark>`;
            } else {
                oldHtml += escapedValue;
                newHtml += escapedValue;
            }
        });

        return {
            oldHtml: oldHtml || '<span class="text-slate-400 italic">(خالی)</span>',
            newHtml: newHtml || '<span class="text-slate-400 italic">(خالی)</span>'
        };
    }

    function renderRelationItems(items) {
        if (!items || !items.length) return '<span class="text-slate-400 text-xs">(بدون آیتم)</span>';
        let itemList = items;
        if (typeof items === 'string') {
            try { itemList = JSON.parse(items); } catch { itemList = [items]; }
        }
        if (!Array.isArray(itemList)) itemList = [itemList];

        return itemList.map(item => {
            if (typeof item === 'object' && item !== null) {
                const itemId = item.id || item;
                return item.title || item.name || state.topicsMap[itemId] || state.casesMap[itemId] || itemId || '';
            }
            const strVal = String(item).trim();
            return state.topicsMap[strVal] || state.casesMap[strVal] || strVal;
        }).filter(Boolean).join('، ');
    }
    function formatOccurrenceDate(dateStr) {
        if (!dateStr) return '';
        try {
            const pDate = new persianDate(new Date(dateStr));
            return pDate.format('YYYY/MM/DD HH:mm');
        } catch (e) {
            return dateStr;
        }
    }
    function renderAttachmentsThumbnails(files, mainReportId) {
        if (!files) return '<span class="text-slate-400 text-xs">(بدون فایل)</span>';

        let fileList = [];
        if (typeof files === 'string') {
            try { fileList = JSON.parse(files); } catch { fileList = [files]; }
        } else if (Array.isArray(files)) {
            fileList = files;
        }

        if (!fileList.length) return '<span class="text-slate-400 text-xs">(بدون فایل)</span>';

        return `<div class="flex flex-wrap gap-2 mt-1">
            ${fileList.map(f => {
            const fileName = typeof f === 'object' ? (f.name || f.file || '') : f;
            // لینک فایل‌ها همیشه به کالکشن اصلی reports و ID گزارش اصلی اشاره دارد
            const fileUrl = `${PB_URL}/api/files/reports/${mainReportId}/${fileName}`;
            const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

            if (isImg) {
                return `
                        <a href="${fileUrl}" target="_blank" class="block border rounded p-1 bg-white hover:shadow transition">
                            <img src="${fileUrl}" class="w-14 h-14 object-cover rounded" alt="${escapeHtml(fileName)}" title="${escapeHtml(fileName)}">
                        </a>
                    `;
            }
            return `
                    <a href="${fileUrl}" target="_blank" class="flex items-center gap-1 p-1.5 border rounded bg-white text-xs text-slate-700 hover:bg-slate-100 transition" title="${escapeHtml(fileName)}">
                        📁 <span class="max-w-[100px] truncate">${escapeHtml(fileName)}</span>
                    </a>
                `;
        }).join('')}
        </div>`;
    }

    function renderCoverThumbnail(coverImg, mainReportId) {
        if (!coverImg) return '<span class="text-slate-400 text-xs">(بدون کاور)</span>';
        // لینک کاور همیشه به کالکشن اصلی reports و ID گزارش اصلی اشاره دارد
        const imgUrl = `${PB_URL}/api/files/reports/${mainReportId}/${coverImg}`;
        return `
            <div class="mt-1">
                <a href="${imgUrl}" target="_blank" class="inline-block border rounded p-1 bg-white">
                    <img src="${imgUrl}" class="w-20 h-20 object-cover rounded" alt="کاور" />
                </a>
            </div>
        `;
    }

    function initMainAccordionEvents() {
        const mainToggleBtn = $id('main-versions-accordion-toggle');
        const mainContent = $id('main-versions-accordion-content');
        const mainArrow = $id('main-versions-arrow');

        if (mainToggleBtn && mainContent && mainArrow) {
            mainToggleBtn.onclick = () => {
                const isHidden = mainContent.classList.contains('hidden');
                mainContent.classList.toggle('hidden', !isHidden);
                mainArrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };
        }
    }

    function renderVersionsAccordion() {
        initMainAccordionEvents();

        const container = $id('versions-history-container');
        if (!container) return;

        container.innerHTML = '';

        if (!state.versions || state.versions.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 font-semibold text-sm">هیچ نسخه قبلی برای این گزارش ثبت نشده است.</div>';
            return;
        }

        const mainReportId = state.reportId;

        state.versions.forEach((ver, idx) => {
            const nextVer = state.versions[idx - 1] || state.currentReport;
            const card = document.createElement('div');
            card.className = 'version-card border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-3';

            const createdDate = ver.created ? new Date(ver.created).toLocaleDateString('fa-IR') : 'نامشخص';
            const rawAuthor = ver.author || ver.expand?.author?.id;
            const authorName = ver.expand?.author?.name || ver.expand?.author?.username || (state.usersMap && state.usersMap[rawAuthor]) || (state.usersMap && state.usersMap[ver.author]) || 'نامشخص';
            const nextVersionLabel = (idx === 0) ? 'نسخه فعلی' : `نسخه ${nextVer.version}`;

            function parseCommentsData(commentsData) {
                if (typeof commentsData === 'string') {
                    try { return JSON.parse(commentsData); } catch { return []; }
                }
                return Array.isArray(commentsData) ? commentsData : [];
            }

            function renderDiffComments(oldCommentsData, newCommentsData) {
                const oldList = parseCommentsData(oldCommentsData);
                const newList = parseCommentsData(newCommentsData);

                if (oldList.length === 0 && newList.length === 0) {
                    return {
                        oldHtml: '<span class="text-slate-400 italic font-normal">(بدون دیدگاه)</span>',
                        newHtml: '<span class="text-slate-400 italic font-normal">(بدون دیدگاه)</span>'
                    };
                }

                const commentIdToAuthorName = {};
                [...oldList, ...newList].forEach(c => {
                    const name = c.authorName || c.expand?.author?.name || c.expand?.author?.username || (state.usersMap && state.usersMap[c.author]) || null;
                    if (c.id && name) {
                        commentIdToAuthorName[c.id] = name;
                    }
                });

                const newMap = {};
                newList.forEach((c, i) => {
                    const key = c.id || `idx_${i}`;
                    newMap[key] = c;
                });

                const matchedNewKeys = new Set();
                const oldCardHtmls = [];
                const newCardHtmls = [];

                function buildCardHtml(c, diffTextHtml) {
                    const rawAuthor = c.authorName || c.expand?.author?.name || c.expand?.author?.username || c.author;
                    const authorName = escapeHtml((state.usersMap && state.usersMap[rawAuthor]) || rawAuthor || 'کاربر سیستم');
                    const typeStr = c.type ? `<span class="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md">${escapeHtml(c.type)}</span>` : '';

                    let dateStr = '';
                    if (c.created) {
                        try {
                            const pDate = new persianDate(new Date(c.created));
                            dateStr = pDate.format('YYYY/MM/DD HH:mm');
                        } catch (e) {
                            dateStr = c.created;
                        }
                    }

                    let parentNotice = '';
                    if (c.parent) {
                        let parentAuthorName = commentIdToAuthorName[c.parent] || (state.usersMap && state.usersMap[c.parent]) || 'دیدگاه دیگر';
                        parentNotice = `<div class="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border-r-2 border-slate-400 mb-1">💬 در پاسخ به: ${escapeHtml(parentAuthorName)}</div>`;
                    }

                    return `
                        <div class="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1.5 mb-2 text-right">
                            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs font-bold text-slate-900">👤 ${authorName}</span>
                                    ${typeStr}
                                </div>
                                <span class="text-[10px] text-slate-400 font-medium">${dateStr}</span>
                            </div>
                            ${parentNotice}
                            <div class="text-xs text-slate-700 leading-relaxed font-semibold">
                                ${diffTextHtml}
                            </div>
                        </div>
                    `;
                }

                oldList.forEach((oldC, i) => {
                    const key = oldC.id || `idx_${i}`;
                    const newC = newMap[key];

                    if (newC) {
                        matchedNewKeys.add(key);
                        const diff = diffWords(oldC.text || '', newC.text || '');
                        oldCardHtmls.push(buildCardHtml(oldC, diff.oldHtml));
                        newCardHtmls.push(buildCardHtml(newC, diff.newHtml));
                    } else {
                        const diff = diffWords(oldC.text || '', '');
                        oldCardHtmls.push(buildCardHtml(oldC, diff.oldHtml));
                    }
                });

                newList.forEach((newC, i) => {
                    const key = newC.id || `idx_${i}`;
                    if (!matchedNewKeys.has(key)) {
                        const diff = diffWords('', newC.text || '');
                        newCardHtmls.push(buildCardHtml(newC, diff.newHtml));
                    }
                });

                return {
                    oldHtml: oldCardHtmls.join('') || '<span class="text-slate-400 italic font-normal">(بدون دیدگاه)</span>',
                    newHtml: newCardHtmls.join('') || '<span class="text-slate-400 italic font-normal">(بدون دیدگاه)</span>'
                };
            }

            const oldAuthorRaw = ver.author || ver.expand?.author?.id;
            const newAuthorRaw = nextVer.author || nextVer.expand?.author?.id;
            const oldAuthorName = ver.expand?.author?.name || ver.expand?.author?.username || (state.usersMap && state.usersMap[oldAuthorRaw]) || 'نامشخص';
            const newAuthorName = nextVer.expand?.author?.name || nextVer.expand?.author?.username || (state.usersMap && state.usersMap[newAuthorRaw]) || 'نامشخص';

            const fieldsToCompare = [
                { label: 'عنوان گزارش', oldVal: ver.title, newVal: nextVer.title },
                { label: 'نویسنده گزارش', oldVal: oldAuthorName, newVal: newAuthorName },
                { label: 'دلیل تغییرات', oldVal: ver.change_reason, newVal: nextVer.change_reason },
                { label: 'چکیده', oldVal: ver.abstract, newVal: nextVer.abstract },
                { label: 'شرح و متن اصلی', oldVal: stripTags(ver.content), newVal: stripTags(nextVer.content) },
                { label: 'طبقه بندی', oldVal: ver.classification, newVal: nextVer.classification },
                { label: 'اولیت', oldVal: ver.priority, newVal: nextVer.priority },
                { label: 'نوع خبر', oldVal: ver.news_type, newVal: nextVer.news_type },
                { label: 'ارزیابی', oldVal: ver.evaluation, newVal: nextVer.evaluation },
                { label: 'تاریخ وقوع', oldVal: formatOccurrenceDate(ver.occurrence_date), newVal: formatOccurrenceDate(nextVer.occurrence_date) },
                { label: 'موضوعات مرتبط', oldVal: renderRelationItems(ver.expand?.topics_rel || ver.topics_rel), newVal: renderRelationItems(nextVer.expand?.topics_rel || nextVer.topics_rel) },
                { label: 'کیس‌های مرتبط', oldVal: renderRelationItems(ver.expand?.cases_rel || ver.cases_rel), newVal: renderRelationItems(nextVer.expand?.cases_rel || nextVer.cases_rel) }
            ];

            let sideBySideFieldsHtml = '';

            fieldsToCompare.forEach(field => {
                const diff = diffWords(field.oldVal, field.newVal);
                sideBySideFieldsHtml += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/50">
                        <td class="p-3 font-bold text-xs text-slate-600 bg-slate-50/70 w-28 align-top">${field.label}</td>
                        <td class="p-3 text-xs leading-relaxed text-slate-800 w-1/2 align-top border-l border-slate-100 bg-rose-50/20">${diff.oldHtml}</td>
                        <td class="p-3 text-xs leading-relaxed text-slate-800 w-1/2 align-top bg-cyan-50/20">${diff.newHtml}</td>
                    </tr>
                `;
            });

            const oldComments = ver.snapshot_comments || ver.comments;
            let newComments = nextVer.snapshot_comments || nextVer.comments;
            
            if (nextVer.id === state.currentReport?.id || idx === 0) {
                newComments = state.currentComments || nextVer.snapshot_comments || [];
            }

            const commentsDiffResult = renderDiffComments(oldComments, newComments);

            const commentsDiffHtml = `
                <tr class="border-b border-slate-100 hover:bg-slate-50/50">
                    <td class="p-3 font-bold text-xs text-slate-600 bg-slate-50/70 w-28 align-top">نظرات و ملاحظات</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top border-l border-slate-100 bg-rose-50/20">${commentsDiffResult.oldHtml}</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top bg-cyan-50/20">${commentsDiffResult.newHtml}</td>
                </tr>
            `;

            const coverDiffHtml = `
                <tr class="border-b border-slate-100 hover:bg-slate-50/50">
                    <td class="p-3 font-bold text-xs text-slate-600 bg-slate-50/70 w-28 align-top">تصویر کاور</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top border-l border-slate-100 bg-rose-50/20">${renderCoverThumbnail(ver.cover_image, mainReportId)}</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top bg-cyan-50/20">${renderCoverThumbnail(nextVer.cover_image, mainReportId)}</td>
                </tr>
            `;

            const attachmentsDiffHtml = `
                <tr class="border-b border-slate-100 hover:bg-slate-50/50">
                    <td class="p-3 font-bold text-xs text-slate-600 bg-slate-50/70 w-28 align-top">فایل‌های پیوست</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top border-l border-slate-100 bg-rose-50/20">${renderAttachmentsThumbnails(ver.attachments, mainReportId)}</td>
                    <td class="p-3 text-xs text-slate-800 w-1/2 align-top bg-cyan-50/20">${renderAttachmentsThumbnails(nextVer.attachments, mainReportId)}</td>
                </tr>
            `;

            card.innerHTML = `
                <button type="button" class="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200 text-right accordion-toggle-btn">
                    <div class="flex items-center gap-3">
                        <span class="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-md">نسخه ${ver.version}</span>
                        <span class="text-sm font-bold text-slate-800">${escapeHtml(ver.title || 'بدون عنوان')}</span>
                        <span class="text-xs text-slate-400">ویرایش‌شده توسط ${escapeHtml(authorName)}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-400 font-medium">${createdDate}</span>
                        <span class="text-slate-500 font-bold transform transition-transform duration-200 accordion-arrow">▼</span>
                    </div>
                </button>
                <div class="accordion-content hidden p-4 space-y-4 bg-white">
                    <div class="overflow-x-auto border border-slate-200 rounded-lg">
                        <table class="w-full border-collapse text-right">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 text-xs border-b border-slate-200">
                                    <th class="p-2.5 w-28">نام فیلد</th>
                                    <th class="p-2.5 w-1/2 text-rose-700 font-bold border-l border-slate-200">⬅️ نسخه قبلی (نسخه ${ver.version})</th>
                                    <th class="p-2.5 w-1/2 text-cyan-700 font-bold">➡️ نسخه بعدی (${nextVersionLabel})</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sideBySideFieldsHtml}
                                ${commentsDiffHtml}
                                ${coverDiffHtml}
                                ${attachmentsDiffHtml}
                            </tbody>
                        </table>
                    </div>
                    <div class="flex justify-end pt-2 border-t border-slate-100">
                        <button type="button" class="restore-version-btn px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition">
                            🔄 بازیابی این نسخه به فرم
                        </button>
                    </div>
                </div>
            `;

            const toggleBtn = card.querySelector('.accordion-toggle-btn');
            const content = card.querySelector('.accordion-content');
            const arrow = card.querySelector('.accordion-arrow');
            const restoreBtn = card.querySelector('.restore-version-btn');

            toggleBtn.addEventListener('click', () => {
                const isHidden = content.classList.contains('hidden');

                // بستن سایر آکاردئون‌های نسخه باز شده (رفتار آکاردئون تک‌باز)
                if (isHidden) {
                    container.querySelectorAll('.version-card').forEach(otherCard => {
                        if (otherCard !== card) {
                            const otherContent = otherCard.querySelector('.accordion-content');
                            const otherArrow = otherCard.querySelector('.accordion-arrow');
                            if (otherContent) otherContent.classList.add('hidden');
                            if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
                        }
                    });
                }

                content.classList.toggle('hidden', !isHidden);
                arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';

                // انتقال نرم صفحه به بالای آکاردئون باز شده
                if (isHidden) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });

            restoreBtn.addEventListener('click', () => {
                const confirmed = confirm(`آیا مطمئن هستید که می‌خواهید نسخه ${ver.version} را روی فرم بازیابی کنید؟`);
                if (confirmed && typeof window.restoreReportVersionToForm === 'function') {
                    window.restoreReportVersionToForm(ver);
                }
            });

            container.appendChild(card);
        });
    }
});