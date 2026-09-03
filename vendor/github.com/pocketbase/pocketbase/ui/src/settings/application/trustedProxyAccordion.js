export function trustedProxyAccordion(pageData) {
    const commonProxyHeaders = ["X-Forwarded-For", "Fly-Client-IP", "CF-Connecting-IP"];

    const ipOptions = [
        { label: "Use leftmost IP", value: true },
        { label: "Use rightmost IP", value: false },
    ];

    const proxyInfo = store({
        isLoading: false,
        realIP: "",
        possibleProxyHeader: "",
        get suggestedProxyHeaders() {
            if (!proxyInfo.possibleProxyHeader) {
                return commonProxyHeaders;
            }

            return [proxyInfo.possibleProxyHeader].concat(
                commonProxyHeaders.filter((h) => h != proxyInfo.possibleProxyHeader),
            );
        },
        get isEnabled() {
            return !app.utils.isEmpty(pageData.formSettings.trustedProxy?.headers);
        },
    });

    async function loadProxyInfo() {
        proxyInfo.isLoading = true;

        try {
            const health = await app.pb.health.check({ requestKey: "loadProxyInfo" });

            proxyInfo.realIP = health.data?.realIP || "";
            proxyInfo.possibleProxyHeader = health.data?.possibleProxyHeader || "";
            proxyInfo.isLoading = false;
        } catch (err) {
            if (!err.isAbort) {
                app.checkApiError(err);
                proxyInfo.isLoading = false;
            }
        }
    }

    return t.details(
        {
            pbEvent: "trustedProxyAccordion",
            className: "accordion trusted-proxy-accordion",
            name: "settingsAccordion",
            onmount: (el) => {
                el._infoWatcher?.unwatch();
                el._infoWatcher = watch(() => JSON.stringify(app.store.settings?.trustedProxy), (newHash, oldHash) => {
                    if (newHash != oldHash) {
                        loadProxyInfo();
                    }
                });
            },
            onunmount: (el) => {
                el._infoWatcher?.unwatch();
            },
        },
        t.summary(
            null,
            t.i({ className: "ri-route-line", ariaHidden: true }),
            t.span({ className: "txt" }, "شناسایی آی پی واقعی کاربر"),
            () => {
                if (proxyInfo.isLoading) {
                    return t.span({ className: "loader sm" });
                }

                if (!proxyInfo.isEnabled && proxyInfo.possibleProxyHeader) {
                    return t.i({
                        className: "ri-alert-line txt-warning",
                        ariaDescription: app.attrs.tooltip(
                            "Detected proxy header.\nIt is recommend to list it as trusted.",
                            "right",
                        ),
                    });
                }

                if (
                    proxyInfo.isEnabled
                    && proxyInfo.possibleProxyHeader
                    && !pageData.formSettings.trustedProxy.headers.includes(proxyInfo.possibleProxyHeader)
                ) {
                    return t.i({
                        className: "ri-alert-line txt-hint",
                        ariaDescription: app.attrs.tooltip(
                            "The configured proxy header doesn't match with the detected one.",
                            "right",
                        ),
                    });
                }
            },
            t.div({ className: "flex-fill" }),
            () => {
                if (proxyInfo.isEnabled) {
                    return t.span({ className: "label success" }, "Enabled");
                }
                return t.span({ className: "label" }, "Disabled");
            },
            () => {
                if (!app.utils.isEmpty(app.store.errors?.trustedProxy)) {
                    return t.i({
                        className: "ri-error-warning-fill txt-danger",
                        ariaDescription: app.attrs.tooltip("Has errors", "left"),
                    });
                }
            },
        ),
        t.p(
            { className: "m-t-0" },
            "در زیر باید آی پی واقعی خود را ببینید. اگر اینطور نیست - هدر پروکسی صحیح را برای محیط خود پیکربندی کنید.",
        ),
        t.div(
            { className: "alert info m-b-sm" },
            t.div(
                { className: "flex gap-5" },
                t.span(null, "آی پی اصلاح شده کاربر:"),
                t.strong(null, () => proxyInfo.isLoading ? "..." : (proxyInfo.realIP || "N/A")),
            ),
            t.div(
                { className: "flex gap-5" },
                t.span(null, "هدر پروکسی شناسایی شده:"),
                t.strong(null, () => proxyInfo.isLoading ? "..." : (proxyInfo.possibleProxyHeader || "N/A")),
            ),
        ),
        t.div(
            { className: "content m-b-sm" },
            t.p(
                null,
                `
                وقتی پاکت بیس روی پلتفرم‌هایی مانند فلای مستقر می‌شود یا از طریق پروکسی‌هایی مانند انجین ایکس قابل دسترسی است، درخواست‌های کاربران مختلف از یک آدرس آی پی  یکسان ارسال می‌شوند.
            `,
            ),
            t.p(
                null,
                `
                در این حالت، برای بازیابی آی پی واقعی کاربر (که برای محدود کردن سرعت، ثبت وقایع و غیره استفاده می‌شود)، باید پروکسی خود را به درستی پیکربندی کنید و هدرهای معتبری را که پاکت بیس می‌تواند برای استخراج آی پی کاربر استفاده کند، در زیر فهرست کنید.
            `,
            ),
            t.p({ className: "txt-bold" }, `هنگام استفاده از چنین پروکسی، برای جلوگیری از جعل، توصیه می‌شود::`),
            t.ul(
                { className: "txt-bold" },
                t.li(
                    null,
                    "از هدرهایی استفاده کنید که فقط توسط پروکسی کنترل می‌شوند و کاربران نمی‌توانند به صورت دستی آنها را تنظیم کنند.",
                ),
                t.li(null, "مطمئن شوید که دسترسی به سرور پاکت بیس فقط از طریق پروکسی امکان‌پذیر است."),
            ),
            t.p(null, "اگر پاکت بیس پشت یک پروکسی مستقر نشده باشد، می‌توانید فیلد هدرها را پاک کنید."),
        ),
        t.div(
            { className: "grid sm" },
            t.div(
                { className: "col-lg-9" },
                t.div(
                    { className: "fields" },
                    t.div(
                        { className: "field" },
                        t.label({ htmlFor: "trustedProxy.headers" }, "هدرهای پروکسی آی پی قابل اعتماد"),
                        t.input({
                            type: "text",
                            id: "trustedProxy.headers",
                            name: "trustedProxy.headers",
                            placeholder: "برای غیرفعال کردن خالی بگذارید",
                            value: () => app.utils.joinNonEmpty(pageData.formSettings.trustedProxy.headers),
                            oninput: (e) => {
                                const newValue = app.utils.splitNonEmpty(e.target.value, ",");
                                const newStr = app.utils.joinNonEmpty(newValue);
                                const oldStr = app.utils.joinNonEmpty(pageData.formSettings.trustedProxy.headers);

                                // has an actual change
                                if (oldStr != newStr) {
                                    pageData.formSettings.trustedProxy.headers = newValue;
                                }
                            },
                        }),
                    ),
                    t.div(
                        { className: "field addon" },
                        t.button(
                            {
                                type: "button",
                                className: () =>
                                    `btn sm secondary transparent ${
                                        app.utils.isEmpty(pageData.formSettings.trustedProxy.headers) ? "hidden" : ""
                                    }`,
                                onclick: () => {
                                    pageData.formSettings.trustedProxy.headers = [];
                                },
                            },
                            t.span({ className: "txt" }, "پاک کردن"),
                        ),
                    ),
                ),
                t.div(
                    { className: "field-help" },
                    "فهرست سرتیترها که با کاما از هم جدا شده‌اند، مانند: ",
                    t.div({ className: "inline-flex gap-5" }, () => {
                        return proxyInfo.suggestedProxyHeaders.map((header) => {
                            return t.div({
                                role: "button",
                                className: "label sm link-primary",
                                onclick: () => {
                                    pageData.formSettings.trustedProxy.headers = [header];
                                },
                                textContent: header,
                            });
                        });
                    }),
                ),
            ),
            t.div(
                { className: "col-lg-3" },
                t.div(
                    { className: "field" },
                    t.label(
                        { htmlFor: "trustedProxy.useLeftmostIP" },
                        t.span({ className: "txt" }, "اولویت آی‌پی"),
                        t.i({
                            className: "ri-information-line tooltip-right",
                            ariaDescription: app.attrs.tooltip(
                                "این در صورتی است که پروکسی بیش از یک آی پی را به عنوان مقدار هدر برگرداند. معمولاً آی پی سمت راست قابل اعتمادتر در نظر گرفته می‌شود، اما این می‌تواند بسته به پروکسی متفاوت باشد.",
                            ),
                        }),
                    ),
                    app.components.select({
                        id: "trustedProxy.useLeftmostIP",
                        name: "trustedProxy.useLeftmostIP",
                        options: ipOptions,
                        required: true,
                        value: () => pageData.formSettings.trustedProxy.useLeftmostIP || false,
                        onchange: (selected) => {
                            pageData.formSettings.trustedProxy.useLeftmostIP = selected?.[0]?.value;
                        },
                    }),
                ),
            ),
        ),
    );
}
