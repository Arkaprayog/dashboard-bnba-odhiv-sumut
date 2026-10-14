import fs from "node:fs";

const worker = fs.readFileSync("src/index.ts", "utf8");
const backupWorkflow = fs.readFileSync(".github/workflows/drive-backup.yml", "utf8");

const checks = [
  [
    "backup requires an explicit Shared Drive folder ID and does not fall back to a legacy My Drive folder",
    worker.includes("const folderId = env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;") &&
      !worker.includes('env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || await getDriveSetting(env, "drive_folder_backups")'),
  ],
  [
    "backup preflight endpoint is protected by DRIVE_BACKUP_TOKEN",
    worker.includes('url.pathname === "/api/drive/backup/status"') &&
      worker.includes("DRIVE_BACKUP_FOLDER_MISSING") &&
      worker.includes("DRIVE_BACKUP_TOKEN"),
  ],
  [
    "preflight and upload validate active writable Shared Drive folders",
    worker.includes('folder.mimeType !== "application/vnd.google-apps.folder" || !folder.driveId || folder.trashed || folder.capabilities?.canAddChildren !== true'),
  ],
  [
    "Drive upload enables Shared Drive support",
    worker.includes("uploadType=multipart&supportsAllDrives=true"),
  ],
  [
    "source archive excludes credentials, local databases, and respondent data",
    backupWorkflow.includes(":(exclude,glob)**/*.pem") &&
      backupWorkflow.includes(":(exclude,glob)**/*service-account*.json") &&
      backupWorkflow.includes(":(exclude,glob)**/*.sqlite") &&
      backupWorkflow.includes(":(exclude,glob)**/respondent-data/**") &&
      backupWorkflow.includes(":(exclude,glob)**/uploads/**"),
  ],
  [
    "weekly schedule and manual run remain enabled",
    backupWorkflow.includes("workflow_dispatch:") &&
      backupWorkflow.includes('cron: "17 3 * * 1"'),
  ],
  [
    "recovery artifact is uploaded before Drive preflight and retained 30 days",
    backupWorkflow.includes("actions/upload-artifact@v4") &&
      backupWorkflow.includes("retention-days: 30") &&
      backupWorkflow.indexOf("Keep a recovery copy in GitHub Actions") <
        backupWorkflow.indexOf("Verify writable Google Shared Drive destination") &&
      backupWorkflow.indexOf("Verify writable Google Shared Drive destination") <
        backupWorkflow.indexOf("Upload to private Drive backup folder"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS all ${checks.length} Google Drive backup contract checks`);
