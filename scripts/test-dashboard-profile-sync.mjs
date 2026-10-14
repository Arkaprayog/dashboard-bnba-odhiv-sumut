import { readFileSync, statSync } from "node:fs";
import assert from "node:assert/strict";

const dashboard = readFileSync("public/index.html", "utf8");
const offlinePage = readFileSync("android-app/app/src/main/assets/offline.html", "utf8");
const suratLainnya = readFileSync("public/surat-lainnya.html", "utf8");
const suratTugas = readFileSync("public/surat-tugas.html", "utf8");
const teamManager = readFileSync("public/kelola-tim.html", "utf8");
const staffRoster = readFileSync("public/daftar-petugas.html", "utf8");
const worker = readFileSync("src/index.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const gradle = readFileSync("android-app/app/build.gradle", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/build-android-apk.yml", "utf8");
const debugWorkflow = readFileSync(".github/workflows/build-android-debug.yml", "utf8");
const androidReadme = readFileSync("android-app/README.md", "utf8");
const rootReadme = readFileSync("README.md", "utf8");
const deployWorkflow = readFileSync(".github/workflows/validate-deploy.yml", "utf8");

assert.match(suratLainnya, /\.letter-date-line\{display:block;width:100%;margin:0 0 12px;text-align:right/);
assert.ok(suratLainnya.indexOf('id="previewDate"') < suratLainnya.indexOf('class="letter-meta"'), "formal date line must precede letter metadata");
assert.match(suratLainnya, /@media print\{[\s\S]*?\.letter-date-line\{width:100%;text-align:right/);
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
assert.equal(pkg.version, "1.1.26");
assert.match(gradle, /versionCode 19/);
assert.match(gradle, /versionName '1\.2\.15'/);
assert.match(changelog, /^## 1\.1\.18/m);
assert.ok(dashboard.includes("Versi " + pkg.version), "dashboard display version must match package.json");
assert.match(dashboard, /href="\/surat-tugas\.html">Buka &amp; Edit Surat Tugas/);
assert.match(suratTugas, /SURAT TUGAS/);
assert.match(suratTugas, /class="letterhead"/);
assert.match(suratTugas, /class="date-line editable"/);
assert.doesNotMatch(suratTugas, /barcode|qr-code|QR code|BSrE|BSSN|signature-qr/i, "Surat Tugas must not contain a barcode/QR or unsupported electronic-signature statement");
assert.match(suratTugas, /contenteditable="true"/);
assert.match(suratTugas, /\.date-line\{text-align:right/);
assert.match(suratTugas, /@page\{size:A4 portrait;margin:0\}/);
assert.match(suratTugas, /window\.print\(\)/);
assert.ok(changelog.startsWith("## " + pkg.version), "changelog must begin with the current web package version");
assert.ok(readFileSync(".github/workflows/validate-deploy.yml", "utf8").includes("typeof packageJson.version === 'string'"), "CI must compare release version dynamically");
assert.ok(releaseWorkflow.includes("Sahabat-ODHIV-Sumut-APK-release-v1.2.16"), "release APK artifact must use the current Android version");
assert.ok(debugWorkflow.includes("Sahabat-ODHIV-Sumut-APK-debug-v1.2.16"), "debug APK artifact must use the current Android version");
assert.ok(androidReadme.includes("Android package version: **1.2.16** (`versionCode 19`)"), "Android README must match Gradle version");
assert.ok(androidReadme.includes("web version **1.1.25**"), "Android README must state current web version");
assert.ok(rootReadme.includes("release version `1.2.16` (version code `19`)"), "root README must match Android release version");
assert.ok(rootReadme.includes("Sahabat-ODHIV-Sumut-APK-release-v1.2.16"), "root README artifact link name must match release workflow");
assert.ok(dashboard.includes('id="owner-controls-glass-theme-v1-1-18"'), "dashboard glass stylesheet must exist");
assert.ok(dashboard.includes(':is(#notificationBellButton,#settingsButton,#logoutButton)'), "header actions must be circular glass controls");
assert.ok(dashboard.includes("#editOwnerProfile"), "edit-profile pill style must be present");
assert.ok(teamManager.includes('id="admin-glass-theme-v1-1-18"'), "team manager glass stylesheet must exist");
assert.ok(staffRoster.includes('id="staff-roster-glass-theme-v1-1-18"'), "staff roster glass stylesheet must exist");
assert.ok(staffRoster.includes("staff=(teamData.items||[]).filter(person=>Number(person.active)===1);"), "inactive staff must not enter profiles, selections, or achievement totals");
assert.ok(staffRoster.includes("Petugas aktif"), "roster metric must count only active staff");

const themedPages = [
  "public/index.html", "public/kelola-tim.html", "public/daftar-petugas.html",
  "public/tim-petugas.html", "public/tim-pendataan.html", "public/kuesioner.html",
  "public/kuisioner-responden.html", "public/drive-setup.html",
  "public/surat-lainnya.html", "public/surat-tugas.html"
];
for (const path of themedPages) {
  const html = readFileSync(path, "utf8");
  assert.ok(html.includes('id="sahabat-global-glass-v1-1-26"'), path + " must use the global white-font glass theme");
  assert.ok(html.includes("/dashboard-background.webp?v=1.1.26"), path + " must use the supplied hill photo");
}
const hillBackground = readFileSync("public/dashboard-background.webp");
assert.equal(hillBackground.toString("ascii", 0, 4), "RIFF", "dashboard photo must be a WebP/RIFF asset");
assert.equal(hillBackground.toString("ascii", 8, 12), "WEBP", "dashboard photo must be a valid WebP asset");
assert.ok(statSync("public/dashboard-background.webp").size > 4000, "dashboard background must not be an empty placeholder");
assert.ok(dashboard.includes("Versi " + pkg.version), "web version must match package version");
assert.ok(offlinePage.includes('id="sahabat-offline-glass-v1-1-26"'), "native offline screen must use transparent glass styling");
assert.ok(offlinePage.includes("data:image/webp;base64,"), "native offline screen must embed the supplied hill background for offline use");
assert.ok(offlinePage.includes("body,body *{color:#fff!important"), "native offline screen text must be white");
assert.ok(offlinePage.includes("blur(18px) saturate(125%)"), "native offline surfaces must use transparent glassmorphism");
assert.ok(dashboard.includes("blur(18px) saturate(125%)"), "web UI surfaces must use transparent glassmorphism");
assert.ok(dashboard.includes("background-color:rgba(255,255,255,.075)!important"), "glass panels must remain highly transparent");

console.log("PASS global glass theme, hill background, owner profile sync, CI version gate, Android artifacts, and release documentation are synchronized");
