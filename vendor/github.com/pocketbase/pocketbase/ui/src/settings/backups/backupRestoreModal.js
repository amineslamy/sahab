export function openBackupRestoreModal(key) {
    const modal = backupRestoreModal(key);

    document.body.appendChild(modal);

    app.modals.open(modal);
}

function backupRestoreModal(key) {
    const uniqueId = "backup_restore_" + app.utils.randomString();

    const data = store({
        key: key,
        keyConfirm: "",
        isSubmitting: false,
        get canSubmit() {
            return data.key && data.key == data.keyConfirm;
        },
    });

    let reloadTimeoutId;

    async function submit() {
        if (data.isSubmitting || !data.canSubmit) {
            return;
        }

        clearTimeout(reloadTimeoutId);

        data.isSubmitting = true;

        try {
            await app.pb.backups.restore(data.keyConfirm);

            // optimistic restore page reload
            reloadTimeoutId = setTimeout(() => {
                window.location.reload();
                data.isSubmitting = false;
            }, 2000);
        } catch (err) {
            clearTimeout(reloadTimeoutId);

            if (!err?.isAbort) {
                data.isSubmitting = false;
                app.checkApiError(err);
            }
        }
    }

    return t.div(
        {
            pbEvent: "backupRestoreModal",
            className: "modal popup backup-restore-modal",
            onbeforeclose: () => {
                return !data.isSubmitting;
            },
            onafterclose: (el) => {
                el?.remove();
            },
            onunmount: () => {
                clearTimeout(reloadTimeoutId);
            },
        },
        t.header(
            { className: "modal-header" },
            t.h5(
                { className: "m-auto txt-center" },
                "Restore ",
                t.strong(null, () => data.key),
            ),
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
                        { className: "alert danger" },
                        t.div(
                            { className: "content" },
                            t.p(
                                { className: "txt-bold" },
                                "لطفاً با احتیاط شدید عمل کنید و فقط با پشتیبان‌های معتبر از آن استفاده کنید!",
                            ),
                            t.p(null, "بازیابی نسخه پشتیبان در حال حاضر فقط در سیستم‌های مبتنی بر یونیکس کار می‌کند."),
                            t.p(
                                null,
                                "عملیات بازیابی تلاش خواهد کرد تا فایل موجود شما را جایگزین کند. ",
                                t.code(null, "pb_data"),
                                " با نسخه پشتیبان تهیه شده و فرآیند درخواست را مجدداً راه اندازی می کند.",
                            ),
                            t.p(
                                null,
                                "این بدان معناست که در صورت موفقیت، تمام داده‌های شما (از جمله تنظیمات برنامه، کاربران، کاربران ارشد و غیره) با داده‌های موجود در نسخه پشتیبان جایگزین می‌شوند.",
                            ),
                            t.p(
                                null,
                                "عملیات بازیابی اگر پشتیبان نامعتبر باشد (مثلاً فایل ",
                                t.code(null, "data.db"),
                                " گمشده) لغو خواهد شد.",
                            ),
                            t.p(null, "در ادامه نسخه ساده شده جریان بازیابی آورده شده است:"),
                            t.ol(
                                null,
                                t.li(
                                    null,
                                    "Replaces the current ",
                                    t.code(null, "pb_data"),
                                    " with the content from the backup.",
                                ),
                                t.li(null, "Triggers app restart."),
                                t.li(
                                    null,
                                    "Applies all migrations that are missing in the restored ",
                                    t.code(null, "pb_data"),
                                    ".",
                                ),
                                t.li(null, "Initializes the app server as usual."),
                            ),
                        ),
                    ),
                ),
                t.div(
                    { className: "col-lg-12" },
                    t.div(
                        { className: "confirm-key-label m-b-sm" },
                        "نام پشتیبان را تایپ کنید ",
                        t.div(
                            { className: "label" },
                            () => data.key,
                            app.components.copyButton(() => data.key),
                        ),
                        " to confirm:",
                    ),
                    t.div(
                        { className: "field" },
                        t.label({ htmlFor: uniqueId + "_key" }, "نام پشتیبان"),
                        t.input({
                            id: uniqueId + "_key",
                            name: "key",
                            type: "text",
                            required: true,
                            value: () => data.keyConfirm,
                            oninput: (e) => (data.keyConfirm = e.target.value),
                        }),
                    ),
                ),
            ),
        ),
        t.footer(
            { className: "modal-footer" },
            t.button(
                {
                    type: "button",
                    className: "btn transparent m-r-auto",
                    onclick: () => app.modals.close(),
                    disabled: () => data.isSubmitting,
                },
                t.span({ className: "txt" }, "لغو"),
            ),
            t.button(
                {
                    "html-form": uniqueId,
                    type: "submit",
                    className: () => `btn ${data.isSubmitting ? "loading" : ""}`,
                    disabled: () => data.isSubmitting || !data.canSubmit,
                },
                t.span({ className: "txt" }, "بازنشانی نسخه پشتیبان"),
            ),
        ),
    );
}
