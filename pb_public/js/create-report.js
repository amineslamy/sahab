document.addEventListener('DOMContentLoaded', () => {
    // همیشه صفحه ثبت گزارش را از ابتای صفحه نمایش بده.
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);

    const PB_URL = window.location.origin;

    const COLLECTIONS = {
        reports: 'reports',
        topics: 'topics',
        cases: 'cases'
    };

    const LIMITS = {
        relationMax: 10,
        coverMaxBytes: 20 * 1024 * 1024,
        attachmentsMaxCount: 16,
        attachmentsMaxBytes: 1.2 * 1024 * 1024 * 1024
    };

    const state = {
        pb: null,
        quill: null,
        selectedCoverFile: null,
        selectedAttachments: [],
        existingAttachments: [], // 👈 ذخیره اسامی فایل‌های پیوست قبلی سرور
        selectedTopics: [],
        selectedCases: [],
        selectedAuthor: null, // 👈 کارشناس انتخاب‌شده
        allAuthorsList: [],   // 👈 ذخیره لیست کارشناسان
        allRawCases: [],      // 👈 ذخیره لیست خام کیس‌ها
        allOrderedCases: [],  // 👈 ذخیره لیست مرتب‌شده کیس‌ها
        allTopics: [],        // 👈 ذخیره لیست موضوعات
        reportId: null        // 👈 شناسه گزارش در حالت ویرایش
    };

    const $id = (id) => document.getElementById(id);

    function initEditorsAndPickers() {
        // ۱. راه‌اندازی دیت‌پیکر شمسی روی ورودی متنی
        if (typeof $ !== 'undefined' && $.fn.persianDatepicker) {
            $('#occurrence-date-picker').persianDatepicker({
                format: 'YYYY/MM/DD',
                autoClose: true,
                initialValue: false,
                onSelect: function (unix) {
                    // استخراج تاریخ میلادی معادل بر اساس Timestamp شمسی انتخاب‌شده
                    const pDate = new persianDate(unix);
                    const gDate = pDate.toDate();
                    const isoDate = gDate.toISOString();

                    // مقداردهی دقیق به فیلد هیدن
                    const hiddenInput = document.getElementById('report-occurrence-date');
                    if (hiddenInput) {
                        hiddenInput.value = isoDate;
                    }
                }
            });
        }

        // ۲. راه‌اندازی ادیتور Quill
        const editorEl = document.getElementById('editor-container') || document.getElementById('report-content');
        if (editorEl && typeof Quill !== 'undefined' && !state.quill) {
            state.quill = new Quill(editorEl, {
                theme: 'snow',
                placeholder: 'شرح مفصل گزارش یا سند را وارد کنید...'
            });
        }
    }
    boot();
    // اگر مرورگر صفحه را از cache/history بازگردانی کرد،
    // باز هم کاربر را به ابتدای فرم برگردان.
    window.addEventListener('pageshow', () => {
        window.scrollTo(0, 0);
    });

    async function boot() {
        try {
            // ۱. مقداردهی اولیه پاکت‌بیس
            state.pb = new PocketBase(PB_URL);

            // ۲. بررسی نشست و توکن کاربر
            const isAuthValid = await checkAuthAndRefresh();
            if (!isAuthValid) return;

            // ۳. لود کردن دراپ‌داون‌های ثابت (طبقه‌بندی، اولویت و...)
            loadDynamicSelectOptions();

            // ۴. 🌟 بخش اصلی: فراخوانی لود موضوعات، کیس‌ها و کارشناسان
            await initRelationPickers();
            initEditorsAndPickers();
            // ۵. راه‌اندازی آپلود فایل‌ها و فرم
            initFileInputs();
            initFormActions();

            // ۶. بررسی وجود ID در آدرس و بارگذاری گزارش جهت مشاهده/ویرایش
            await checkAndLoadEditMode();
        } catch (err) {
            console.error('خطا در اجرای اولیه برنامه (boot):', err);
        }
    }

    function updateMetadataDisplay(report) {
        if (!report) return;

        // ۰. شناسه اتوماسیون
        const autoEl = $id('meta-automation-id');
        if (autoEl && report.automation_id) {
            autoEl.textContent = report.automation_id;
        }

        // ۱. تاریخ انتشار (تاریخ ثبت)
        const publishEl = $id('meta-publish-date');
        if (publishEl && report.created) {
            const d = new Date(report.created);
            publishEl.textContent = d.toLocaleDateString('fa-IR');
        }

        // ۲. تاریخ به روزرسانی
        const updatedEl = $id('meta-updated-date');
        if (updatedEl && report.updated) {
            const d = new Date(report.updated);
            updatedEl.textContent = d.toLocaleDateString('fa-IR');
        }

        // ۳. تاریخ وقوع
        const occurrenceEl = $id('meta-occurrence-date');
        if (occurrenceEl) {
            const rawDate = report.occurrence_date || getValue('report-occurrence-date');
            if (rawDate) {
                const d = new Date(rawDate);
                occurrenceEl.textContent = d.toLocaleDateString('fa-IR');
            }
        }

        // ۴. نویسنده گزارش
        const authorEl = $id('meta-author');
        if (authorEl) {
            const authorObj = state.selectedAuthor || report.expand?.author;
            if (authorObj) {
                authorEl.textContent = authorObj.name || authorObj.username || 'نامشخص';
            }
        }

        // ۵. ثبت کننده
        const creatorEl = $id('meta-creator');
        if (creatorEl) {
            const currentUser = state.pb?.authStore?.record || state.pb?.authStore?.model;
            const submitterObj = report.expand?.submitter || currentUser;
            if (submitterObj) {
                creatorEl.textContent = submitterObj.name || submitterObj.username || 'نامشخص';
            }
        }

        // ۶. موضوعات
        const topicsEl = $id('meta-topics');
        if (topicsEl) {
            const topicTitles = state.selectedTopics.map(id => {
                const topic = state.allTopics.find(t => t.id === id);
                return topic ? (topic.title || topic.name) : null;
            }).filter(Boolean);
            topicsEl.textContent = topicTitles.length > 0 ? topicTitles.join('، ') : 'بدون موضوع';
        }

        // ۷. کیس‌ها
        const casesEl = $id('meta-cases');
        if (casesEl) {
            const caseTitles = state.selectedCases.map(id => {
                const caseItem = state.allRawCases.find(c => c.id === id);
                return caseItem ? caseItem.title : null;
            }).filter(Boolean);
            casesEl.textContent = caseTitles.length > 0 ? caseTitles.join('، ') : 'بدون کیس';
        }
    }

    async function checkAndLoadEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (!id) return;

        state.reportId = id;
        console.log("شناسه گزارش برای ویرایش/مشاهده دریافت شد:", id);

        try {
            const report = await state.pb.collection(COLLECTIONS.reports).getOne(id, {
                expand: 'author,submitter'
            });
            // ۱. مقداردهی فیلدهای متنی و انتخابی ساده
            setInputValue('report-title', report.title);
            setInputValue('report-abstract', report.abstract);
            setInputValue('report-classification', report.classification);
            setInputValue('report-priority', report.priority);
            setInputValue('report-news-type', report.news_type);
            setInputValue('report-evaluation', report.evaluation);

            // ۲. مقداردهی تاریخ وقوع
            if (report.occurrence_date) {
                const hiddenInput = $id('report-occurrence-date');
                if (hiddenInput) hiddenInput.value = report.occurrence_date;

                if (typeof persianDate !== 'undefined') {
                    const gDate = new Date(report.occurrence_date);
                    const pDate = new persianDate(gDate);
                    pDate.toLocale('en');
                    const formattedFa = `${pDate.year()}/${String(pDate.month()).padStart(2, '0')}/${String(pDate.date()).padStart(2, '0')}`;
                    setInputValue('occurrence-date-picker', formattedFa);
                } else {
                    const dateObj = new Date(report.occurrence_date);
                    setInputValue('occurrence-date-picker', dateObj.toLocaleDateString('fa-IR'));
                }
            }

            // ۳. مقداردهی ادیتور Quill
            if (state.quill && report.content) {
                state.quill.clipboard.dangerouslyPasteHTML(report.content);
            }

            // ۴. مقداردهی موضوعات انتخاب شده
            if (Array.isArray(report.topics_rel)) {
                state.selectedTopics = [...report.topics_rel];
                renderTopicsTags(state.allTopics);
                renderTopicsList(state.allTopics);
            }

            // ۵. مقداردهی کیس‌های انتخاب شده
            if (Array.isArray(report.cases_rel)) {
                state.selectedCases = [...report.cases_rel];
                renderCasesTags(state.allOrderedCases, state.allRawCases);
                renderCasesList(state.allOrderedCases, state.allRawCases);
            }

            // ۶. مقداردهی کارشناس/نویسنده
            if (report.author && state.allAuthorsList.length > 0) {
                const authorObj = state.allAuthorsList.find(u => u.id === report.author);
                if (authorObj) {
                    state.selectedAuthor = authorObj;
                    renderAuthorTag();
                    renderAuthorList(groupUsersByDepartment(state.allAuthorsList), state.allAuthorsList);
                }
            }

            // ۷. نمایش تصویر شاخص قبلی در صورت وجود
            if (report.cover_image) {
                const coverUrl = state.pb.files.getUrl(report, report.cover_image);
                renderExistingCoverPreview(coverUrl, report.cover_image);
            }

            // ۸. نمایش فایل‌های پیوست قبلی در صورت وجود
            if (Array.isArray(report.attachments) && report.attachments.length > 0) {
                state.existingAttachments = [...report.attachments];
                renderExistingAttachmentsList(report, report.attachments);
            }

            // ۹. به‌روزرسانی اطلاعات متادیتا هدر
            updateMetadataDisplay(report);

            // تغییر متن دکمه ثبت
            const submitBtnText = $id('btn-text') || document.querySelector('[data-submit-text]');
            if (submitBtnText) submitBtnText.textContent = 'ویرایش و ذخیره‌سازی نهایی';
        } catch (err) {
            console.error("خطا در بارگذاری اطلاعات گزارش برای ویرایش:", err);
            showError("عدم امکان دریافت اطلاعات گزارش مورد نظر.");
        }
    }

    function setInputValue(id, value) {
        const el = $id(id) || document.querySelector(`select[name="${id}"]`);
        if (el && value !== undefined && value !== null) {
            el.value = value;
        }
    }

    // ۱. تابع جدید بررسی و تازه سازی نشست کاربری در سمت سرور
    async function checkAuthAndRefresh() {
        if (!state.pb.authStore.isValid) {
            handleInvalidAuth();
            return false;
        }

        try {
            console.log("در حال تازه‌سازی نشست و دریافت اطلاعات کاربر...");
            // درخواست رسمی به سرور برای احراز هویت مجدد توکن همراه با دریافت اطلاعات دپارتمان متصل
            const authData = await state.pb.collection('users').authRefresh({ expand: 'department_rel' });
            const currentUser = authData.record || {};
            const departmentId = currentUser.department_rel || currentUser.department || '';

            const ALLOWED_ROLES_WITHOUT_DEPT = ['expert', 'department', 'admin_general', 'admin_site'];
            const userRole = currentUser.role || currentUser.expand?.role?.name || '';

            if (!departmentId) {
                if (ALLOWED_ROLES_WITHOUT_DEPT.includes(userRole)) {
                    console.warn("کاربر فاقد دپارتمان است اما به دلیل داشتن نقش مجاز، ادامه برنامه اجرا می‌شود:", userRole);
                    return true;
                }
                showError("نشست شما معتبر است، اما اداره ای برای حساب کاربری شما تعریف نشده است. لطفا با مدیر سیستم تماس بگیرید.");
                const submitBtn = $id('submit-btn');
                if (submitBtn) submitBtn.disabled = true;
                return false;
            }

            console.log("نشست با موفقیت تازه‌سازی شد. کاربر:", currentUser.username, "دپارتمان:", departmentId);
            return true;

        } catch (error) {
            console.error("خطا در تازه‌سازی نشست. احتمالا توکن منقضی شده است یا سرور در دسترس نیست:", error);
            handleInvalidAuth();
            return false;
        }
    }

    // ۲. هدایت کاربر به صفحه لاگین در صورت نداشتن نشست معتبر
    function handleInvalidAuth() {
        state.pb.authStore.clear();
        showError("نشست شما منقضی شده است. در حال انتقال به صفحه ورود...");
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    }

    let lastAuthCheck = Date.now();

    // بسته‌شدن هوشمند منوها با کلیک روی بیرون کادر (Outside Click)
    document.addEventListener('click', (event) => {
        const topicsPicker = $id('topics-picker-container');
        const topicsDropdown = $id('topics-dropdown');
        const casesPicker = $id('cases-picker-container');
        const casesDropdown = $id('cases-dropdown');
        const authorPicker = $id('author-picker-container');
        const authorDropdown = $id('author-dropdown');

        if (topicsPicker && topicsDropdown && !topicsPicker.contains(event.target) && !topicsDropdown.contains(event.target)) {
            topicsDropdown.classList.add('hidden');
        }

        if (casesPicker && casesDropdown && !casesPicker.contains(event.target) && !casesDropdown.contains(event.target)) {
            casesDropdown.classList.add('hidden');
        }

        if (authorPicker && authorDropdown && !authorPicker.contains(event.target) && !authorDropdown.contains(event.target)) {
            authorDropdown.classList.add('hidden');
        }
    });

    async function initRelationPickers() {
        const results = await Promise.allSettled([
            state.pb.collection(COLLECTIONS.topics).getFullList({ sort: 'title' }),
            state.pb.collection(COLLECTIONS.cases).getFullList({ sort: 'title' }),
            state.pb.collection('users').getFullList({ expand: 'department_rel' })
        ]);

        const topicsResult = results[0];
        const casesResult = results[1];
        const usersResult = results[2];

        // ۱. راه اندازی موضوعات
        if (topicsResult.status === 'fulfilled') {
            state.allTopics = topicsResult.value;
            setupTopicsPicker(topicsResult.value);
        } else {
            console.error('خطا در بارگذاری موضوعات:', topicsResult.reason);
        }

        // ۲. راه اندازی کیس‌ها (با ساختار درختی والد-فرزند)
        if (casesResult.status === 'fulfilled') {
            setupCasesPicker(casesResult.value);
        } else {
            console.error('خطا در بارگذاری کیس‌ها:', casesResult.reason);
        }

        // ۳. راه اندازی کارشناسان (با ساختار دپارتمان ↲ کارشناس)
        if (usersResult.status === 'fulfilled') {
            setupAuthorPicker(usersResult.value);
        } else {
            console.error('خطا در بارگذاری کارشناسان:', usersResult.reason);
        }
    }

    // --- مدیریت انتخاب موضوعات ---
    function setupTopicsPicker(items) {
        const container = $id('topics-picker-container');
        const dropdown = $id('topics-dropdown');
        if (!container || !dropdown) return;

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            $id('cases-dropdown')?.classList.add('hidden');
            $id('author-dropdown')?.classList.add('hidden');
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                $id('topics-search-input')?.focus();
            }
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        renderTopicsList(items);
        renderTopicsTags(items);

        const searchInput = $id('topics-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.trim().toLowerCase();
                const filtered = items.filter(t => (t.title || t.name).toLowerCase().includes(q));
                renderTopicsList(filtered);
            });
        }
    }

    function renderTopicsList(items) {
        let listContainer = $id('topics-list-container');
        const dropdown = $id('topics-dropdown');

        if (!listContainer) {
            dropdown.innerHTML = `
                <div class="p-2 border-b border-slate-200 bg-slate-50">
                    <input type="text" id="topics-search-input" placeholder="جستجو در موضوعات..." class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-slate-800">
                </div>
                <div id="topics-list-container" class="max-h-60 overflow-y-auto p-1.5 space-y-1"></div>
            `;
            listContainer = $id('topics-list-container');
        }

        listContainer.innerHTML = '';
        if (items.length === 0) {
            listContainer.innerHTML = '<div class="p-3 text-sm text-slate-400 text-center font-semibold">موردی یافت نشد</div>';
            return;
        }

        items.forEach(item => {
            const isSelected = state.selectedTopics.includes(item.id);
            const label = document.createElement('label');
            label.className = `flex items-center justify-between p-3 rounded-lg cursor-pointer transition hover:bg-slate-100 ${isSelected ? 'bg-slate-100 font-bold' : ''}`;
            label.innerHTML = `
                <span class="text-sm font-bold text-slate-800">${item.title || item.name}</span>
                <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-slate-900">
            `;
            label.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (state.selectedTopics.length >= LIMITS.relationMax) {
                        showError(`حداکثر ${LIMITS.relationMax} مورد قابل انتخاب است.`);
                        e.target.checked = false;
                        return;
                    }
                    state.selectedTopics.push(item.id);
                } else {
                    const idx = state.selectedTopics.indexOf(item.id);
                    if (idx !== -1) state.selectedTopics.splice(idx, 1);
                }
                renderTopicsTags(items);
            });
            listContainer.appendChild(label);
        });
    }

    function renderTopicsTags(allItems) {
        const container = $id('topics-picker-container');
        if (!container) return;
        container.innerHTML = '';

        if (state.selectedTopics.length === 0) {
            container.innerHTML = '<span class="text-slate-400 text-sm font-medium pr-1">انتخاب موضوعات...</span>';
            return;
        }

        state.selectedTopics.forEach(id => {
            const item = allItems.find(t => t.id === id);
            if (!item) return;
            const tag = document.createElement('span');
            tag.className = 'bg-slate-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1.5';
            tag.innerHTML = `
                <span>${item.title || item.name}</span>
                <button type="button" class="text-slate-300 hover:text-red-400 font-bold text-sm">&times;</button>
            `;
            tag.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = state.selectedTopics.indexOf(id);
                if (idx !== -1) state.selectedTopics.splice(idx, 1);
                renderTopicsTags(allItems);
                renderTopicsList(allItems);
            });
            container.appendChild(tag);
        });
    }

    // --- مدیریت انتخاب کیس‌ها (ساختار درختی والد-فرزند) ---
    function setupCasesPicker(rawItems) {
        const container = $id('cases-picker-container');
        const dropdown = $id('cases-dropdown');
        if (!container || !dropdown) return;

        const parents = rawItems.filter(c => !c.parent_case);
        const children = rawItems.filter(c => c.parent_case);

        let orderedCases = [];
        parents.forEach(p => {
            orderedCases.push({ ...p, isChild: false });
            const subCases = children.filter(c => c.parent_case === p.id);
            subCases.forEach(sub => {
                orderedCases.push({ ...sub, isChild: true, parentTitle: p.title });
            });
        });

        const orphans = children.filter(c => !parents.some(p => p.id === c.parent_case));
        orphans.forEach(o => orderedCases.push({ ...o, isChild: false }));

        state.allRawCases = rawItems;
        state.allOrderedCases = orderedCases;

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            $id('topics-dropdown')?.classList.add('hidden');
            $id('author-dropdown')?.classList.add('hidden');
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                $id('cases-search-input')?.focus();
            }
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        renderCasesList(orderedCases, rawItems);
        renderCasesTags(orderedCases, rawItems);
        const searchInput = $id('cases-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                if (!query) {
                    renderCasesList(orderedCases, rawItems);
                    return;
                }
                const filtered = orderedCases.filter(c => {
                    const titleMatch = (c.title || '').toLowerCase().includes(query);
                    const parentMatch = c.parentTitle && c.parentTitle.toLowerCase().includes(query);
                    return titleMatch || parentMatch;
                });
                renderCasesList(filtered, rawItems);
            });
        }
    }



    // --- مدیریت انتخاب کارشناسان (ساختار درختی: دپارتمان ↲ کارشناس) ---
    function setupAuthorPicker(users) {
        const container = $id('author-picker-container');
        const dropdown = $id('author-dropdown');
        if (!container || !dropdown) return;

        state.allAuthorsList = users;

        // بررسی نقش کاربر جاری: تنها اگر کارشناس باشد و دپارتمان داشته باشد اسمش به صورت پیش‌فرض انتخاب می‌شود
        const currentUser = state.pb.authStore.record || state.pb.authStore.model;
        if (currentUser && !state.selectedAuthor) {
            const userRole = currentUser.role || currentUser.expand?.role?.name || '';
            const userDept = currentUser.department_rel || currentUser.department;

            if (userRole === 'expert' && userDept) {
                const activeUserInList = users.find(u => u.id === currentUser.id);
                state.selectedAuthor = activeUserInList || currentUser;
            } else {
                state.selectedAuthor = null;
            }
        }

        // گروه بندی کارشناسان بر اساس دپارتمان
        const grouped = groupUsersByDepartment(users);

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            $id('topics-dropdown')?.classList.add('hidden');
            $id('cases-dropdown')?.classList.add('hidden');
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                $id('author-search-input')?.focus();
            }
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        renderAuthorList(grouped, users);
        renderAuthorTag();

        const searchInput = $id('author-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const nameMatch = (u.name || u.username || '').toLowerCase().includes(query);
                    const deptName = u.expand?.department_rel?.name || '';
                    const deptMatch = deptName.toLowerCase().includes(query);
                    return nameMatch || deptMatch;
                });
                renderAuthorList(groupUsersByDepartment(filtered), users);
            });
        }
    }

    function groupUsersByDepartment(users) {
        const groups = {};

        users.forEach(u => {
            // ۱. اول سعی می‌کنیم از expand نام اداره را بگیریم
            let deptName = u.expand?.department_rel?.name ||
                u.expand?.department_rel?.title ||
                u.expand?.department_rel?.username;

            // ۲. اگر expand خالی بود، ID اداره را می‌خوانیم
            const deptId = u.department_rel || u.department;

            // ۳. اگر ID داشتیم، توی همین لیست users دنبال کاربرِ اداره می‌گردیم
            if (!deptName && deptId) {
                const parentDeptUser = users.find(item => item.id === deptId);
                if (parentDeptUser) {
                    deptName = parentDeptUser.name || parentDeptUser.title || parentDeptUser.username;
                }
            }

            // ۴. اگر هیچ‌کدام نبود، می‌رود در سایر اداره‌ها
            const finalGroup = deptName || 'سایر اداره‌ها';

            if (!groups[finalGroup]) groups[finalGroup] = [];
            groups[finalGroup].push(u);
        });

        return groups;
    }

    function renderAuthorList(grouped, allUsers) {
        let listContainer = $id('author-list-container');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const groupNames = Object.keys(grouped);

        if (groupNames.length === 0) {
            listContainer.innerHTML = '<div class="p-3 text-sm text-slate-400 text-center font-semibold">کارشناسی یافت نشد</div>';
            return;
        }

        groupNames.forEach(deptName => {
            const deptHeader = document.createElement('div');
            deptHeader.className = 'px-2 py-1.5 text-xs font-black text-slate-500 bg-slate-100 rounded-md mt-1 mb-1';
            deptHeader.textContent = `📁 ${deptName}`;
            listContainer.appendChild(deptHeader);

            grouped[deptName].forEach(user => {
                const displayName = user.name || user.username || 'بدون نام';

                // اگر نام کاربر با نام اداره یکی باشد، خودش را درون زیرمجموعه خودش رندر نکن
                if (displayName === deptName) return;

                const isSelected = state.selectedAuthor && state.selectedAuthor.id === user.id;
                const item = document.createElement('div');
                item.className = `flex items-center justify-between p-2 mr-3 rounded-lg cursor-pointer transition hover:bg-slate-100 border-r-2 border-slate-300 ${isSelected ? 'bg-slate-100 font-bold' : ''}`;

                const userCode = user.user_code ? ` (کد: ${user.user_code})` : '';

                item.innerHTML = `
                    <div class="flex items-center gap-1.5 text-sm text-slate-800">
                        <span class="text-slate-400 font-bold">↲</span>
                        <span>${displayName}</span>
                        <span class="text-xs text-slate-400 font-normal">${userCode}</span>
                    </div>
                    ${isSelected ? '<span class="text-xs font-bold text-emerald-600">✓ انتخاب شده</span>' : ''}
                `;

                item.addEventListener('click', () => {
                    window.allUsersCache = allUsers; // ذخیره کَش لیست کاربران برای دسترسی در تولید اتوماسیون
                    state.selectedAuthor = user;
                    renderAuthorTag();
                    renderAuthorList(grouped, allUsers);
                    $id('author-dropdown')?.classList.add('hidden');
                });

                listContainer.appendChild(item);
            });
        });
    }

    function renderAuthorTag() {
        const container = $id('author-picker-container');
        if (!container) return;
        container.innerHTML = '';

        if (!state.selectedAuthor) {
            container.innerHTML = '<span class="text-slate-400 text-sm font-medium pr-1">انتخاب کارشناس...</span>';
            return;
        }

        const authorName = state.selectedAuthor.name || state.selectedAuthor.username || 'کاربر سیستم';
        const tag = document.createElement('span');
        tag.className = 'bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-2';
        tag.innerHTML = `<span>👤 ${authorName}</span>`;
        container.appendChild(tag);
    }


    function renderCasesList(itemsToRender, rawItems) {
        let listContainer = $id('cases-list-container');
        const dropdown = $id('cases-dropdown');

        // اگر کادر جستجو هنوز رندر نشده، آن را ایجاد می‌کنیم
        if (!listContainer) {
            dropdown.innerHTML = `
                <div class="p-2 border-b border-slate-200 bg-slate-50">
                    <input type="text" id="cases-search-input" placeholder="جستجو در کیس‌ها و زیرمجموعه‌ها..." class="w-full px-3 py-2 text-sm font-semibold border rounded-lg focus:outline-none focus:border-slate-800">
                </div>
                <div id="cases-list-container" class="max-h-64 overflow-y-auto p-1.5 space-y-1"></div>
            `;
            listContainer = $id('cases-list-container');
        }

        listContainer.innerHTML = '';

        if (!itemsToRender || itemsToRender.length === 0) {
            listContainer.innerHTML = '<div class="p-3 text-sm text-slate-400 text-center font-semibold">کیسی یافت نشد</div>';
            return;
        }

        itemsToRender.forEach(item => {
            const isSelected = state.selectedCases.includes(item.id);
            const label = document.createElement('label');

            const isChildClass = item.isChild ? 'mr-5 bg-slate-50 border-r-2 border-slate-300 pl-2' : '';

            // استفاده از علامت ↲ برای RTL
            const titleMarkup = item.isChild
                ? `<span class="text-slate-400 font-bold ml-1">↲</span> <span class="font-bold text-slate-800 text-sm">${item.title}</span> <span class="text-[11px] text-slate-400 font-normal mr-auto">(والد: ${item.parentTitle})</span>`
                : `<span class="font-black text-slate-900 text-sm">${item.title}</span>`;

            label.className = `flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition hover:bg-slate-100 ${isChildClass} ${isSelected ? 'bg-slate-100' : ''}`;
            label.innerHTML = `
                <div class="flex items-center gap-1.5 w-full">${titleMarkup}</div>
                <input type="checkbox" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-slate-900 shrink-0">
            `;

            label.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (state.selectedCases.length >= LIMITS.relationMax) {
                        showError(`حداکثر ${LIMITS.relationMax} مورد قابل انتخاب است.`);
                        e.target.checked = false;
                        return;
                    }
                    state.selectedCases.push(item.id);
                } else {
                    const idx = state.selectedCases.indexOf(item.id);
                    if (idx !== -1) state.selectedCases.splice(idx, 1);
                }
                renderCasesTags(itemsToRender, rawItems);
            });

            listContainer.appendChild(label);
        });
    }

    function renderCasesTags(orderedCases, rawItems) {
        const container = $id('cases-picker-container');
        if (!container) return;
        container.innerHTML = '';

        if (state.selectedCases.length === 0) {
            container.innerHTML = '<span class="text-slate-400 text-sm font-medium pr-1">انتخاب کیس‌ها...</span>';
            return;
        }

        const rawList = Array.isArray(rawItems) ? rawItems : [];
        const orderedList = Array.isArray(orderedCases) ? orderedCases : rawList;

        state.selectedCases.forEach(id => {
            const item = rawList.find(c => c.id === id) || orderedList.find(c => c.id === id);
            if (!item) return;
            const tag = document.createElement('span');
            tag.className = 'bg-slate-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1.5';
            tag.innerHTML = `
                <span>${item.title}</span>
                <button type="button" class="text-slate-300 hover:text-red-400 font-bold text-sm">&times;</button>
            `;
            tag.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = state.selectedCases.indexOf(id);
                if (idx !== -1) state.selectedCases.splice(idx, 1);
                renderCasesTags(orderedList, rawList);
                renderCasesList(orderedList, rawList);
            });
            container.appendChild(tag);
        });
    }
    function initFileInputs() {
        setupFileDropZone({
            zoneId: 'cover-drag-zone',
            inputId: 'report-cover-image',
            multiple: false,
            onFiles: (files) => {
                const file = files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    showError('فقط فایل تصویری برای تصویر شاخص مجاز است.');
                    return;
                }

                if (file.size > LIMITS.coverMaxBytes) {
                    showError('حجم تصویر شاخص نباید بیشتر از ۲۰ مگابایت باشد.');
                    return;
                }

                state.selectedCoverFile = file;
                renderCoverPreview(file);
            }
        });

        setupFileDropZone({
            zoneId: 'attachments-drag-zone',
            inputId: 'report-attachments',
            multiple: true,
            onFiles: (files) => {
                const incomingFiles = Array.from(files);

                if (state.existingAttachments.length + state.selectedAttachments.length + incomingFiles.length > LIMITS.attachmentsMaxCount) {
                    showError('حداکثر ۱۶ فایل پیوست قابل انتخاب است.');
                    return;
                }

                const currentSize = state.selectedAttachments.reduce((sum, file) => sum + file.size, 0);
                const incomingSize = incomingFiles.reduce((sum, file) => sum + file.size, 0);

                if (currentSize + incomingSize > LIMITS.attachmentsMaxBytes) {
                    showError('مجموع حجم فایل‌های پیوست نباید بیشتر از ۱.۲ گیگابایت باشد.');
                    return;
                }

                state.selectedAttachments.push(...incomingFiles);
                renderAttachmentsList();
            }
        });

        const removeCoverBtn = $id('remove-cover-btn');
        if (removeCoverBtn) {
            removeCoverBtn.addEventListener('click', () => {
                state.selectedCoverFile = null;

                const input = $id('report-cover-image');
                const preview = $id('cover-preview-container');
                const dragZone = $id('cover-drag-zone');
                const selectText = $id('cover-select-text');

                if (input) input.value = '';
                if (preview) preview.classList.add('hidden');
                if (dragZone) {
                    dragZone.style.backgroundImage = '';
                    dragZone.classList.remove('has-image');
                }
                if (selectText) selectText.textContent = 'انتخاب تصویر';
            });
        }
    }

    function setupFileDropZone(config) {
        const zone = $id(config.zoneId);
        const input = $id(config.inputId);

        if (!zone || !input) return;

        input.multiple = Boolean(config.multiple);

        zone.addEventListener('click', () => input.click());

        input.addEventListener('change', () => {
            config.onFiles(Array.from(input.files || []));
            input.value = '';
        });

        ['dragenter', 'dragover'].forEach((eventName) => {
            zone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.add('is-dragover');
            });
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            zone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.remove('is-dragover');
            });
        });

        zone.addEventListener('drop', (event) => {
            const files = Array.from(event.dataTransfer.files || []);
            config.onFiles(files);
        });
    }

    function renderCoverPreview(file) {
        const previewContainer = $id('cover-preview-container');
        const dragZone = $id('cover-drag-zone');
        const selectText = $id('cover-select-text');
        const filenameText = $id('cover-filename');
        const filesizeText = $id('cover-filesize');

        const objectUrl = URL.createObjectURL(file);

        if (dragZone) {
            dragZone.style.backgroundImage = `url('${objectUrl}')`;
            dragZone.classList.add('has-image');
        }
        if (selectText) selectText.textContent = 'تغییر تصویر';
        if (filenameText) filenameText.textContent = file.name;
        if (filesizeText) filesizeText.textContent = formatBytes(file.size);
        if (previewContainer) previewContainer.classList.remove('hidden');
    }

    function renderAttachmentsList() {
        const listContainer = $id('attachments-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        // ۱. رندر فایل‌های موجود قبلی روی سرور
        state.existingAttachments.forEach((fileName, index) => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs';

            const info = document.createElement('div');
            info.className = 'min-w-0 flex items-center gap-2';

            const badge = document.createElement('span');
            badge.className = 'text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0';
            badge.textContent = 'موجود در سرور';

            const name = document.createElement('span');
            name.className = 'font-semibold text-slate-700 truncate';
            name.textContent = `📎 ${fileName}`;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'text-rose-600 hover:text-rose-700 font-bold shrink-0';
            removeBtn.textContent = 'حذف';

            removeBtn.addEventListener('click', () => {
                state.existingAttachments.splice(index, 1);
                renderAttachmentsList();
            });

            info.appendChild(badge);
            info.appendChild(name);
            item.appendChild(info);
            item.appendChild(removeBtn);
            listContainer.appendChild(item);
        });

        // ۲. رندر فایل‌های جدید انتخاب‌شده
        state.selectedAttachments.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs';

            const info = document.createElement('div');
            info.className = 'min-w-0 flex items-center gap-2';

            const badge = document.createElement('span');
            badge.className = 'text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shrink-0 font-bold';
            badge.textContent = 'جدید';

            const name = document.createElement('span');
            name.className = 'font-semibold text-slate-700 truncate';
            name.textContent = file.name;

            const size = document.createElement('span');
            size.className = 'text-[10px] text-slate-400 shrink-0';
            size.textContent = `(${formatBytes(file.size)})`;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'text-rose-600 hover:text-rose-700 font-bold shrink-0';
            removeBtn.textContent = 'حذف';

            removeBtn.addEventListener('click', () => {
                state.selectedAttachments.splice(index, 1);
                renderAttachmentsList();
            });

            info.appendChild(badge);
            info.appendChild(name);
            info.appendChild(size);
            item.appendChild(info);
            item.appendChild(removeBtn);
            listContainer.appendChild(item);
        });
    }

    

    function renderExistingCoverPreview(fileUrl, fileName) {
        const previewContainer = $id('cover-preview-container');
        const dragZone = $id('cover-drag-zone');
        const selectText = $id('cover-select-text');
        const filenameText = $id('cover-filename');
        const filesizeText = $id('cover-filesize');

        if (dragZone) {
            dragZone.style.backgroundImage = `url('${fileUrl}')`;
            dragZone.classList.add('has-image');
        }
        if (selectText) selectText.textContent = 'تغییر تصویر';
        if (filenameText) filenameText.textContent = fileName || 'تصویر شاخص قبلی';
        if (filesizeText) filesizeText.textContent = 'ذخیره شده در سرور';
        if (previewContainer) previewContainer.classList.remove('hidden');
    }

    function renderExistingAttachmentsList(report, attachmentNames) {
        const listContainer = $id('attachments-list');
        if (!listContainer) return;

        attachmentNames.forEach((fileName) => {
            const fileUrl = state.pb.files.getUrl(report, fileName);
            const item = document.createElement('div');
            item.className = 'p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs';

            const info = document.createElement('div');
            info.className = 'min-w-0 flex items-center gap-2';

            const link = document.createElement('a');
            link.href = fileUrl;
            link.target = '_blank';
            link.className = 'font-semibold text-indigo-600 hover:underline truncate';
            link.textContent = `📎 ${fileName}`;

            const badge = document.createElement('span');
            badge.className = 'text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded shrink-0';
            badge.textContent = 'فایل موجود';

            info.appendChild(link);
            info.appendChild(badge);
            item.appendChild(info);
            listContainer.appendChild(item);
        });
    }

    function initFormActions() {
        const form = $id('create-report-form');
        const cancelBtn = $id('cancel-btn');

        if (form) {
            form.addEventListener('submit', handleSubmit);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                clearForm();
            });
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearError();

        const validationError = validateForm();
        if (validationError) {
            showError(validationError);
            return;
        }

        setSubmitLoading(true);

        try {
            const currentUser =
                state.pb.authStore.record ||
                state.pb.authStore.model ||
                {};

            const departmentId =
                currentUser.department_rel ||
                currentUser.department ||
                '';

            console.log('Current user:', currentUser);
            console.log('Department:', departmentId);

            if (!currentUser.id) {
                showError('اطلاعات کاربر واردشده قابل دریافت نیست. لطفاً خارج و دوباره وارد شوید.');
                return;
            }

            const ALLOWED_ROLES_WITHOUT_DEPT = ['expert', 'department', 'admin_general', 'admin_site'];
            const userRole = currentUser.role || currentUser.expand?.role?.name || '';

            if (!departmentId && !ALLOWED_ROLES_WITHOUT_DEPT.includes(userRole)) {
                showError('برای کاربر فعلی دپارتمان تعیین نشده است.');
                return;
            }

            // --- دریافت و اعتبارسنجی تاریخ وقوع ---
            const occurrenceDateVal = getValue('report-occurrence-date');
            if (!occurrenceDateVal) {
                showError('لطفاً تاریخ وقوع رویداد را انتخاب کنید.');
                return;
            }

            const formData = new FormData();

            appendValue(formData, 'title', getValue('report-title'));

            // تولید automation_id فقط در ثبت اولیه انجام می‌شود
            if (!state.reportId) {
                appendValue(formData, 'automation_id', generateAutomationId());
            }

            appendValue(formData, 'occurrence_date', occurrenceDateVal); // ارسال دقیق تاریخ آماده‌شده
            appendValue(formData, 'abstract', getValue('report-abstract'));
            appendValue(formData, 'classification', getValue('report-classification'));
            appendValue(formData, 'priority', getValue('report-priority'));
            appendValue(formData, 'news_type', getValue('report-news-type'));
            appendValue(formData, 'evaluation', getValue('report-evaluation'));

            if (state.quill) {
                const html = state.quill.root.innerHTML.trim();
                if (html && html !== '<p><br></p>') formData.append('content', html);
            } else {
                appendValue(formData, 'content', getValue('report-content'));
            }

            if (currentUser.id) {
                const authorId = state.selectedAuthor?.id || currentUser.id;
                formData.append('author', authorId);
                formData.append('submitter', currentUser.id);
                if (departmentId) {
                    formData.append('department', departmentId);
                }
            }

            state.selectedCases.forEach((id) => formData.append('cases_rel', id));
            state.selectedTopics.forEach((id) => formData.append('topics_rel', id));

            if (state.selectedCoverFile) {
                formData.append('cover_image', state.selectedCoverFile);
            }

            // ارسال اسامی فایل‌های قبلی جهت جلوگیری از پاک شدن در PocketBase
            state.existingAttachments.forEach((fileName) => {
                formData.append('attachments', fileName);
            });

            // ارسال فایل‌های جدید
            state.selectedAttachments.forEach((file) => {
                formData.append('attachments', file);
            });

            console.log('Current user:', currentUser);
            console.log('Department:', currentUser.department_rel);

            let savedReport;
            if (state.reportId) {
                // ۱. دریافت آخرین نسخه کامل گزارش فعلی از دیتابیس
                const currentReport = await state.pb.collection(COLLECTIONS.reports).getOne(state.reportId);
                const currentVersion = (typeof currentReport.version === 'number' && currentReport.version > 0) ? currentReport.version : 1;

                // ۲. دریافت تمام کامنت‌های مرتبط با این گزارش جهت ثبت Snapshot به همراه اطلاعات کامل نویسنده
                let currentComments = [];
                try {
                    const rawComments = await state.pb.collection('comments').getFullList({
                        filter: `report = "${state.reportId}"`,
                        sort: '+created',
                        expand: 'author'
                    });

                    currentComments = rawComments.map(c => ({
                        id: c.id,
                        text: c.text || '',
                        type: c.type || '',
                        parent: c.parent || null,
                        author: c.author || '',
                        authorName: c.expand?.author?.name || c.expand?.author?.username || c.authorName || 'کاربر سیستم',
                        created: c.created || '',
                        version: c.version || 1
                    }));
                } catch (cErr) {
                    console.warn('خطا در دریافت کامنت‌ها برای ساخت Snapshot:', cErr);
                }

                // ۳. دریافت دلیل ویرایش از ورودی در صورت وجود
                const changeReasonInput = $id('report-change-reason') || $id('change-reason');
                const changeReasonVal = changeReasonInput ? changeReasonInput.value.trim() : '';

                // ۴. ایجاد رکورد پشتیبان (Snapshot) کامل مطابق با اسکیمای report_versions
                const versionSnapshotData = {
                    report: state.reportId,
                    title: currentReport.title || '',
                    abstract: currentReport.abstract || '',
                    content: currentReport.content || '',
                    automation_id: currentReport.automation_id || '',
                    classification: currentReport.classification || '',
                    priority: currentReport.priority || '',
                    news_type: currentReport.news_type || '',
                    evaluation: currentReport.evaluation || '',
                    occurrence_date: currentReport.occurrence_date || '',
                    department: currentReport.department || null,
                    author: currentReport.author || null,
                    change_reason: changeReasonVal,
                    cover_image: typeof currentReport.cover_image === 'string' ? currentReport.cover_image : '',
                    attachments: Array.isArray(currentReport.attachments) ? currentReport.attachments : [],
                    submitter: currentReport.submitter || null,
                    version: currentVersion,
                    cases_rel: Array.isArray(currentReport.cases_rel) ? currentReport.cases_rel : [],
                    topics_rel: Array.isArray(currentReport.topics_rel) ? currentReport.topics_rel : [],
                    snapshot_comments: currentComments || []
                };

                await state.pb.collection('report_versions').create(versionSnapshotData);

                // ۵. افزایش شماره نسخه و آپدیت گزارش اصلی
                formData.set('version', currentVersion + 1);
                savedReport = await state.pb.collection(COLLECTIONS.reports).update(state.reportId, formData);
                showToast('گزارش با موفقیت ویرایش شد و نسخه جدید ثبت گردید.');
            } else {
                // هنگام ثبت اولیه، مقدار نسخه روی ۱ قرار می‌گیرد
                formData.append('version', 1);

                savedReport = await state.pb.collection(COLLECTIONS.reports).create(formData);
                showToast('گزارش با موفقیت ثبت شد.');
            }

            // ذخیره کامنت‌های موقتی در صورت وجود
            if (typeof window.savePendingComments === 'function') {
                await window.savePendingComments(savedReport.id);
            }

            // به‌روزرسانی باکس متادیتا با اطلاعات تازه ثبت شده
            updateMetadataDisplay(savedReport);

            // اگر فرم تازه ایجاد شده است، ID را روی آدرس مرورگر ست می‌کنیم تا به حالت ویرایش تبدیل شود
            if (!state.reportId && savedReport?.id) {
                state.reportId = savedReport.id;
                const newUrl = `${window.location.pathname}?id=${savedReport.id}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
            }
        } catch (err) {
            console.error(err);

            // مدیریت اختصاصی انقضای نشست کاربری (خطای 401 یا نامعتبر بودن توکن)
            const isAuthError = err?.status === 401 || !state.pb.authStore.isValid;

            if (isAuthError) {
                showError('نشست کاربری شما منقضی شده است. لطفاً مجدداً وارد شوید.');
                setTimeout(() => {
                    window.location.href = 'login.html'; // یا مسیر صفحه لاگین پروژه
                }, 2000);
            } else {
                showError(getPocketBaseErrorMessage(err));
            }
        } finally {
            setSubmitLoading(false);
        }
    }

    function validateForm() {
        if (!getValue('report-title')) return 'عنوان گزارش الزامی است.';
        if (!getValue('report-occurrence-date')) return 'تاریخ وقوع الزامی است.';
        if (state.selectedCases.length === 0) return 'انتخاب حداقل یک کیس الزامی است.';
        if (state.selectedTopics.length === 0) return 'انتخاب حداقل یک موضوع الزامی است.';

        if (state.quill) {
            const html = state.quill.root.innerHTML.trim();
            if (!html || html === '<p><br></p>') {
                return 'شرح مفصل سند یا گزارش الزامی است.';
            }
        }
        return '';
    }

    function generateAutomationId() {
        const now = new Date();

        // دریافت کاربر انتخاب‌شده یا کاربر جاری سیستم
        const targetUser = state.selectedAuthor || state.pb.authStore.record || state.pb.authStore.model || {};

        // ۱. استخراج هوشمند کد اداره
        let deptCodeRaw = targetUser.dept_code;

        if (!deptCodeRaw && targetUser.expand?.department_rel) {
            deptCodeRaw = targetUser.expand.department_rel.dept_code;
        }

        if (!deptCodeRaw && targetUser.department_rel && Array.isArray(window.allUsersCache)) {
            const parentDept = window.allUsersCache.find(u => u.id === targetUser.department_rel);
            if (parentDept) {
                deptCodeRaw = parentDept.dept_code;
            }
        }

        const deptCode = String(deptCodeRaw || '101').padStart(3, '0');

        // ۲. استخراج کد اختصاصی کاربر (۳ رقم)
        const userCodeRaw = targetUser.user_code || '001';
        const userCode = String(userCodeRaw).padStart(3, '0');

        // ۳. ساخت بخش تاریخ ۶ رقمی شمسی با کتابخانه persian-date
        let shamsiDateStr = '';
        if (typeof persianDate !== 'undefined') {
            const pd = new persianDate(now);
            pd.toLocale('en'); // تنظیم نمایش اعداد به لاتین/انگلیسی
            const yy = String(pd.year()).slice(-2);
            const mm = String(pd.month()).padStart(2, '0');
            const dd = String(pd.date()).padStart(2, '0');
            shamsiDateStr = `${yy}${mm}${dd}`;
        } else {
            // پشتیبان در صورت عدم بارگیری کتابخانه
            const yy = String(now.getFullYear()).slice(-2);
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            shamsiDateStr = `${yy}${mm}${dd}`;
        }

        // ۴. ساخت شناسه یکتای 3 رقمی بر اساس میلی‌ثانیه جهت جلوگیری از تکرار در ثبت‌های همزمان
        const uniqueSuffix = String(now.getMilliseconds() % 1000).padStart(3, '0');
        // خروجی کد ۱۴ رقمی عددی: [کد اداره ۳ رقم][کد کاربر ۳ رقم][تاریخ شمسی ۶ رقم][شناسه یکتا ۲ رقم]
        return `${deptCode}${userCode}${shamsiDateStr}${uniqueSuffix}`;
    }

    function clearForm() {
        const form = $id('create-report-form');
        if (form) form.reset();

        state.selectedCoverFile = null;
        state.selectedAttachments = [];
        state.existingAttachments = [];
        state.selectedTopics.length = 0;
        state.selectedCases.length = 0;

        if (state.quill) state.quill.setText('');

        const coverPreview = $id('cover-preview-container');
        const dragZone = $id('cover-drag-zone');
        const selectText = $id('cover-select-text');

        if (coverPreview) coverPreview.classList.add('hidden');
        if (dragZone) {
            dragZone.style.backgroundImage = '';
            dragZone.classList.remove('has-image');
        }
        if (selectText) selectText.textContent = 'انتخاب تصویر';

        renderAttachmentsList();

        const topicsContainer = $id('topics-picker-container');
        const casesContainer = $id('cases-picker-container');

        if (topicsContainer) topicsContainer.innerHTML = '<span class="text-slate-400 text-xs select-none pr-2">انتخاب موضوعات...</span>';
        if (casesContainer) casesContainer.innerHTML = '<span class="text-slate-400 text-xs select-none pr-2">انتخاب کیس‌ها...</span>';

        clearError();
    }

    function appendValue(formData, field, value) {
        if (value !== null && value !== undefined && String(value).trim() !== '') {
            formData.append(field, String(value).trim());
        }
    }

    // بازگردانی مقدار فیلدها با هندل کردن ساختار آرایه‌ای یا تک مقدار
    function getValue(id) {
        const el = $id(id);
        return el ? el.value.trim() : '';
    }

    function setSubmitLoading(isLoading) {
        const btn = $id('submit-btn');
        if (!btn) return;

        btn.disabled = isLoading;

        const spinner = $id('btn-spinner') || btn.querySelector('[data-submit-spinner]');
        const text = $id('btn-text') || btn.querySelector('[data-submit-text]');

        const defaultText = state.reportId ? 'ویرایش و ذخیره‌سازی نهایی' : 'ثبت و ذخیره‌سازی نهایی';
        const loadingText = state.reportId ? 'در حال ذخیره‌سازی ویرایش...' : 'در حال ثبت...';

        if (text) text.textContent = isLoading ? loadingText : defaultText;
        if (spinner) spinner.classList.toggle('hidden', !isLoading);
    }

    function showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'خطا',
            text: message,
            confirmButtonText: 'تایید',
            customClass: {
                confirmButton: 'px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs transition hover:bg-rose-700'
            },
            buttonsStyling: false
        });
    }

    function clearError() {
        // عدم نیاز به پاکسازی با حضور SweetAlert2
    }

    function showToast(message) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: message,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }

    // function getPocketBaseErrorMessage(err) {
    //     const data = err && err.data && err.data.data ? err.data.data : {};

    //     if (data.automation_id) return 'شماره اتوماسیون تولیدشده تکراری است. دوباره تلاش کنید.';
    //     if (data.title) return 'عنوان گزارش معتبر نیست.';
    //     if (data.occurrence_date) return 'تاریخ وقوع معتبر نیست.';
    //     if (data.cases_rel) return 'کیس‌های انتخاب‌شده معتبر نیستند.';
    //     if (data.topics_rel) return 'موضوعات انتخاب‌شده معتبر نیستند.';
    //     if (data.cover_image) return 'تصویر شاخص معتبر نیست یا حجم آن بیش از حد مجاز است.';
    //     if (data.attachments) return 'یکی از فایل‌های پیوست معتبر نیست یا محدودیت فایل‌ها رعایت نشده است.';
    //     if (err && err.message) return `خطا در ثبت گزارش: ${err.message}`;

    //     return 'خطای نامشخصی هنگام ثبت گزارش رخ داد.';
    // }

    function getPocketBaseErrorMessage(err) {
        const fieldErrors =
            err?.data?.data ||
            err?.data ||
            err?.response?.data?.data ||
            err?.response?.data ||
            {};

        console.error('PocketBase create-report error details:', {
            status: err?.status,
            message: err?.message,
            data: err?.data,
            response: err?.response,
            fieldErrors
        });

        const messages = Object.entries(fieldErrors)
            .map(([field, details]) => {
                const message = details?.message || details?.code || '';
                return `${field}: ${message}`;
            })
            .filter(Boolean);

        if (messages.length) {
            return `ثبت گزارش ناموفق بود: ${messages.join(' | ')}`;
        }

        if (err?.status === 403) {
            return 'اجازه ثبت گزارش ندارید؛ Create Rule کالکشن reports را بررسی کنید.';
        }

        if (err?.status === 401) {
            return 'نشست کاربری نامعتبر است؛ دوباره وارد سامانه شوید.';
        }

        return err?.message
            ? `خطا در ثبت گزارش: ${err.message}`
            : 'خطای نامشخصی هنگام ثبت گزارش رخ داد.';
    }

    function loadDynamicSelectOptions() {
        // مقادیر ثابت استخراج شده از JSON بک‌اند PocketBase
        const staticOptions = {
            classification: [
                "عادی",
                "محرمانه",
                "خیلی محرمانه",
                "سری",
                "به کلی سری"
            ],
            priority: [
                "عادی",
                "فوری",
                "آنی"
            ],
            news_type: [
                "آشکار",
                "رسمی",
                "فنی",
                "سایبری",
                "منبع",
                "راوی"
            ],
            evaluation: [
                "صحت دارد",
                "احتمالا صحت دارد",
                "در دست بررسی",
                "صحت ندارد"
            ]
        };

        // پر کردن داینامیک منوهای کشویی بر اساس الگوی فرم
        Object.keys(staticOptions).forEach(fieldName => {
            const values = staticOptions[fieldName];
            populateSelectOptions(fieldName, values);
        });
    }

    // تابع کمکی برای پر کردن گزینه‌ها
    function populateSelectOptions(fieldName, values) {
        const selectEl = document.querySelector(`select[name="${fieldName}"]`);
        if (!selectEl) return;

        // حفظ گزینه اول (placeholder) و پاک کردن بقیه
        while (selectEl.options.length > 1) {
            selectEl.remove(1);
        }

        values.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            selectEl.appendChild(opt);
        });
    }

    function formatBytes(bytes) {
        if (!bytes) return '۰ بایت';

        const mb = bytes / (1024 * 1024);
        if (mb >= 1024) return `${(mb / 1024).toFixed(2)} گیگابایت`;
        return `${mb.toFixed(2)} مگابایت`;
    }

    // تابع بازیابی مقادیر نسخه انتخابی روی فرم
    window.restoreReportVersionToForm = function (versionData) {
        if (!versionData) return;

        setInputValue('report-title', versionData.title);
        setInputValue('report-abstract', versionData.abstract);
        setInputValue('report-classification', versionData.classification);
        setInputValue('report-priority', versionData.priority);
        setInputValue('report-news-type', versionData.news_type);
        setInputValue('report-evaluation', versionData.evaluation);

        if (state.quill && versionData.content) {
            state.quill.clipboard.dangerouslyPasteHTML(versionData.content);
        }

        if (Array.isArray(versionData.topics_rel)) {
            state.selectedTopics = [...versionData.topics_rel];
            renderTopicsTags(state.allTopics);
            renderTopicsList(state.allTopics);
        }

        if (Array.isArray(versionData.cases_rel)) {
            state.selectedCases = [...versionData.cases_rel];
            renderCasesTags(state.allOrderedCases, state.allRawCases);
            renderCasesList(state.allOrderedCases, state.allRawCases);
        }

        showToast(`اطلاعات نسخه ${versionData.version} با موفقیت روی فرم جایگذاری شد.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});


