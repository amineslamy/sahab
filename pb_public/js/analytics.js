let pb;
let allReports = [];
let allComments = [];
let allCases = [];
let allTopics = [];
let chartInstances = {};
let chartConfigs = {};
let modalChartInstance = null;
let currentFilteredReports = [];

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

        // اطمینان از پر بودن Dropdownها
        populateFilterDropdowns();

        // ثبت رویداد تغییر برای دراپ‌داون‌های کیس و موضوع
        document.getElementById('filter-case-select')?.addEventListener('change', applyAnalyticsDateFilter);
        document.getElementById('filter-topic-select')?.addEventListener('change', applyAnalyticsDateFilter);

        applyAnalyticsDateFilter();
    } else {
        populateFilterDropdowns();
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

        // بارگذاری لیست کیس‌ها و موضوعات برای دراپ‌داون‌های فیلتر
        try {
            allCases = await pb.collection('cases').getFullList({ sort: 'title', requestKey: null });
            allTopics = await pb.collection('topics').getFullList({ sort: 'title', requestKey: null });
            
            populateFilterDropdowns();
        } catch (fErr) {
            console.error("خطا در دریافت لیست کیس‌ها و موضوعات:", fErr);
        }

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

function populateFilterDropdowns() {
    const caseSelect = document.getElementById('filter-case-select');
    const topicSelect = document.getElementById('filter-topic-select');

    if (caseSelect) {
        let caseOptions = '<option value="">همه کیس‌ها</option>';
        allCases.forEach(c => {
            caseOptions += `<option value="${c.id}">${c.title || c.id}</option>`;
        });
        caseSelect.innerHTML = caseOptions;
    }

    if (topicSelect) {
        let topicOptions = '<option value="">همه موضوعات</option>';
        allTopics.forEach(t => {
            topicOptions += `<option value="${t.id}">${t.title || t.id}</option>`;
        });
        topicSelect.innerHTML = topicOptions;
    }
}

function renderChart(elementSelector, options) {
    if (typeof ApexCharts === 'undefined') {
        setTimeout(() => renderChart(elementSelector, options), 100);
        return;
    }
    const el = document.querySelector(elementSelector);
    if (!el) return;

    // ذخیره کانفیگ نمودار برای استفاده در مودال تمام‌صفحه
    chartConfigs[elementSelector] = options;

    if (chartInstances[elementSelector]) {
        chartInstances[elementSelector].destroy();
    }
    const chart = new ApexCharts(el, options);
    chart.render();
    chartInstances[elementSelector] = chart;
}

function openChartModal(elementSelector, title) {
    const modal = document.getElementById('chart-modal');
    const titleEl = document.getElementById('modal-chart-title');
    const targetEl = document.getElementById('chart-modal-target');
    if (!modal || !targetEl) return;

    if (titleEl) titleEl.innerText = title;

    modal.classList.remove('hidden');

    if (modalChartInstance) {
        modalChartInstance.destroy();
    }

    // دریافت تنظیمات نمودار اصلی و تغییر ارتفاع برای حالت تمام‌صفحه
    const originalOptions = chartConfigs[elementSelector];
    if (originalOptions) {
        const modalOptions = JSON.parse(JSON.stringify(originalOptions));
        modalOptions.chart = modalOptions.chart || {};
        modalOptions.chart.height = '100%';
        modalOptions.chart.toolbar = { show: true }; // فعال‌سازی نوار ابزار دانلود و زوم در مودال

        modalChartInstance = new ApexCharts(targetEl, modalOptions);
        modalChartInstance.render();
    }
}

function closeChartModal() {
    const modal = document.getElementById('chart-modal');
    if (modal) modal.classList.add('hidden');
    if (modalChartInstance) {
        modalChartInstance.destroy();
        modalChartInstance = null;
    }
    const targetEl = document.getElementById('chart-modal-target');
    if (targetEl) targetEl.innerHTML = '';
}

function openWordCloudModal() {
    const modal = document.getElementById('chart-modal');
    const titleEl = document.getElementById('modal-chart-title');
    const targetEl = document.getElementById('chart-modal-target');
    if (!modal || !targetEl) return;

    if (titleEl) titleEl.innerText = '☁️ ابر کلمات کلیدی (اخبار و کامنت‌ها)';

    if (modalChartInstance) {
        modalChartInstance.destroy();
        modalChartInstance = null;
    }

    targetEl.innerHTML = `
        <div id="modal-word-cloud-container" class="w-full h-full min-h-[450px] flex justify-center items-center bg-slate-50 rounded-xl p-2 border border-slate-100 relative overflow-hidden">
            <div id="modal-word-cloud-svg" class="w-full h-full flex justify-center items-center"></div>
            <div id="modal-word-cloud-empty" class="hidden absolute text-slate-400 text-xs font-bold">کلمه‌ای برای نمایش یافت نشد</div>
        </div>
    `;

    modal.classList.remove('hidden');

    // اطمینان از محاسبه ابعاد دقیق مودال پس از نمایش در DOM
    requestAnimationFrame(() => {
        setTimeout(() => {
            renderWordCloud(currentFilteredReports, {
                svgId: 'modal-word-cloud-svg',
                containerId: 'modal-word-cloud-container',
                emptyId: 'modal-word-cloud-empty',
                isModal: true
            });
        }, 100);
    });
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
    currentFilteredReports = reportsData;    const countByField = (items, getKey, defaultValue = 'تعریف‌نشده') => {
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

    // ۱۴. نمودار ستونی انباشته — توزیع طبقه‌بندی بر اساس دپارتمان
    const deptClassMap = {};
    const classifications = Set ? Array.from(new Set(reportsData.map(r => r.classification || 'تعریف‌نشده'))) : [];
    
    reportsData.forEach(r => {
        const deptObj = r.expand?.author?.expand?.department_rel;
        const deptName = deptObj ? (deptObj.name || deptObj.username) : 'نامشخص';
        const cls = r.classification || 'تعریف‌نشده';

        if (!deptClassMap[deptName]) deptClassMap[deptName] = {};
        deptClassMap[deptName][cls] = (deptClassMap[deptName][cls] || 0) + 1;
    });

    const deptCategories = Object.keys(deptClassMap);
    const stackedSeries = classifications.map(cls => ({
        name: cls,
        data: deptCategories.map(d => deptClassMap[d][cls] || 0)
    }));

    renderChart("#chart-stacked-classification", {
        series: stackedSeries,
        chart: { type: 'bar', height: 280, stacked: true, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
        xaxis: { categories: deptCategories },
        legend: { position: 'top' }
    });

    // ۱۵. نمودار میله‌ای افقی — وضعیت اولویت و نوع خبر
    const priorityTypeMap = {};
    const newsTypes = Array.from(new Set(reportsData.map(r => r.news_type || 'تعریف‌نشده')));
    
    reportsData.forEach(r => {
        const prio = r.priority || 'عادی';
        const type = r.news_type || 'تعریف‌نشده';

        if (!priorityTypeMap[prio]) priorityTypeMap[prio] = {};
        priorityTypeMap[prio][type] = (priorityTypeMap[prio][type] || 0) + 1;
    });

    const prioCategories = Object.keys(priorityTypeMap);
    const prioSeries = newsTypes.map(t => ({
        name: t,
        data: prioCategories.map(p => priorityTypeMap[p][t] || 0)
    }));

    renderChart("#chart-priority-newstype", {
        series: prioSeries,
        chart: { type: 'bar', height: 280, stacked: true, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true } },
        xaxis: { categories: prioCategories },
        legend: { position: 'top' }
    });

    // ۱۶. نمودار رادار — ارزیابی عملکرد و تنوع کاری کارشناسان
    const expertStats = {};
    reportsData.forEach(r => {
        const authorName = r.expand?.author?.name || r.expand?.author?.username || 'ناشناس';
        if (!expertStats[authorName]) {
            expertStats[authorName] = { count: 0, cases: new Set(), topics: new Set() };
        }
        expertStats[authorName].count += 1;
        (r.cases_rel || []).forEach(c => expertStats[authorName].cases.add(c));
        (r.topics_rel || []).forEach(t => expertStats[authorName].topics.add(t));
    });

    const topExperts = Object.keys(expertStats).slice(0, 5);
    const radarSeries = topExperts.map(exp => ({
        name: exp,
        data: [
            expertStats[exp].count,
            expertStats[exp].cases.size,
            expertStats[exp].topics.size
        ]
    }));

    renderChart("#chart-expert-radar", {
        series: radarSeries,
        chart: { type: 'radar', height: 280, toolbar: { show: false } },
        xaxis: { categories: ['تعداد گزارش‌ها', 'تنوع کیس‌ها', 'تنوع موضوعات'] }
    });

    // ۱۷. نمودار حرارتی — ماتریس زمانی وقوع رویدادها
    const daysOfWeek = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    const heatmapData = Array.from({ length: 7 }, () => Array(24).fill(0));

    reportsData.forEach(r => {
        if (r.occurrence_date) {
            const d = new Date(r.occurrence_date);
            if (!isNaN(d.getTime())) {
                const dayIndex = d.getDay();
                const hour = d.getHours();
                heatmapData[dayIndex][hour] += 1;
            }
        }
    });

    const heatmapSeries = daysOfWeek.map((day, idx) => ({
        name: day,
        data: heatmapData[idx].map((val, hour) => ({ x: `${hour}:00`, y: val }))
    }));

    renderChart("#chart-occurrence-heatmap", {
        series: heatmapSeries,
        chart: { type: 'heatmap', height: 280, toolbar: { show: false } },
        dataLabels: { enabled: false },
        colors: ["#4f46e5"]
    });

    // رندر نمودارهای D3.js
    renderForceDirectedGraph(reportsData);
    renderSunburstDiagram(reportsData);
    renderChordDiagram(reportsData);

    // ۱۸. ابر کلمات کلیدی
    renderWordCloud(reportsData);
}


function renderWordCloud(reportsData, targetConfig = {}) {
    const svgId = targetConfig.svgId || 'word-cloud-svg';
    const containerId = targetConfig.containerId || 'word-cloud-container';
    const emptyId = targetConfig.emptyId || 'word-cloud-empty';

    const svgContainer = document.getElementById(svgId);
    const container = document.getElementById(containerId);
    const emptyEl = document.getElementById(emptyId);
    if (!svgContainer || typeof d3 === 'undefined' || typeof d3.layout?.cloud !== 'function') return;

    // پاک‌سازی قبلی SVG
    svgContainer.innerHTML = '';

    // دریافت یا ایجاد Tooltip شناور
    const tooltipId = targetConfig.isModal ? 'modal-word-cloud-tooltip' : 'word-cloud-tooltip';
    let tooltip = document.getElementById(tooltipId);
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.className = 'absolute hidden pointer-events-none bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-sm z-50 border border-slate-700 font-sans transition-all duration-75';
        container.appendChild(tooltip);
    }

    const activeReportIds = new Set(reportsData.map(r => r.id));

    const stopWords = new Set([
        'در', 'به', 'از', 'که', 'می', 'این', 'را', 'با', 'است', 'برای', 'آن', 'یک', 'شود', 'شده', 'خود',
        'ها', 'های', 'بر', 'تا', 'نیز', 'وی', 'شد', 'علاوه', 'هم', 'کند', 'کرد', 'برای', 'یا', 'اما',
        'باشد', 'باید', 'داد', 'داشت', 'آنها', 'ویژه', 'جهت', 'پس', 'بین', 'توسط', 'طی', 'چون', 'کل',
        'p', 'br', 'div', 'span', 'href', 'http', 'https', 'strong', 'em', 'style', 'class'
    ]);

    let combinedText = '';

    reportsData.forEach(r => {
        if (r.title) combinedText += ' ' + r.title;
        if (r.abstract) combinedText += ' ' + r.abstract;
        if (r.content) combinedText += ' ' + r.content;
    });

    allComments.forEach(c => {
        if (c.report && activeReportIds.has(c.report) && c.text) {
            combinedText += ' ' + c.text;
        }
    });

    const cleanText = combinedText.replace(/<[^>]*>/g, ' ')
        .replace(/[0-9\u0660-\u0669\u06f0-\u06f9]/g, ' ')
        .replace(/[^\u0600-\u06FF\s]/g, ' ');

    const words = cleanText.split(/\s+/);
    const wordCounts = {};

    words.forEach(w => {
        const word = w.trim();
        if (word.length > 2 && !stopWords.has(word)) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    });

    const rawList = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50); // محدوده تعداد کلمات

    if (rawList.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        tooltip.classList.add('hidden');
        return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    const width = (container.clientWidth && container.clientWidth > 0) ? container.clientWidth : 900;
    const height = targetConfig.isModal ? Math.max((container.clientHeight || 0), 500) : 300;

    const maxCount = rawList[0][1];
    const minCount = rawList[rawList.length - 1][1];

    const fontSizeScale = d3.scaleLinear()
        .domain([minCount, maxCount])
        .range([14, 42]);

    const palette = ['#4f46e5', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6'];

    const wordEntries = rawList.map(([text, count]) => ({
        text: text,
        size: fontSizeScale(count),
        count: count
    }));

    d3.layout.cloud()
        .size([width, height])
        .words(wordEntries)
        .padding(5)
        .rotate(0)
        .font('Vazirmatn')
        .fontSize(d => d.size)
        .on('end', draw)
        .start();

    function draw(wordsData) {
        const svg = d3.select(`#${svgId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        svg.selectAll('text')
            .data(wordsData)
            .enter()
            .append('text')
            .style('font-family', 'Vazirmatn, sans-serif')
            .style('font-weight', 'bold')
            .style('fill', () => palette[Math.floor(Math.random() * palette.length)])
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .style('font-size', d => `${d.size}px`)
            .style('cursor', 'pointer')
            .style('transition', 'transform 0.15s ease, opacity 0.15s ease')
            .text(d => d.text)
            .on('mouseover', function (event, d) {
                d3.select(this)
                    .style('opacity', '0.75')
                    .attr('transform', `translate(${d.x},${d.y}) scale(1.15)`);

                tooltip.innerHTML = `<span class="font-bold text-sky-400">${d.text}</span>: ${d.count} بار تکرار`;
                
                const rect = container.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                tooltip.style.left = `${x + 10}px`;
                tooltip.style.top = `${y - 35}px`;
                tooltip.classList.remove('hidden');
            })
            .on('mousemove', function (event) {
                const rect = container.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                tooltip.style.left = `${x + 10}px`;
                tooltip.style.top = `${y - 35}px`;
            })
            .on('mouseout', function (event, d) {
                d3.select(this)
                    .style('opacity', '1')
                    .attr('transform', `translate(${d.x},${d.y}) scale(1)`);

                tooltip.classList.add('hidden');
            });
    }
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

    const selectedCaseId = document.getElementById('filter-case-select')?.value || '';
    const selectedTopicId = document.getElementById('filter-topic-select')?.value || '';

    let filtered = allReports;

    // ۱. فیلتر بر اساس کیس
    if (selectedCaseId) {
        filtered = filtered.filter(r => {
            if (Array.isArray(r.cases_rel)) return r.cases_rel.includes(selectedCaseId);
            if (Array.isArray(r.cases)) return r.cases.includes(selectedCaseId);
            return r.cases_rel === selectedCaseId || r.cases === selectedCaseId;
        });
    }

    // ۲. فیلتر بر اساس موضوع
    if (selectedTopicId) {
        filtered = filtered.filter(r => {
            if (Array.isArray(r.topics_rel)) return r.topics_rel.includes(selectedTopicId);
            if (Array.isArray(r.topics)) return r.topics.includes(selectedTopicId);
            return r.topics_rel === selectedTopicId || r.topics === selectedTopicId;
        });
    }

    // ۳. فیلتر تاریخ از
    if (fromStr) {
        filtered = filtered.filter(r => {
            if (!r.created) return false;
            const rDate = r.created.includes('T') ? r.created.split('T')[0] : r.created.split(' ')[0];
            return rDate >= fromStr;
        });
    }

    // ۴. فیلتر تاریخ تا
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

// پیاده‌سازی نمودار گراف پیوندها (Force-Directed Graph)
function renderForceDirectedGraph(reportsData) {
    const container = document.getElementById('chart-force-graph');
    if (!container || typeof d3 === 'undefined') return;
    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = 400;

    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    reportsData.slice(0, 30).forEach(r => {
        const rNode = { id: `rep_${r.id}`, name: r.title ? r.title.substring(0, 20) + '...' : r.id, group: 'report' };
        nodes.push(rNode);
        nodeMap.set(rNode.id, rNode);

        (r.expand?.cases_rel || []).forEach(c => {
            const cId = `case_${c.id}`;
            if (!nodeMap.has(cId)) {
                const cNode = { id: cId, name: c.title || c.id, group: 'case' };
                nodes.push(cNode);
                nodeMap.set(cId, cNode);
            }
            links.push({ source: rNode.id, target: cId });
        });

        (r.expand?.topics_rel || []).forEach(t => {
            const tId = `topic_${t.id}`;
            if (!nodeMap.has(tId)) {
                const tNode = { id: tId, name: t.title || t.id, group: 'topic' };
                nodes.push(tNode);
                nodeMap.set(tId, tNode);
            }
            links.push({ source: rNode.id, target: tId });
        });
    });

    if (nodes.length === 0) return;

    const svg = d3.select('#chart-force-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(60))
        .force('charge', d3.forceManyBody().strength(-120))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const colorMap = { report: '#3b82f6', case: '#8b5cf6', topic: '#10b981' };

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 1.5);

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => d.group === 'report' ? 6 : 9)
        .attr('fill', d => colorMap[d.group])
        .call(d3.drag()
            .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('title').text(d => `${d.group}: ${d.name}`);

    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

        node.attr('cx', d => d.x).attr('cy', d => d.y);
    });
}

// پیاده‌سازی نمودار خورشیدی (Sunburst Diagram)
function renderSunburstDiagram(reportsData) {
    const container = document.getElementById('chart-sunburst');
    if (!container || typeof d3 === 'undefined') return;
    container.innerHTML = '';

    const width = container.clientWidth || 380;
    const radius = width / 2;

    const caseHierarchy = { name: "کیس‌ها", children: [] };
    const caseMap = {};

    allCases.forEach(c => {
        if (!c.parent_case) {
            caseMap[c.id] = { name: c.title || c.id, children: [], value: 0 };
            caseHierarchy.children.push(caseMap[c.id]);
        }
    });

    reportsData.forEach(r => {
        (r.expand?.cases_rel || []).forEach(c => {
            if (caseMap[c.id]) caseMap[c.id].value += 1;
        });
    });

    const root = d3.hierarchy(caseHierarchy)
        .sum(d => d.value || 0);

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const svg = d3.select('#chart-sunburst')
        .append('svg')
        .attr('width', width)
        .attr('height', width)
        .append('g')
        .attr('transform', `translate(${radius},${radius})`);

    svg.selectAll('path')
        .data(root.descendants().filter(d => d.depth))
        .enter().append('path')
        .attr('d', arc)
        .style('fill', d => color((d.children ? d : d.parent).data.name))
        .style('opacity', 0.8)
        .append('title')
        .text(d => `${d.data.name}\nتعداد گزارش: ${d.value}`);
}

// پیاده‌سازی نمودار دایره‌ای ارتباطات (Chord Diagram)
function renderChordDiagram(reportsData) {
    const container = document.getElementById('chart-chord');
    if (!container || typeof d3 === 'undefined') return;
    container.innerHTML = '';

    const deptTopics = {};
    reportsData.forEach(r => {
        const deptObj = r.expand?.author?.expand?.department_rel;
        const deptName = deptObj ? (deptObj.name || deptObj.username) : null;
        if (deptName) {
            if (!deptTopics[deptName]) deptTopics[deptName] = new Set();
            (r.expand?.topics_rel || []).forEach(t => deptTopics[deptName].add(t.id));
        }
    });

    const depts = Object.keys(deptTopics);
    if (depts.length < 2) {
        container.innerHTML = '<span class="text-xs text-slate-400 font-bold">داده‌های کافی برای رسم نمودار تعامل موجود نیست</span>';
        return;
    }

    const matrix = depts.map((d1, i) =>
        depts.map((d2, j) => {
            if (i === j) return 0;
            const set1 = deptTopics[d1];
            const set2 = deptTopics[d2];
            let shared = 0;
            set1.forEach(t => { if (set2.has(t)) shared++; });
            return shared;
        })
    );

    const width = container.clientWidth || 380;
    const outerRadius = Math.min(width, 380) * 0.5 - 40;
    const innerRadius = outerRadius - 15;

    const chord = d3.chord().padAngle(0.05)(matrix);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const svg = d3.select('#chart-chord')
        .append('svg')
        .attr('width', width)
        .attr('height', 380)
        .append('g')
        .attr('transform', `translate(${width / 2},190)`);

    const group = svg.append('g')
        .selectAll('g')
        .data(chord.groups)
        .enter().append('g');

    group.append('path')
        .style('fill', d => color(d.index))
        .style('stroke', d => d3.rgb(color(d.index)).darker())
        .attr('d', arc);

    group.append('title').text(d => `${depts[d.index]}`);

    svg.append('g')
        .attr('fill-opacity', 0.67)
        .selectAll('path')
        .data(chord)
        .enter().append('path')
        .attr('d', ribbon)
        .style('fill', d => color(d.target.index))
        .style('stroke', d => d3.rgb(color(d.target.index)).darker())
        .append('title')
        .text(d => `${depts[d.source.index]} ↔ ${depts[d.target.index]}: ${d.source.value} موضوع مشترک`);
}