export function openBackupCreateModal(settings = {
    oncreated: null,
}) {
    const modal = backupCreateModal(settings);
    if (!modal) {
        return;
    }

    document.body.appendChild(modal);

    app.modals.open(modal);
}

function backupCreateModal(settings) {
    let modal;

    const uniqueId = "backup_create_" + app.utils.randomString();

    const data = store({
        name: "",
        isSubmitting: false,
    });

    let submitTimeoutId;

    async function submit() {
        if (data.isSubmitting) {
            return;
        }

        data.isSubmitting = true;

        clearTimeout(submitTimeoutId);
        submitTimeoutId = setTimeout(() => {
            app.modals.close(modal);
        }, 1500);

        try {
            await app.pb.backups.create(data.name, { requestKey: uniqueId });

            data.isSubmitting = false;

            if (settings.oncreated) {
                settings.oncreated(data.name);
            }

            app.toasts.success("Successfully generated new backup.");

            app.modals.close(modal);
        } catch (err) {
            if (!err.isAbort) {
                clearTimeout(submitTimeoutId);
                data.isSubmitting = false;
                app.checkApiError(err);
            }
        }
    }

    modal = t.div(
        {
            pbEvent: "backupCreateModal",
            className: "modal popup backup-create-modal",
            onbeforeclose: () => {
                if (data.isSubmitting) {
                    app.toasts.info(
                        "The backup was started but may take a while to complete. You can come back later.",
                    );
                }
            },
            onafterclose: (el) => {
                clearTimeout(submitTimeoutId);
                el?.remove();
            },
        },
        t.header(
            { className: "modal-header" },
            t.h5({ className: "m-auto txt-center" }, "مقداردهی نسخه پشتیبان جدید"),
        ),
        t.form(
            {
                id: uniqueId,
                className: "modal-content backup-restore-form",
                autocomplete: "off",
                onsubmit: (e) => {
                    e.preventDefault();
                    submit();
                },
            },
            t.div(
                { className: "grid" },
                t.div(
                    { className: "col-lg-12" },
                    t.div(
                        { className: "alert warning" },
                        t.div(
                            { className: "content" },
                            t.p(
                                null,
                                `لطفاً توجه داشته باشید که در طول پشتیبان‌گیری، عملکرد ممکن است کمی کاهش یابد و برخی از درخواست‌ها ممکن است بیشتر از حد معمول طول بکشند.`,
                            ),
                            t.p(
                                { className: "txt-bold" },
                                `اگر از فضای ذخیره‌سازی ابری برای آپلود فایل‌های مجموعه استفاده می‌کنید، باید جداگانه از آنها پشتیبان تهیه کنید زیرا به صورت محلی ذخیره نمی‌شوند و در پشتیبان تولید شده لحاظ نخواهند شد!`,
                            ),
                        ),
                    ),
                ),
                t.div(
                    { className: "col-lg-12" },
                    t.div(
                        { className: "field" },
                        t.label({ htmlFor: uniqueId + "_name" }, "نام پشتیبان"),
                        t.input({
                            id: uniqueId + "_name",
                            name: "name",
                            type: "text",
                            pattern: "^[a-z0-9_-]+\.zip$",
                            placeholder: "برای تولید خودکار، خالی بگذارید",
                            value: () => data.name,
                            oninput: (e) => (data.name = e.target.value),
                        }),
                    ),
                    t.div({ className: "field-help" }, "باید به فرمت [a-z0-9_-].zip باشد"),
                ),
            ),
        ),
        t.footer(
            { className: "modal-footer" },
            t.button(
                {
                    type: "button",
                    className: "btn transparent m-r-auto",
                    disabled: () => data.isSubmitting,
                    onclick: () => app.modals.close(modal),
                },
                t.span({ className: "txt" }, "لغو"),
            ),
            t.button(
                {
                    "html-form": uniqueId,
                    type: "submit",
                    className: () => `btn ${data.isSubmitting ? "loading" : ""}`,
                    disabled: () => data.isSubmitting,
                },
                t.span({ className: "txt" }, "شروع پشتیبان گیری"),
            ),
        ),
    );

    return modal;
}
