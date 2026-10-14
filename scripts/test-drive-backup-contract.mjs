import fs from "node:fs";

const backupWorkflow = fs.readFileSync(".github/workflows/drive-backup.yml", "utf8");

const checks = [
  [
    "weekly schedule and manual backup run remain enabled",
    backupWorkflow.includes("workflow_dispatch:") &&
      backupWorkflow.includes('cron: "17 3 * * 1"'),
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
    "GitHub recovery artifact is retained for 30 days before R2 upload",
    backupWorkflow.includes("actions/upload-artifact@v4") &&
      backupWorkflow.includes("retention-days: 30") &&
      backupWorkflow.indexOf("Keep a recovery copy in GitHub Actions") <
        backupWorkflow.indexOf("Upload private archive to Cloudflare R2"),
  ],
  [
    "R2 credentials are read only from GitHub Actions secrets",
    backupWorkflow.includes("secrets.R2_ACCOUNT_ID") &&
      backupWorkflow.includes("secrets.R2_ACCESS_KEY_ID") &&
      backupWorkflow.includes("secrets.R2_SECRET_ACCESS_KEY"),
  ],
  [
    "upload targets the intended private R2 bucket using the S3-compatible endpoint",
    backupWorkflow.includes("sahabatodhiv-sumut-backups") &&
      backupWorkflow.includes("r2.cloudflarestorage.com") &&
      backupWorkflow.includes("aws --endpoint-url"),
  ],
  [
    "archive is limited to 20 MiB and uploaded as gzip",
    backupWorkflow.includes("20971520") &&
      backupWorkflow.includes("--content-type application/gzip"),
  ],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS all ${checks.length} Cloudflare R2 backup contract checks`);
