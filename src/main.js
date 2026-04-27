import { main } from "./plugin";
const applyAppVersion = () => {
    window.__setAppVersion?.(__APP_VERSION__);
    window.__setBuildStamp?.(__BUILD_STAMP__);
};
applyAppVersion();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAppVersion, { once: true });
}
else {
    queueMicrotask(applyAppVersion);
}
void main();
