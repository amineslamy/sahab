let pb;
let allReports = [];
let allComments = [];
let chartInstances = {};

const chartFont = 'Vazirmatn, sans-serif';

function setupApexDefaults() {
    if (window.ApexCharts && window.Apex) {
        window.Apex = {
            chart: { fontFamily: chartFont },
            dataLabels: { style: { fontFamily: chartFont, fontWeight: 'bold' } },
            tooltip: { style: { fontFamily: chartFont } },
            xaxis: { labels: { style: { fontFamily: chartFont } } },
            yaxis: { labels: { style: { fontFamily: chartFont } } },
            legend: { fontFamily: chartFont }
        };
    }
}

function getRoleBasedFilter() {
    const user = pb.authStore.model;
    if (!user) return "id = ''";

    const role = user.role;

    if (role === 'admin_site' || role === 'admin_general') {
        return "";
    }
    if (role === 'department') {
        return `(author = "${user.id}" || author.department_rel = "${user.id}")`;
    }
    if (role === 'expert') {
        return `author = "${user.id}"`;
    }
    return `author = "${user.id}"`;
}

document.addEventListener('DOMContentLoaded', async () => {
    pb = new PocketBase(window.location.origin);

    if (!pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    if (typeof window.renderGlobalHeader === 'function') {
        window.renderGlobalHeader();
    }

    setupApexDefaults();

    // بررسی وجود پارامتر author در URL
    const urlParams = new URLSearchParams(window.location.search);
    const authorParam = urlParams.get('author');

    await loadAnalyticsBaseData(authorParam);

    // راه‌اندازی تقویم شمسی با تنظیم پیش‌فرض ۳۰ روز گذشته
    if (window.$ && $.fn.persianDatepicker && window.persianDate) {
        const formatLocalDateToIso = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const pdTo = new persianDate();
        const pdFrom = new persianDate().subtract('days', 30);

        const isoTo = formatLocalDateToIso(pdTo.toDate());
        const isoFrom = formatLocalDateToIso(pdFrom.toDate());

        const $dateFrom = $('#filter-date-from');
        const $dateTo = $('#filter-date-to');

        $dateFrom.data('iso', isoFrom);
        $dateTo.data('iso', isoTo);

        $dateFrom.persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            onSelect: function (unix) {
                const pd = new persianDate(unix);
                const isoDate = formatLocalDateToIso(pd.toDate());
                $dateFrom.data('iso', isoDate);
            }
        });
        $dateFrom.val(pdFrom.format('YYYY/MM/DD'));

        $dateTo.persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            onSelect: function (unix) {
                const pd = new persianDate(unix);
                const isoDate = formatLocalDateToIso(pd.toDate());
                $dateTo.data('iso', isoDate);
            }
        });
        $dateTo.val(pdTo.format('YYYY/MM/DD'));

        applyAnalyticsDateFilter();
    } else {
        renderAnalyticsCharts(allReports);
    }
});

async function setupSubordinatesDropdown(activeAuthorId) {
    const currentUser = pb.authStore.model;
    if (!currentUser) return;

    const subContainer = document.getElementById('subordinates-container');
    const subSelect = document.getElementById('subordinate-select');
    if (!subContainer || !subSelect) return;

    // بارگذاری لیست کاربران زیرمجموعه بر اساس نقش
    let filterQuery = '';
    if (currentUser.role === 'department') {
        filterQuery = `department_rel = "${currentUser.id}"`;
    } else if (currentUser.role === 'admin_site' || currentUser.role === 'admin_general') {
        filterQuery = ''; // همه کاربران
    } else {
        return; // نقش‌های معمولی دسترسی تغییر زیرمجموعه ندارند
    }

    try {
        const users = await pb.collection('users').getFullList({
            filter: filterQuery,
            sort: 'name'
        });

        if (users.length > 0) {
            subSelect.innerHTML = `<option value="">-- گزارش کل زیرمجموعه‌ها --</option>`;
            
            // افزودن گزینه خود کاربر اداره در صورت لزوم
            if (currentUser.role === 'department') {
                const selfSelected = (activeAuthorId === currentUser.id) ? 'selected' : '';
                subSelect.innerHTML += `<option value="${currentUser.id}" ${selfSelected}>فقط گزارش‌های خودم (اداره)</option>`;
            }

            users.forEach(u => {
                const isSelected = (activeAuthorId === u.id) ? 'selected' : '';
                const nameStr = u.name || u.username || u.id;
                subSelect.innerHTML += `<option value="${u.id}" ${isSelected}>${nameStr} (${u.role})</option>`;
            });

            subContainer.classList.remove('hidden');
        }
    } catch (e) {
        console.error("خطا در دریافت کاربران زیرمجموعه:", e);
    }
}

