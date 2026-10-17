/**
 * MINUR UPDATE — Google Forms submit trigger template.
 *
 * This sends a minimal event to the authenticated application webhook.
 * It does not send FCM directly and never includes form answers or respondent
 * identifiers in the notification payload.
 *
 * Setup:
 * 1. Add this to the Apps Script project linked to the target Google Form.
 * 2. Set Script Properties:
 *    MINUR_PUSH_WEBHOOK_URL = exact deployed webhook URL supplied by the app owner
 *    MINUR_PUSH_WEBHOOK_SECRET = same high-entropy secret configured in Cloudflare
 * 3. Add an installable trigger for onMinurFormSubmit, event source "From form",
 *    event type "On form submit".
 */
function onMinurFormSubmit(e) {
  if (!e || !e.response) {
    throw new Error("Missing form-submit event. Use an installable Google Form trigger.");
  }

  var properties = PropertiesService.getScriptProperties();
  var webhookUrl = properties.getProperty("MINUR_PUSH_WEBHOOK_URL");
  var secret = properties.getProperty("MINUR_PUSH_WEBHOOK_SECRET");

  if (!webhookUrl || !secret) {
    throw new Error("MINUR webhook Script Properties are not configured.");
  }
  if (!/^https:\/\//i.test(webhookUrl)) {
    throw new Error("Webhook URL must use HTTPS.");
  }

  // Form response ID is an opaque event identifier for idempotency only.
  // It is not sent as a respondent detail to the push notification.
  var responseId = String(e.response.getId() || "");
  if (!responseId) {
    throw new Error("Google Forms did not provide a response ID.");
  }

  var payload = {
    eventId: "google-forms-" + responseId,
    source: "google_forms",
    title: "Responden baru",
    body: "Respons kuesioner utama telah diterima.",
    path: "/dashboard.html"
  };

  var response = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Minur-Webhook-Secret": secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    // Do not log the secret, respondent answers, or raw response body.
    throw new Error("MINUR notification webhook failed with HTTP " + status + ".");
  }
}
