let pb;
let allReports = [];
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

async function loadAnalyticsBaseData(authorId = null) {
    try {
        const roleFilter = getRoleBasedFilter();
        let finalFilter = roleFilter;

        if (authorId) {
            let authorFilter = `author = "${authorId}"`;

            try {
                const targetUser = await pb.collection('users').getOne(authorId);
                const userName = targetUser.name || targetUser.username || 'کاربر انتخاب شده';
                const subtitleEl = document.getElementById('analytics-subtitle');
                if (subtitleEl) subtitleEl.innerText = `نمایش آمار تخصصی و نمودارهای مربوط به کاربر: ${userName}`;

                if (targetUser.role === 'department') {
                    authorFilter = `(author = "${authorId}" || author.department_rel = "${authorId}")`;
                }
            } catch (e) {
                console.error("خطا در دریافت اطلاعات کاربر هدف:", e);
            }

            finalFilter = roleFilter ? `(${roleFilter}) && (${authorFilter})` : authorFilter;
        }

        allReports = await pb.collection('reports').getFullList({
            sort: '-created',
            expand: 'cases_rel,topics_rel,author.department_rel,department,submitter',
            filter: finalFilter,
            requestKey: null
        });

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