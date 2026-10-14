import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const dashboard = readFileSync("public/index.html", "utf8");
const worker = readFileSync("src/index.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const gradle = readFileSync("android-app/app/build.gradle", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/build-android-apk.yml", "utf8");
const debugWorkflow = readFileSync(".github/workflows/build-android-debug.yml", "utf8");
const androidReadme = readFileSync("android-app/README.md", "utf8");
const rootReadme = readFileSync("README.md", "utf8");
const deployWorkflow = readFileSync(".github/workflows/validate-deploy.yml", "utf8");

assert.match(dashboard, /dashboard-sky-glass-unified-v2/);
assert.match(dashboard, /--dashboard-sky-blue:#87CEEB/);
assert.match(dashboard, /backdrop-filter:blur\(18px\)/);
assert.match(dashboard, /textContent=safeText\(profile\.institution\)\|\|'Unit kerja belum diisi'/);
assert.match(dashboard, /id="notificationBellButton"/);
assert.match(dashboard, /id="settingsButton"/);
assert.match(dashboard, /id="logoutButton"/);
assert.match(dashboard, /aria-label="Keluar"/);
assert.match(worker, /UPDATE admins SET display_name=\? WHERE id=\? AND role='owner' AND active=1/);
assert.match(worker, /owner_profile_update/);
assert.equal(pkg.version, "1.1.17");
assert.match(gradle, /versionCode 10/);
assert.match(gradle, /versionName '1\.2\.7'/);
assert.match(changelog, /^## 1\.1\.17/m);
console.log("PASS dashboard glass theme, profile synchronization, icon controls, and web/Android release version alignment");