function onSubordinateChange(selectedUserId) {
    const currentUrl = new URL(window.location.href);
    if (selectedUserId) {
        currentUrl.searchParams.set('author', selectedUserId);
    } else {
        currentUrl.searchParams.delete('author');
    }
    window.location.href = currentUrl.toString();
}

async function loadAnalyticsBaseData(authorId = null) {
    try {
        const roleFilter = getRoleBasedFilter();
        let finalFilter = roleFilter;
        let activeUserId = authorId;

        const userNameEl = document.getElementById('current-user-name');

        if (authorId) {
            let authorFilter = `author = "${authorId}"`;

            try {
                const targetUser = await pb.collection('users').getOne(authorId);
                const userName = targetUser.name || targetUser.username || 'کاربر انتخاب شده';
                if (userNameEl) userNameEl.innerText = userName;

                if (targetUser.role === 'department') {
                    authorFilter = `(author = "${authorId}" || author.department_rel = "${authorId}")`;
                }
            } catch (e) {
                console.error("خطا در دریافت اطلاعات کاربر هدف:", e);
                if (userNameEl) userNameEl.innerText = 'نامشخص';
            }

            finalFilter = roleFilter ? `(${roleFilter}) && (${authorFilter})` : authorFilter;
        } else {
            // اگر author در URL نباشد، نام کاربر جاری درج می‌شود
            const currentUser = pb.authStore.model;
            if (currentUser && userNameEl) {
                userNameEl.innerText = currentUser.name || currentUser.username || 'همه زیرمجموعه‌ها';
            }
            activeUserId = currentUser ? currentUser.id : null;
        }

        // تنظیم و پر کردن دراپ‌داون زیرمجموعه‌ها
        await setupSubordinatesDropdown(authorId);

        allReports = await pb.collection('reports').getFullList({
            sort: '-created',
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
            filter: finalFilter,
            requestKey: null
        });

        // دریافت تمام کامنت‌ها جهت تحلیل در ابر کلمات
        try {
            allComments = await pb.collection('comments').getFullList({
                fields: 'report,text',
                requestKey: null
            });
        } catch (cErr) {
            console.error("خطا در دریافت کامنت‌ها:", cErr);
            allComments = [];
        }

    } catch (err) {
        console.error("خطا در بارگذاری اطلاعات آمار:", err);
    }
}

function renderChart(elementSelector, options) {
    if (typeof ApexCharts === 'undefined') {
        setTimeout(() => renderChart(elementSelector, options), 100);
        return;
    }
    const el = document.querySelector(elementSelector);
    if (!el) return;

    if (chartInstances[elementSelector]) {
        chartInstances[elementSelector].destroy();
    }
    const chart = new ApexCharts(el, options);
    chart.render();
    chartInstances[elementSelector] = chart;
}

function convertIsoToFaShort(dateStr) {
    if (!dateStr || dateStr === 'نامشخص') return 'نامشخص';
    try {
        const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
        if (window.persianDate) {
            const parts = cleanDate.split('-');
            if (parts.length === 3) {
                const gDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const pd = new window.persianDate(gDate);
                return pd.format('YY/MM/DD');
            }
        }
        const d = new Date(cleanDate);
        return d.toLocaleDateString('fa-IR');
    } catch {
        return dateStr;
    }
}

