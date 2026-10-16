import { readFileSync, statSync } from "node:fs";
import assert from "node:assert/strict";

const dashboard = readFileSync("public/index.html", "utf8");
const transparentCss = readFileSync("public/transparent-theme.css", "utf8");
const headerActionCss = readFileSync("public/action-buttons-horizontal-v1.css", "utf8");
assert.match(dashboard, /class="owner-header-actions action-bar-container"/);
assert.match(dashboard, /class="top-actions action-buttons-group"/);
assert.match(dashboard, /id="notificationBellButton"[^>]*class="bell-button glass-icon-btn"|class="bell-button glass-icon-btn"[^>]*id="notificationBellButton"/);
assert.match(dashboard, /id="settingsButton"[^>]*class="settings-button glass-icon-btn"|class="settings-button glass-icon-btn"[^>]*id="settingsButton"/);
assert.match(dashboard, /id="logoutButton"[^>]*class="dashbtn glass-icon-btn"|class="dashbtn glass-icon-btn"[^>]*id="logoutButton"/);
assert.match(headerActionCss, /flex-direction:\s*row\s*!important/);
assert.match(headerActionCss, /justify-content:\s*flex-end\s*!important/);

const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
const offlinePage = readFileSync("android-app/app/src/main/assets/offline.html", "utf8");
const suratLainnya = readFileSync("public/surat-lainnya.html", "utf8");
const suratLainnyaCss = readFileSync("public/surat-lainnya-layout.css", "utf8");
const suratTugas = readFileSync("public/surat-tugas.html", "utf8");
const suratTugasCss = readFileSync("public/surat-tugas-layout.css", "utf8");
const dashboardCss = readFileSync("public/app-layout.css", "utf8");
const assessmentPrintCss = readFileSync("public/assessment-print-10-pages-v1.css", "utf8");
const assessmentGlassCss = readFileSync("public/assessment-glass-layout-v1.css", "utf8");
const teamManager = readFileSync("public/kelola-tim.html", "utf8");
assert.ok(teamManager.includes('id="password"') && teamManager.includes("password:document.getElementById"), "owner must set the initial team password at registration.");
assert.ok(teamManager.includes("Pendamping Sebaya") && teamManager.includes("PENJANGKAU LAPANGAN"), "team registration must expose the two requested job choices.");
const teamWorkspace = readFileSync("public/tim-pendataan.html", "utf8");
assert.ok(teamWorkspace.includes("loginPhone") && teamWorkspace.includes("loginPassword") && teamWorkspace.includes("credentials=linkToken?{token:linkToken,name}:{phone,password}"), "team workspace must support invite onboarding and recurring phone/password login.");
const workerSource = readFileSync("src/index.ts", "utf8");
assert.ok(workerSource.includes("passwordHash(password, passwordSalt)") && workerSource.includes("password_hash,password_salt"), "team passwords must be salted and hashed server-side.");
assert.ok(dashboard.includes('id="questionnaireHubView"') && dashboard.includes('id="teamQuestionnaireView"') && dashboard.includes('id="stage1DataView"'), "questionnaire menu must contain owner, team work, and combined stage 1 views.");
assert.ok(dashboard.includes("KUISIONER OWNER") && dashboard.includes("KUISIONER TIM KERJA") && dashboard.includes("DATA KUISIONER THP 1"), "all three questionnaire menu choices must be present.");
assert.ok(dashboard.includes('id="ownerQuestionnaireForm"') && workerSource.includes('url.pathname === "/api/owner-questionnaire"'), "the existing owner questionnaire form and API must remain.");
assert.ok(workerSource.includes('url.pathname === "/api/questionnaires/stage1"') && workerSource.includes("'Kuisioner Owner'!A1:O2000"), "stage 1 data API must read the shared owner/team response sheet.");
assert.ok(workerSource.includes("Tautan pendaftaran ini sudah digunakan") && workerSource.includes("profile_completed=1,token_hash=?"), "team onboarding link must become unusable after successful profile registration.");
assert.ok(workerSource.includes("UPDATE team_sessions SET revoked_at=? WHERE petugas_id=? AND revoked_at IS NULL") && workerSource.includes("team_session=; Path=/"), "successful onboarding must revoke sessions and clear the onboarding cookie.");
assert.ok(workerSource.includes("team_login_attempts") && workerSource.includes("attemptNow - 900") && workerSource.includes("Terlalu banyak percobaan login"), "team login attempts must be rate-limited.");
assert.ok(workerSource.includes('url.pathname === "/api/team-petugas/password"') && workerSource.includes("team_petugas_password_reset"), "owner/admin must be able to reset passwords for existing team members.");
assert.ok(teamManager.includes('id="teamPasswordDialog"') && teamManager.includes("/api/team-petugas/password"), "team manager must provide a protected password reset dialog.");
assert.ok(dashboard.includes("Kelola Tim Petugas / Atur Kata Sandi") && dashboard.includes("dashboardTeamForm"), "owner can add team members from questionnaire menu and open legacy account management.");

