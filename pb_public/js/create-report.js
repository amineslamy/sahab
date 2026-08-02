document.addEventListener('DOMContentLoaded', () => {
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
        selectedTopics: [],
        selectedCases: []
    };

    const $id = (id) => document.getElementById(id);

    boot();

    // ۱. تابع جدید بررسی و تازه سازی نشست کاربری در سمت سرور
    async function checkAuthAndRefresh() {
        if (!state.pb.authStore.isValid) {
            handleInvalidAuth();
            return false;
        }

        try {
            console.log("در حال تازه‌سازی نشست و دریافت اطلاعات کاربر...");
            // درخواست رسمی به سرور برای احراز هویت مجدد توکن
            const authData = await state.pb.collection('users').authRefresh();
            const currentUser = authData.record || {};
            const departmentId = currentUser.department_rel || currentUser.department || '';

            if (!departmentId) {
                showError("نشست شما معتبر است، اما دپارتمانی برای حساب کاربری شما تعریف نشده است. لطفا با مدیر سیستم تماس بگیرید.");
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

    // ۳. گوش دادن به تغییر وضعیت تب مرورگر (مثلا بازگشت از Sleep یا فعال شدن مجدد تب)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && state.pb) {
            console.log("تب فعال شد. در حال بررسی مجدد اعتبار نشست...");
            await checkAuthAndRefresh();
        }
    });

    async function boot() {
        if (!window.PocketBase) {
            showError('کتابخانه PocketBase بارگذاری نشده است.');
            return;
        }

        state.pb = new PocketBase(PB_URL);

        // ۴. جایگزین کردن بررسی ساده قبلی با تابع جدید
        const isAuthValid = await checkAuthAndRefresh();
        if (!isAuthValid) {
            return; // اگر نشست معتبر نبود، تابع checkAuthAndRefresh خودش هدایت به لاگین را انجام می‌دهد.
        }

        initEditor();
        initDatepickers();
        initFileInputs();
        initFormActions();

        await initRelationPickers();
    }


    function initEditor() {
        const editorEl = $id('editor-container');
        if (!editorEl) return;

        if (!window.Quill) {
            showError('ویرایشگر متن بارگذاری نشده است. فایل Quill یا CDN آن را بررسی کنید.');
            return;
        }

        state.quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'متن کامل گزارش، تحلیل یا ارزیابی را در این بخش وارد نمایید...',
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ color: [] }, { background: [] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ align: [] }],
                    ['link', 'blockquote', 'code-block'],
                    ['clean']
                ]
            }
        });

        state.quill.root.setAttribute('dir', 'rtl');
        state.quill.root.style.textAlign = 'right';
        state.quill.format('direction', 'rtl');
        state.quill.format('align', 'right');
    }

    function initDatepickers() {
        if (!window.jQuery || !jQuery.fn || !jQuery.fn.persianDatepicker || !window.persianDate) {
            showError('تقویم شمسی بارگذاری نشده است. ترتیب لود jQuery، persian-date و persian-datepicker را بررسی کنید.');
            return;
        }

        setupDatepicker('occurrence-date-picker', 'report-occurrence-date');
        setupDatepicker('publish-date-picker', 'report-publish-date');
    }

    function setupDatepicker(visibleInputId, hiddenInputId) {
        const visibleInput = $id(visibleInputId);
        const hiddenInput = $id(hiddenInputId);

        if (!visibleInput || !hiddenInput) return;

        jQuery(`#${visibleInputId}`).persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            observer: true,
            onSelect: function (unixTimestamp) {
                const normalizedTimestamp = Number(unixTimestamp) < 10000000000
                    ? Number(unixTimestamp) * 1000
                    : Number(unixTimestamp);

                const gregorianDate = new persianDate(normalizedTimestamp).toDate();
                hiddenInput.value = gregorianDate.toISOString();
            }
        });
    }

    async function initRelationPickers() {
        const results = await Promise.allSettled([
            state.pb.collection(COLLECTIONS.topics).getFullList({ sort: 'title' }),
            state.pb.collection(COLLECTIONS.cases).getFullList({ sort: 'title' })
        ]);

        const topicsResult = results[0];
        const casesResult = results[1];
        const errors = [];

        // مدیریت لود موضوعات
        if (topicsResult.status === 'fulfilled') {
            setupPicker({
                containerId: 'topics-picker-container',
                dropdownId: 'topics-dropdown',
                items: topicsResult.value,
                selectedList: state.selectedTopics,
                placeholder: 'انتخاب موضوعات...',
                maxLimit: LIMITS.relationMax
            });
        } else {
            console.error('Topics loading error:', topicsResult.reason);
            setPickerLoadError('topics-picker-container', 'خطا در بارگذاری موضوعات');
            errors.push(getCollectionLoadError('موضوعات', topicsResult.reason));
        }

        // مدیریت لود کیس‌ها
        if (casesResult.status === 'fulfilled') {
            setupPicker({
                containerId: 'cases-picker-container',
                dropdownId: 'cases-dropdown',
                items: casesResult.value,
                selectedList: state.selectedCases,
                placeholder: 'انتخاب کیس‌ها...',
                maxLimit: LIMITS.relationMax
            });
        } else {
            console.error('Cases loading error:', casesResult.reason);
            setPickerLoadError('cases-picker-container', 'خطا در بارگذاری کیس‌ها');
            errors.push(getCollectionLoadError('کیس‌ها', casesResult.reason));
        }

        if (errors.length > 0) {
            showError(errors.join(' | '));
        }
    }

    function setPickerLoadError(containerId, message) {
        const container = $id(containerId);
        if (!container) return;
        container.innerHTML = `<span class="text-red-500 text-xs font-semibold select-none pr-2">${message}</span>`;
    }

    function getCollectionLoadError(label, error) {
        const status = error?.status || error?.response?.code || 0;
        if (status === 401) return `نشست کاربری برای دریافت ${label} نامعتبر است.`;
        if (status === 403) return `مجوز خواندن ${label} صادر نشده است (Rules بررسی شود).`;
        if (status === 404) return `کالکشن ${label} یافت نشد.`;
        return `خطایی در دریافت ${label} رخ داد.`;
    }

    function setupPicker(config) {
        const container = $id(config.containerId);
        const dropdown = $id(config.dropdownId);

        if (!container || !dropdown) return;

        const closeDropdown = () => dropdown.classList.add('hidden');

        document.addEventListener('click', closeDropdown);

        container.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdown.classList.toggle('hidden');
            renderDropdown();
        });

        dropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        renderSelected();

        function renderSelected() {
            container.innerHTML = '';

            if (config.selectedList.length === 0) {
                const placeholder = document.createElement('span');
                placeholder.className = 'text-slate-400 text-xs select-none pr-2';
                placeholder.textContent = config.placeholder;
                container.appendChild(placeholder);
                return;
            }

            config.selectedList.forEach((id) => {
                const item = config.items.find((record) => record.id === id);
                if (!item) return;

                const tag = document.createElement('span');
                tag.className = 'bg-slate-200 text-slate-800 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1.5';

                const label = document.createElement('span');
                label.textContent = item.title || item.name || item.id;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'text-slate-500 hover:text-slate-800 font-bold';
                removeBtn.textContent = '×';

                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const index = config.selectedList.indexOf(id);
                    if (index !== -1) config.selectedList.splice(index, 1);
                    renderSelected();
                    renderDropdown();
                });

                tag.appendChild(label);
                tag.appendChild(removeBtn);
                container.appendChild(tag);
            });
        }

        function renderDropdown() {
            dropdown.innerHTML = '';

            if (!config.items.length) {
                dropdown.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center">آیتمی یافت نشد.</div>';
                return;
            }

            config.items.forEach((item) => {
                const isSelected = config.selectedList.includes(item.id);

                const option = document.createElement('button');
                option.type = 'button';
                option.className = `w-full p-3 text-xs cursor-pointer hover:bg-slate-100 flex justify-between items-center transition ${isSelected ? 'bg-slate-50 font-bold text-slate-800' : 'text-slate-700'
                    }`;

                const label = document.createElement('span');
                label.textContent = item.title || item.name || item.id;

                const check = document.createElement('span');
                check.className = 'text-emerald-600 font-bold';
                check.textContent = isSelected ? '✓' : '';

                option.appendChild(label);
                option.appendChild(check);

                option.addEventListener('click', () => {
                    const index = config.selectedList.indexOf(item.id);

                    if (index !== -1) {
                        config.selectedList.splice(index, 1);
                    } else {
                        if (config.selectedList.length >= config.maxLimit) {
                            showError(`حداکثر ${config.maxLimit} مورد قابل انتخاب است.`);
                            return;
                        }

                        config.selectedList.push(item.id);
                    }

                    renderSelected();
                    renderDropdown();
                });

                dropdown.appendChild(option);
            });
        }
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

                if (state.selectedAttachments.length + incomingFiles.length > LIMITS.attachmentsMaxCount) {
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

                if (input) input.value = '';
                if (preview) preview.classList.add('hidden');
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
        const previewImg = $id('cover-preview-img');
        const filenameText = $id('cover-filename');
        const filesizeText = $id('cover-filesize');

        if (previewImg) previewImg.src = URL.createObjectURL(file);
        if (filenameText) filenameText.textContent = file.name;
        if (filesizeText) filesizeText.textContent = formatBytes(file.size);
        if (previewContainer) previewContainer.classList.remove('hidden');
    }

    function renderAttachmentsList() {
        const listContainer = $id('attachments-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        state.selectedAttachments.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs';

            const info = document.createElement('div');
            info.className = 'min-w-0 flex items-center gap-2';

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

            info.appendChild(name);
            info.appendChild(size);
            item.appendChild(info);
            item.appendChild(removeBtn);
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

            if (!departmentId) {
                showError('برای کاربر فعلی دپارتمان تعیین نشده است.');
                return;
            }

            const formData = new FormData();


            appendValue(formData, 'title', getValue('report-title'));
            appendValue(formData, 'automation_id', generateAutomationId());
            appendValue(formData, 'occurrence_date', getValue('report-occurrence-date'));
            appendValue(formData, 'publish_date', getValue('report-publish-date'));
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
                formData.append('author', currentUser.id);
                formData.append('submitter', currentUser.id);
                formData.append('department', departmentId);

            }

            if (currentUser.department_rel) {
                formData.append('department', currentUser.department_rel);
            }

            state.selectedCases.forEach((id) => formData.append('cases_rel', id));
            state.selectedTopics.forEach((id) => formData.append('topics_rel', id));

            if (state.selectedCoverFile) {
                formData.append('cover_image', state.selectedCoverFile);
            }

            state.selectedAttachments.forEach((file) => {
                formData.append('attachments', file);
            });
            console.log('Current user:', currentUser);
            console.log('Department:', currentUser.department_rel);

            await state.pb.collection(COLLECTIONS.reports).create(formData);

            showToast('گزارش با موفقیت ثبت شد.');
            clearForm();

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1800);
        } catch (err) {
            console.error(err);
            showError(getPocketBaseErrorMessage(err));
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

        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();

        return `REP-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${random}`;
    }

    function clearForm() {
        const form = $id('create-report-form');
        if (form) form.reset();

        state.selectedCoverFile = null;
        state.selectedAttachments = [];
        state.selectedTopics.length = 0;
        state.selectedCases.length = 0;

        if (state.quill) state.quill.setText('');

        const coverPreview = $id('cover-preview-container');
        if (coverPreview) coverPreview.classList.add('hidden');

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

        if (text) text.textContent = isLoading ? 'در حال ثبت...' : 'ثبت و ذخیره‌سازی نهایی';
        if (spinner) spinner.classList.toggle('hidden', !isLoading);
    }

    function showError(message) {
        const alert = $id('error-alert');

        if (!alert) {
            console.error(message);
            return;
        }

        alert.textContent = message;
        alert.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearError() {
        const alert = $id('error-alert');
        if (!alert) return;

        alert.textContent = '';
        alert.classList.add('hidden');
    }

    function showToast(message) {
        const toast = $id('success-toast') || $id('toast-success');

        if (!toast) {
            alert(message);
            return;
        }

        // اگر محتوای کاستوم در HTML بود (شامل تگ SVG)، تگ متنی را درون آن به روز می‌کنیم
        const textNode = toast.querySelector('span.text-sm');
        if (textNode) {
            textNode.textContent = message;
        } else {
            toast.textContent = message;
        }

        // استایل‌های نمایش انیمیشن Toast
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 2500);
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


    function formatBytes(bytes) {
        if (!bytes) return '۰ بایت';

        const mb = bytes / (1024 * 1024);
        if (mb >= 1024) return `${(mb / 1024).toFixed(2)} گیگابایت`;
        return `${mb.toFixed(2)} مگابایت`;
    }
});

// بررسی مجدد اعتبار نشست زمانی که کاربر دوباره به تب مرورگر برمی‌گردد
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        console.log("تب فعال شد. در حال بررسی مجدد اعتبار نشست...");
        await checkAuthAndRefresh();
    }
});