function renderAnalyticsCharts(reportsData = allReports) {
    const countByField = (items, getKey, defaultValue = 'تعریف‌نشده') => {
        return items.reduce((acc, item) => {
            const key = getKey(item) || defaultValue;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    };

    const countByRelationArray = (items, getArray) => {
        const counts = {};
        items.forEach(item => {
            const arr = getArray(item) || [];
            arr.forEach(element => {
                if (element && element.title) {
                    counts[element.title] = (counts[element.title] || 0) + 1;
                }
            });
        });
        return counts;
    };

    const buildTimelineData = (items, dateField) => {
        const dateMap = {};
        items.forEach(item => {
            const rawDate = item[dateField];
            if (rawDate) {
                const day = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(' ')[0];
                dateMap[day] = (dateMap[day] || 0) + 1;
            }
        });
        const sortedDates = Object.keys(dateMap).sort();
        return {
            categories: sortedDates.map(d => convertIsoToFaShort(d)),
            values: sortedDates.map(d => dateMap[d])
        };
    };

    // ۱. روند زمانی انتشار
    const createdTimeline = buildTimelineData(reportsData, 'created');
    renderChart("#chart-timeline", {
        series: [{ name: 'تعداد اخبار', data: createdTimeline.values }],
        chart: { type: 'area', height: 260, toolbar: { show: false }, zoom: { enabled: false } },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#06b6d4'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        xaxis: { categories: createdTimeline.categories }
    });

    // ۲. عملکرد کاربران
    const userMap = countByField(reportsData, r => r.expand?.author?.name || r.expand?.author?.username, 'ناشناس');
    renderChart("#chart-user-performance", {
        series: [{ name: 'تعداد اخبار منتشر شده', data: Object.values(userMap) }],
        chart: { type: 'bar', height: 320, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 6, columnWidth: '40%' } },
        colors: ['#4f46e5'],
        xaxis: { categories: Object.keys(userMap) }
    });

    // ۳. تفکیک اداره
    const deptMap = countByField(reportsData, r => {
        const deptObj = r.expand?.author?.expand?.department_rel;
        return deptObj ? (deptObj.name || deptObj.username) : null;
    });
    renderChart("#chart-department", {
        series: [{ name: 'تعداد اخبار به تفکیک اداره', data: Object.values(deptMap) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 5, horizontal: true } },
        colors: ['#3b82f6'],
        xaxis: { categories: Object.keys(deptMap) }
    });

    // ۴. چکیده
    const summaryCounts = reportsData.reduce((acc, r) => {
        (r.abstract && r.abstract.trim() !== '') ? acc.hasSummary++ : acc.noSummary++;
        return acc;
    }, { hasSummary: 0, noSummary: 0 });
    renderChart("#chart-has-summary", {
        series: [summaryCounts.hasSummary, summaryCounts.noSummary],
        labels: ['دارای چکیده', 'بدون چکیده'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#94a3b8']
    });

    // ۵. تصویر پیوست
    const imageCounts = reportsData.reduce((acc, r) => {
        r.cover_image ? acc.hasImg++ : acc.noImg++;
        return acc;
    }, { hasImg: 0, noImg: 0 });
    renderChart("#chart-has-image", {
        series: [imageCounts.hasImg, imageCounts.noImg],
        labels: ['دارای تصویر', 'بدون تصویر'],
        chart: { type: 'donut', height: 250 },
        colors: ['#f59e0b', '#94a3b8']
    });

    // ۶. کیس‌ها
    const caseMap = countByRelationArray(reportsData, r => r.expand?.cases_rel);
    renderChart("#chart-analytics-cases", {
        series: Object.values(caseMap).length ? Object.values(caseMap) : [1],
        labels: Object.keys(caseMap).length ? Object.keys(caseMap) : ['بدون کیس'],
        chart: { type: 'donut', height: 250 },
        colors: ['#8b5cf6', '#06b6d4', '#a855f7', '#6366f1', '#ec4899', '#f59e0b', '#f97316', '#14b8a6', '#eab308', '#ef4444', '#3b82f6', '#84cc16', '#d97706', '#64748b']
    });

    // ۷. موضوعات
    const topicMap = countByRelationArray(reportsData, r => r.expand?.topics_rel);
    renderChart("#chart-analytics-topics", {
        series: Object.values(topicMap).length ? Object.values(topicMap) : [1],
        labels: Object.keys(topicMap).length ? Object.keys(topicMap) : ['بدون موضوع'],
        chart: { type: 'donut', height: 250 },
        colors: ['#6366f1', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#84cc16', '#d97706', '#64748b']
    });

    // ۸. ثبت کننده
    const submitterMap = countByField(reportsData, r => r.expand?.submitter?.name || r.expand?.submitter?.username, 'سیستم');
    renderChart("#chart-analytics-creators", {
        series: [{ name: 'تعداد ثبت', data: Object.values(submitterMap) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '40%' } },
        colors: ['#06b6d4'],
        xaxis: { categories: Object.keys(submitterMap) }
    });

    // ۹. طبقه‌بندی
    const classMap = countByField(reportsData, r => r.classification);
    renderChart("#chart-classification", {
        series: Object.values(classMap),
        labels: Object.keys(classMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#8b5cf6', '#3b82f6', '#f97316', '#ec4899', '#cde73a']
    });

    // ۱۰. اولویت
    const prioMap = countByField(reportsData, r => r.priority);
    renderChart("#chart-priority", {
        series: Object.values(prioMap),
        labels: Object.keys(prioMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#3b82f6', '#f59e0b', '#ef4444', '#de48ec']
    });

    // ۱۱. نوع خبر
    const typeMap = countByField(reportsData, r => r.news_type);
    renderChart("#chart-news-type", {
        series: Object.values(typeMap),
        labels: Object.keys(typeMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#14b8a6', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#64748b']
    });

    // ۱۲. ارزیابی
    const evalMap = countByField(reportsData, r => r.evaluation);
    renderChart("#chart-evaluation", {
        series: Object.values(evalMap),
        labels: Object.keys(evalMap),
        chart: { type: 'donut', height: 250 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#bb48ec']
    });

    // ۱۳. روند زمانی تاریخ وقوع
    const occTimeline = buildTimelineData(reportsData, 'occurrence_date');
    renderChart("#chart-occurrence-timeline", {
        series: [{ name: 'تعداد اخبار (تاریخ وقوع)', data: occTimeline.values }],
        chart: { type: 'area', height: 260, toolbar: { show: false }, zoom: { enabled: false } },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#0284c7'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        xaxis: { categories: occTimeline.categories }
    });

    // ۱۴. ابر کلمات کلیدی
    renderWordCloud(reportsData);
}

function renderWordCloud(reportsData) {
    const canvas = document.getElementById('word-cloud-canvas');
    const emptyEl = document.getElementById('word-cloud-empty');
    if (!canvas || typeof WordCloud === 'undefined') return;

    // شناسه اخباری که در فیلتر فعلی قرار دارند
    const activeReportIds = new Set(reportsData.map(r => r.id));

    // لیست حروف ربط و کلمات عمومی (Stop Words) برای حذف از ابر کلمات
    const stopWords = new Set([
        'در', 'به', 'از', 'که', 'می', 'این', 'را', 'با', 'است', 'برای', 'آن', 'یک', 'شود', 'شده', 'خود',
        'ها', 'های', 'بر', 'تا', 'نیز', 'وی', 'شد', 'علاوه', 'هم', 'کند', 'کرد', 'برای', 'یا', 'اما',
        'باشد', 'باید', 'داد', 'داشت', 'آنها', 'ویژه', 'جهت', 'پس', 'بین', 'توسط', 'طی', 'چون', 'کل',
        'p', 'br', 'div', 'span', 'href', 'http', 'https', 'strong', 'em', ' style', 'class'
    ]);

    let combinedText = '';

    // جمع‌آوری متون اخبار فیلترشده
    reportsData.forEach(r => {
        if (r.title) combinedText += ' ' + r.title;
        if (r.abstract) combinedText += ' ' + r.abstract;
        if (r.content) combinedText += ' ' + r.content;
    });

    // جمع‌آوری متون کامنت‌های مربوط به اخبار فیلترشده
    allComments.forEach(c => {
        if (c.report && activeReportIds.has(c.report) && c.text) {
            combinedText += ' ' + c.text;
        }
    });

    // پاک‌سازی تگ‌های HTML
    const cleanText = combinedText.replace(/<[^>]*>/g, ' ')
        .replace(/[0-9\u0660-\u0669\u06f0-\u06f9]/g, ' ') // حذف ارقام
        .replace(/[^\u0600-\u06FF\s]/g, ' '); // نگه‌داشتن فقط حروف فارسی

    // استخراج کلمات و شمارش فراوانی
    const words = cleanText.split(/\s+/);
    const wordCounts = {};

    words.forEach(w => {
        const word = w.trim();
        if (word.length > 2 && !stopWords.has(word)) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    });

    // تبدیل به فرمت مورد نیاز WordCloud2 [[word, size], ...]
    const list = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 80) // حداکثر ۸۰ کلمه پرتکرار
        .map(([text, count]) => [text, count]);

    if (list.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // تنظیم ابعاد Canvas بر اساس کانتینر
    canvas.width = canvas.parentElement.clientWidth || 800;
    canvas.height = 300;

    // مقیاس‌گذاری اندازه فونت
    const maxCount = list[0][1];
    const minCount = list[list.length - 1][1];
    const weightFactor = (size) => {
        if (maxCount === minCount) return 20;
        return 14 + ((size - minCount) / (maxCount - minCount)) * 36;
    };

    WordCloud(canvas, {
        list: list,
        fontFamily: 'Vazirmatn, sans-serif',
        weightFactor: weightFactor,
        color: () => {
            const colors = ['#4f46e5', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6'];
            return colors[Math.floor(Math.random() * colors.length)];
        },
        backgroundColor: 'transparent',
        rotateRatio: 0, // کلمات افقی جهت خوانایی بهتر
        gridSize: 8,
        drawOutOfBound: false
    });
}

function applyAnalyticsDateFilter() {
    const $fromInput = $('#filter-date-from');
    const $toInput = $('#filter-date-to');

    const fromVal = $fromInput.val() ? $fromInput.val().trim() : '';
    const toVal = $toInput.val() ? $toInput.val().trim() : '';

    let fromStr = $fromInput.data('iso');
    let toStr = $toInput.data('iso');

    if (!fromStr && fromVal && window.persianDate) {
        try {
            const p = fromVal.split('/');
            if (p.length === 3) {
                const pd = new persianDate([parseInt(p[0]), parseInt(p[1]), parseInt(p[2])]);
                const d = pd.toDate();
                fromStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch (e) { }
    }

    if (!toStr && toVal && window.persianDate) {
        try {
            const p = toVal.split('/');
            if (p.length === 3) {
                const pd = new persianDate([parseInt(p[0]), parseInt(p[1]), parseInt(p[2])]);
                const d = pd.toDate();
                toStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch (e) { }
    }

    let filtered = allReports;

    if (fromStr) {
        filtered = filtered.filter(r => {
            if (!r.created) return false;
            const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
            return rDate >= fromStr;
        });
    }

    if (toStr) {
        try {
            const parts = toStr.split('-');
            const endDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            endDate.setDate(endDate.getDate() + 1);

            const nextDayStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

            filtered = filtered.filter(r => {
                if (!r.created) return false;
                const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
                return rDate < nextDayStr;
            });
        } catch (e) {
            filtered = filtered.filter(r => {
                if (!r.created) return false;
                const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
                return rDate <= toStr;
            });
        }
    }

    renderAnalyticsCharts(filtered);
}