assert.ok(teamWorkspace.includes('name="namaAnggota"') && teamWorkspace.includes('name="jabatan"') && teamWorkspace.includes('name="nomorHpWa"') && teamWorkspace.includes("Silakan login ke akun Anda"), "team registration collects the profile fields and prompts login after save.");
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

assert.match(suratLainnyaCss, /\.letter-date-line\{display:block;width:100%;margin:0 0 12px;text-align:right/);
assert.ok(suratLainnya.indexOf('id="previewDate"') < suratLainnya.indexOf('class="letter-meta"'), "formal date line must precede letter metadata");
assert.match(suratLainnyaCss, /@media print\{[\s\S]*?\.letter-date-line\{width:100%;text-align:right/);
assert.match(dashboard, /textContent=safeText\(profile\.institution\)\|\|'Unit kerja belum diisi'/);
assert.match(dashboard, /id="notificationBellButton"/);

const mainNavMarkup = dashboard.match(/<nav class="app-nav" id="appNavigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
const mainMenu = [...mainNavMarkup.matchAll(/data-view="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map((match) => [match[1], match[2].trim()]);
assert.deepEqual(mainMenu, [
  ["home", "BERANDA"],
  ["database", "DATABASE PPKS"],
  ["assessmentSaved", "DATA ASESMEN PPKS"],
  ["assessment", "FROM ASESMEN TERINTEGRASI"],
  ["questionnaireHub", "KUISIONER"],
  ["respondentQuiz", "KUISIONER RESPONDEN"],
  ["formats", "DOKUMEN"],
], "main menu items, labels, capitalization, and order must match the requested sequence");
assert.ok(!dashboard.includes("assessmentNavGroup") && !dashboard.includes("assessmentNavToggle") && !dashboard.includes("assessmentSubmenu"), "the old assessment parent submenu must be removed");
assert.ok(dashboard.includes('id="rabNavToggle"') && dashboard.includes('id="rabHomeChoices" hidden'), "RAB choices must be a collapsed panel inside the home view.");
assert.ok(!dashboard.includes('id="rabSubmenu"') && !dashboard.includes('class="rab-nav-group'), "RAB choices must not appear as a nested navigation submenu.");
assert.ok(dashboard.includes("RANCANGAN ANGGARAN BELANJA") && dashboard.includes("RAB NUTRISI") && dashboard.includes("RAB KEWIRAUSAHAAN"), "RAB home panel and both choice cards must exist.");
assert.ok(dashboard.includes("closeRabHomeChoices()") && dashboard.includes("setAppView('home')") && dashboard.includes("data-rab-view"), "RAB choice cards appear in home and close when a different navigation item is selected.");
assert.ok(dashboardCss.includes(".rab-home-choices .rab-choice-grid") && dashboardCss.includes("grid-template-columns:minmax(0,1fr)"), "RAB cards use responsive document-style card layout.");
assert.ok(dashboard.includes("button.hidden=!['owner','admin'].includes(currentDashboardRole)"), "assessment main buttons remain restricted to owner/admin");
assert.ok(dashboard.includes("assessment-delete-btn") && dashboard.includes("'Hapus asesmen'") && dashboard.includes("window.confirm('Hapus '"), "saved assessment cards offer a confirmation-protected delete action");
assert.ok(dashboard.includes("method:'DELETE'") && dashboard.includes("'X-CSRF-Token':csrfToken"), "assessment delete request uses CSRF protection");
assert.ok(worker.includes('request.method === "DELETE" && !isAllowedOrigin(request, env)') && worker.includes('DELETE FROM integrated_assessments WHERE id=?') && worker.includes('"assessment_deleted"'), "assessment deletion is origin-checked, audited, and scoped to the selected record");
assert.ok(worker.includes('if (!csrf || csrf !== admin.csrf_token)') && worker.includes('admin.role !== "owner" && admin.role !== "admin"'), "assessment deletion requires a valid privileged session and CSRF token");

const floatingMenuCss = readFileSync("public/single-layer-floating-dashboard-v1.css", "utf8");
assert.match(floatingMenuCss, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, "wide layout must use four menu columns");
assert.match(floatingMenuCss, /text-transform:uppercase/, "all main menu buttons must use uppercase styling");
assert.match(floatingMenuCss, /border:1\.5px solid #7dd3fc/, "main menu buttons must have sky-blue outlines");


assert.ok(dashboard.includes("function assessmentDataUrlToBytes(dataUrl)"), "PDF builder must decode image data URLs without fetch() so CSP connect-src does not block them.");
assert.ok(!dashboard.includes("fetch(saved.dataUrl)"), "PDF builder must not fetch data: URLs.");
assert.ok(dashboard.includes("assessmentDataUrlToBytes(saved.dataUrl)"), "PDF builder must embed photo bytes directly from the local data URL.");
assert.ok(dashboard.includes('href="/single-layer-floating-dashboard-v1.css?v=1.1.57"'), "single-layer dashboard stylesheet must be linked.");
assert.ok(!dashboard.includes('">\\n  <link rel="stylesheet" href="/single-layer-floating-dashboard-v1.css'), "stylesheet tags must use a real newline, not a literal backslash-n.");
assert.match(dashboard, /id="settingsButton"/);
assert.match(dashboard, /id="logoutButton"/);
assert.match(dashboard, /aria-label="Keluar"/);
assert.match(worker, /UPDATE admins SET display_name=\? WHERE id=\? AND role='owner' AND active=1/);
assert.match(worker, /owner_profile_update/);
assert.equal(pkg.version, "1.1.59");
assert.equal(manifest.version, pkg.version, "PWA manifest version must match the web package version.");
assert.ok(dashboard.includes('href="/assessment-print-10-pages-v1.css?v=1.1.46"'), "assessment must load the dedicated ten-page print stylesheet.");
assert.ok(dashboard.includes('pageIndexForQuestion') && dashboard.includes('assessment-print-page'), "assessment fields must be partitioned into six print pages.");
assert.ok(dashboard.includes('HALAMAN 7 — LAMPIRAN FOTO DIRI (CLOSE-UP PPKS)') && dashboard.includes('HALAMAN 8 — LAMPIRAN FOTO KTP') && dashboard.includes('HALAMAN 9 — LAMPIRAN FOTO KARTU KELUARGA (KK)') && dashboard.includes('HALAMAN 10 — LAMPIRAN FOTO RUMAH TAMPAK DEPAN'), "all four photo appendices must be generated in the required order.");
assert.ok(dashboard.includes('href="/assessment-glass-layout-v1.css?v=1.1.52"'), "latest glass layout stylesheet must be loaded after legacy styles.");
assert.ok(dashboard.includes('id="assessmentClearForm"') && dashboard.includes("Kosongkan Lembar Asesmen"), "assessment view must provide a full-width clear-sheet action.");
assert.ok(dashboard.includes('data-photo-preview="assessmentPhotoSelf"') && dashboard.includes('data-photo-preview="assessmentPhotoKtp"') && dashboard.includes('data-photo-preview="assessmentPhotoKk"') && dashboard.includes('data-photo-preview="assessmentPhotoHome"'), "four PPKS photo cards must have distinct auto-populated preview slots.");
assert.doesNotMatch(dashboard, /<input\s+type="file"[^>]*id="assessmentPhoto(?:Self|Ktp|Kk|Home)"/, "manual file inputs for assessment photos must be removed.");
assert.ok(dashboard.includes("respondentSelect?.addEventListener('change'") && dashboard.includes("loadSelectedAssessmentRespondent();") && dashboard.includes("fetch('/api/respondent-photo?id='"), "selecting a respondent automatically retrieves photos through the private same-origin endpoint.");
assert.ok(dashboard.includes("clearAssessmentForm({clearSelection:false,showMessage:false})") && dashboard.includes("Asesmen yang sudah tersimpan di Data Asesmen PPKS tidak dihapus"), "clearing the worksheet does not delete saved assessment records.");
assert.ok(assessmentGlassCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "photo cards must use a two-column layout.");
assert.ok(assessmentGlassCss.includes("aspect-ratio:1/1!important"), "assessment photo cards must stay square.");
assert.ok(assessmentGlassCss.includes("width:min(100%,190px)!important"), "photo cards must have a fixed maximum size and still fit small screens.");
assert.ok(assessmentGlassCss.includes("grid-auto-rows:max-content!important") && assessmentGlassCss.includes("align-items:start!important"), "photo card grid must stop stretching cards vertically.");
assert.ok(assessmentGlassCss.includes("max-height:190px!important"), "photo card height must remain bounded.");

assert.ok(assessmentGlassCss.includes("backdrop-filter:blur(18px)"), "photo cards must use translucent glass blur.");

assert.ok(assessmentPrintCss.includes('size:A4 portrait') && assessmentPrintCss.includes('page-break-before:always') && assessmentPrintCss.includes('assessment-print-photo-page'), "print stylesheet must force A4 page breaks for the four appendices.");
assert.ok(dashboard.includes('Data Base Kemensos RI DRSKPNO'), "login copyright must use the requested institution text.");

assert.ok(dashboard.includes('href="/app-layout.css?v=2.0.6"') && dashboard.includes('href="/transparent-theme.css?v=2.0.0"') && !dashboard.includes("style.css?v=") && !dashboard.includes("login.css?v="), "dashboard must load only the centralized stylesheets.");
assert.ok(transparentCss.includes("--sahabat-glass-blur:16px") && transparentCss.includes("--sahabat-glass-bg:rgba(15,23,42,.70)") && transparentCss.includes("color:#fff!important"), "shared theme must use glassmorphism, blur 16px, and white typography.");
assert.match(gradle, /versionCode 31/);
assert.ok(gradle.includes("versionName '1.2.28'"));
assert.match(changelog, /^## 1\.1\.18/m);
assert.ok(dashboard.includes("Versi " + pkg.version), "dashboard display version must match package.json");
assert.match(dashboard, /href="\/surat-tugas\.html">Buka &amp; Edit Surat Tugas/);
assert.match(suratTugas, /SURAT TUGAS/);
assert.match(suratTugas, /class="letterhead"/);
assert.match(suratTugas, /class="date-line editable"/);
assert.doesNotMatch(suratTugas, /barcode|qr-code|QR code|BSrE|BSSN|signature-qr/i, "Surat Tugas must not contain a barcode/QR or unsupported electronic-signature statement");
assert.match(suratTugas, /contenteditable="true"/);
assert.match(suratTugasCss, /\.date-line\{text-align:right/);
assert.match(suratTugasCss, /@page\{size:A4 portrait;margin:0\}/);
assert.match(suratTugas, /window\.print\(\)/);
assert.ok(changelog.startsWith("## " + pkg.version), "changelog must begin with the current web package version");
assert.ok(readFileSync(".github/workflows/validate-deploy.yml", "utf8").includes("typeof packageJson.version === 'string'"), "CI must compare release version dynamically");
assert.ok(releaseWorkflow.includes("Sahabat-ODHIV-Sumut-APK-release-v1.2.28"), "release APK artifact must use the current Android version");
assert.ok(debugWorkflow.includes("Sahabat-ODHIV-Sumut-APK-debug-v1.2.28"), "debug APK artifact must use the current Android version");
assert.ok(androidReadme.includes("Android package version: **1.2.28** (`versionCode 31`)"), "Android README must match Gradle version");
assert.ok(androidReadme.includes("web version **" + pkg.version + "**"), "Android README must state current web version");
assert.ok(rootReadme.includes("release version `1.2.28` (version code `31`)"), "root README must match Android release version");
assert.ok(rootReadme.includes("Sahabat-ODHIV-Sumut-APK-release-v1.2.28"), "root README artifact link name must match release workflow");
assert.ok(dashboard.includes('href="/transparent-theme.css?v=2.0.0"'), "dashboard must load the shared transparent stylesheet.");
assert.match(dashboard, /id="notificationBellButton"/);

assert.match(dashboard, /id="ownerLiveClock"[^>]*role="timer"/, "owner profile must contain a live clock");
assert.match(dashboard, /window\.setInterval\(updateOwnerLiveClock, 1000\)/, "owner clock must update every second");
assert.ok(dashboard.includes('Live ${date} ${time}'), "clock must use Live date and time text");
const ownerCardCss = readFileSync("public/single-layer-floating-dashboard-v1.css", "utf8");
assert.ok(ownerCardCss.includes('body:has(#dashboard:not([hidden])) #dashboard .owner-card{'), "the final owner card rule must match the high-specificity selector that previously overrode the layout.");
assert.ok(ownerCardCss.includes('grid-template-areas:"profile summary actions" ". clock clock"!important'), "profile, summary, and all actions must share the first grid row, with the clock separated beneath.");
assert.ok(ownerCardCss.includes('grid-area:actions!important') && ownerCardCss.includes('position:static!important'), "owner actions must no longer be absolutely positioned or moved to a separate full-width row.");
assert.ok(ownerCardCss.includes('grid-area:clock!important'), "live clock must use its own compact grid row.");
assert.ok(ownerCardCss.lastIndexOf("v1.1.57: final compact owner header override") > ownerCardCss.lastIndexOf("Root-cause correction v1.1.56"), "the compact override must come after the root-cause specificity fix.");
const cleanCardCss = readFileSync("public/dashboard-card-clean-v1.css", "utf8");
assert.match(ownerCardCss, /\.owner-header-actions\{[\s\S]*?margin-left:auto!important/, "owner action group must be pushed to the right");
assert.match(ownerCardCss, /\.owner-live-clock\{[\s\S]*?color:#808000/, "owner live clock must be olive green");
assert.ok(dashboard.includes('href="/dashboard-card-clean-v1.css?v=1.1.49"'), "final card-cleanup stylesheet must be linked with a new cache key");
assert.match(cleanCardCss, /background: transparent !important/);
assert.match(cleanCardCss, /backdrop-filter: none !important/);
assert.match(cleanCardCss, /#notificationBellButton/);
assert.match(cleanCardCss, /#settingsButton/);
assert.match(cleanCardCss, /#logoutButton/);

assert.ok(dashboardCss.includes("#editOwnerProfile"), "edit-profile pill style must be present in extracted layout CSS.");
assert.ok(teamManager.includes('/transparent-theme.css?v=2.0.0'), "team manager must load shared transparent stylesheet.");
assert.ok(staffRoster.includes('/transparent-theme.css?v=2.0.0'), "staff roster must load shared transparent stylesheet.");
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
  assert.ok(html.includes('/transparent-theme.css?v=2.0.0'), path + " must load the current shared glass theme.");
  assert.doesNotMatch(html, /<style\b/i, path + " must not retain inline CSS blocks.");
  const slug = path === "public/index.html" ? "app" : path.split("/").pop().replace(/\.html$/, "");
  const layoutHref = path === "public/index.html" ? '/app-layout.css?v=2.0.6' : path === "public/kuisioner-responden.html" ? '/kuisioner-pilihan.css?v=1.0.0' : '/' + slug + '-layout.css?v=2.0.0';
  assert.ok(html.includes(layoutHref), path + " must load its extracted layout stylesheet.");
}
const hillBackground = readFileSync("public/dashboard-background.webp");
assert.equal(hillBackground.toString("ascii", 0, 4), "RIFF", "dashboard photo must be a WebP/RIFF asset");
assert.equal(hillBackground.toString("ascii", 8, 12), "WEBP", "dashboard photo must be a valid WebP asset");
assert.ok(statSync("public/dashboard-background.webp").size > 4000, "dashboard background must not be an empty placeholder");
assert.ok(dashboard.includes("Versi " + pkg.version), "web version must match package version");
assert.ok(offlinePage.includes('id="sahabat-offline-glass-v1-1-30"') || offlinePage.includes("background-color:rgba(15,23,42,.75)!important"), "native offline screen theme must remain defined");
assert.ok(offlinePage.includes('<meta name="color-scheme" content="dark">'), "native offline screen must force dark UI controls");
assert.ok(offlinePage.includes("background-color:rgba(15,23,42,.75)!important") || offlinePage.includes("background:transparent"), "native offline surfaces must retain explicit surface styling.");
assert.ok(offlinePage.includes("body,body *{color:#fff!important"), "native offline screen text must be white");
assert.ok(offlinePage.includes("backdrop-filter:blur(16px)!important") || offlinePage.includes("background:transparent"), "native offline surfaces must use their configured surface style.");
const respondentChooser = readFileSync("public/kuisioner-responden.html", "utf8");
const integratedRespondentForm = readFileSync("public/kuesioner-mandiri.html", "utf8");
const chooserCss = readFileSync("public/kuisioner-pilihan.css", "utf8");
assert.ok(respondentChooser.includes('/kuisioner-pilihan.css?v=1.0.0'), "respondent chooser must load its responsive chooser stylesheet.");
assert.ok(respondentChooser.includes('href="/kuesioner-mandiri.html"'), "respondent chooser must link to the public integrated form.");
assert.ok(respondentChooser.includes("https://docs.google.com/forms/d/e/1FAIpQLSfugEp7XQ_YmR9PQNEqLjtm-wilOqlUvF7hW_ewSOt_2Y_guw/viewform"), "respondent chooser must preserve the existing Google Forms backup.");
assert.ok(chooserCss.includes(".choice-grid") && chooserCss.includes("@media(max-width:650px)"), "respondent chooser must be responsive.");
assert.ok(!respondentChooser.includes("window.location.replace(destination)") && !respondentChooser.includes("window.setTimeout(finish"), "respondent chooser must never force an automatic redirect.");
assert.ok(integratedRespondentForm.includes('/api/public-questionnaire') && integratedRespondentForm.includes('name="consent"') && integratedRespondentForm.includes('name="website"'), "integrated public form must use the public submission API, explicit consent, and a honeypot.");
assert.ok(!integratedRespondentForm.includes("team-login") && integratedRespondentForm.includes('capture="environment"') && integratedRespondentForm.includes('name="fotoDiri"'), "public form must not require staff login and must retain direct photo capture.");
assert.ok(workerSource.includes('url.pathname === "/api/public-questionnaire"') && workerSource.includes("async function handlePublicQuestionnaire"), "Worker must expose the dedicated public submission route.");
assert.ok(workerSource.includes("public_questionnaire_attempts") && workerSource.includes("sheets_duplicate_check") && workerSource.includes("RESPONDEN MANDIRI"), "public submission must include throttling, duplicate checking, and explicit respondent attribution.");
assert.ok(dashboard.includes('href="/transparent-theme.css?v=2.0.0"'), "dashboard uses the replacement transparent theme.");
assert.ok(transparentCss.includes("--sahabat-glass-bg:rgba(15,23,42,.70)") && transparentCss.includes("backdrop-filter:blur(var(--sahabat-glass-blur))"), "shared UI surfaces must use the centralized glass treatment.");
assert.ok(dashboard.includes("owner-header-actions"), "owner header actions must remain available.");
assert.ok(dashboard.includes('id="settingsButton"') && dashboard.includes('id="logoutButton"'), "settings and logout controls must remain available.");
assert.ok(transparentCss.includes('background-image:url("/danau-toba/photo-1.jpg?v=2.0.0")') && dashboard.includes("/danau-toba/photo-1.jpg?v=1.2.9"), "login background photo and slideshow must remain configured.");
for (const path of themedPages) {
  const html = readFileSync(path, "utf8");
  assert.ok(html.includes("/transparent-theme.css?v=2.0.0"), path + " must load the shared replacement theme.");
}

console.log("PASS global glass theme, hill background, owner profile sync, CI version gate, Android artifacts, and release documentation are synchronized");

assert.ok(workerSource.includes("password.length < 6") && workerSource.includes("kata sandi kurang dari 6 karakter") && !workerSource.includes("password.length < 8"), "team registration, login and password reset must use a six-character minimum.");
assert.ok(teamManager.includes('minlength="6"') && teamManager.includes("password.length<6") && teamManager.includes("minimal 6 karakter"), "team owner registration and reset UI must enforce six characters.");
assert.ok(teamWorkspace.includes('minlength="6"') && teamWorkspace.includes("password.length<6"), "team login form must accept passwords from six characters.");
assert.ok(dashboard.includes('id="dashboardTeamPassword" name="password" type="password" minlength="6"'), "dashboard questionnaire team registration must use six-character minimum.");
