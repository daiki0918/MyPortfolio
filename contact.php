<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;
use Dotenv\Dotenv;
use Dotenv\Exception\InvalidFileException;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['success' => false, 'message' => 'Method not allowed.']);
}

$origin = parse_url($_SERVER['HTTP_ORIGIN'] ?? '', PHP_URL_HOST);
$requestHost = parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
if (is_string($origin) && is_string($requestHost) && strcasecmp($origin, $requestHost) !== 0) {
    respond(403, ['success' => false, 'message' => 'Request rejected.']);
}

$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($contentType !== 'application/json') {
    respond(415, ['success' => false, 'message' => 'Unsupported request format.']);
}

$autoload = __DIR__ . '/vendor/autoload.php';
if (!is_file($autoload)) {
    error_log('Contact form dependencies are missing. Run composer install.');
    respond(503, ['success' => false, 'message' => 'The contact form is temporarily unavailable. Please try again later.']);
}

require $autoload;
try {
    Dotenv::createImmutable(__DIR__)->safeLoad();
} catch (InvalidFileException $exception) {
    error_log('Contact form environment file is invalid: ' . $exception->getMessage());
    respond(503, ['success' => false, 'message' => 'The contact form settings need attention. Please try again later.']);
}

$rawBody = file_get_contents('php://input');
try {
    $data = json_decode($rawBody === false ? '' : $rawBody, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    respond(400, ['success' => false, 'message' => 'Invalid form submission.']);
}

if (!is_array($data)) {
    respond(400, ['success' => false, 'message' => 'Invalid form submission.']);
}

$field = static function (string $key) use ($data): string {
    $value = $data[$key] ?? '';
    return is_string($value) ? trim($value) : '';
};

if ($field('company') !== '') {
    respond(400, ['success' => false, 'message' => 'Unable to submit inquiry.']);
}

$firstName = $field('first_name');
$lastName = $field('last_name');
$email = $field('email');
$service = $field('service');
$message = $field('message');

if (
    $firstName === '' || mb_strlen($firstName) > 80 ||
    $lastName === '' || mb_strlen($lastName) > 80 ||
    strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    mb_strlen($service) > 120 ||
    $message === '' || mb_strlen($message) > 5000
) {
    respond(422, ['success' => false, 'message' => 'Please check your details and try again.']);
}

$firstName = preg_replace('/[\x00-\x1F\x7F]/u', '', $firstName) ?? '';
$lastName = preg_replace('/[\x00-\x1F\x7F]/u', '', $lastName) ?? '';
$service = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $service) ?? '';
$escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

if (!session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'use_strict_mode' => true,
])) {
    error_log('Unable to start a session for contact form rate limiting.');
    respond(503, ['success' => false, 'message' => 'The contact form is temporarily unavailable. Please try again later.']);
}

$now = time();
if (isset($_SESSION['last_contact_submission']) && $now - (int) $_SESSION['last_contact_submission'] < 60) {
    respond(429, ['success' => false, 'message' => 'Please wait a minute before sending another message.']);
}

$smtpHost = $_ENV['SMTP_HOST'] ?? '';
$smtpUsername = $_ENV['SMTP_USERNAME'] ?? '';
$smtpPassword = $_ENV['SMTP_PASSWORD'] ?? '';
$mailTo = $_ENV['MAIL_TO'] ?? '';
$mailFromName = $_ENV['MAIL_FROM_NAME'] ?? 'Portfolio Contact';
$smtpPort = filter_var($_ENV['SMTP_PORT'] ?? '587', FILTER_VALIDATE_INT);
$smtpEncryption = strtolower($_ENV['SMTP_ENCRYPTION'] ?? 'tls');
// Optional: add SITE_URL=https://yourdomain.com to .env to show a "View my work" button in the confirmation email.
$siteUrl = filter_var($_ENV['SITE_URL'] ?? '', FILTER_VALIDATE_URL) ?: '';

if (
    $smtpHost === '' || $smtpUsername === '' || $smtpPassword === '' ||
    !filter_var($smtpUsername, FILTER_VALIDATE_EMAIL) ||
    !filter_var($mailTo, FILTER_VALIDATE_EMAIL) ||
    !$smtpPort || $smtpPort < 1 || $smtpPort > 65535 ||
    !in_array($smtpEncryption, ['tls', 'ssl'], true)
) {
    error_log('Contact form SMTP settings are missing or invalid.');
    respond(503, ['success' => false, 'message' => 'Email is not configured yet. Add a newly generated Google App Password as SMTP_PASSWORD in the server .env file, then try again.']);
}

/* ---------- Email design (table layout + inline CSS so Gmail and Outlook render it) ---------- */
$pill = static fn(string $t): string => '<span style="display:inline-block;padding:7px 14px;border:1px solid #3b4a10;border-radius:999px;background:#18210a;color:#d1fe17;' . "font:bold 11px Arial,sans-serif;" . 'letter-spacing:2px">' . $t . '</span>';
$button = static fn(string $href, string $label): string => '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#d1fe17" style="border-radius:999px"><a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;padding:15px 28px;font:bold 15px Arial,sans-serif;color:#0a0a0a;text-decoration:none;border-radius:999px">' . $label . ' &rarr;</a></td></tr></table>';
$row = static fn(string $label, string $value): string => '<tr><td style="padding:14px 0;border-top:1px solid #26262e;width:96px;font:bold 11px Arial,sans-serif;letter-spacing:1.5px;color:#7d7d89;text-transform:uppercase;vertical-align:top">' . $label . '</td><td style="padding:14px 0;border-top:1px solid #26262e;font:15px/1.5 Arial,sans-serif;color:#f4f4f1">' . $value . '</td></tr>';
$step = static fn(string $n, string $title, string $text): string => '<tr><td width="44" valign="top" style="padding:0 0 18px"><div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:#18210a;border:1px solid #3b4a10;color:#d1fe17;text-align:center;font:bold 13px Arial,sans-serif">' . $n . '</div></td><td valign="top" style="padding:0 0 18px;font:14px/1.55 Arial,sans-serif;color:#9a9aa5"><strong style="color:#f4f4f1;font-size:15px">' . $title . '</strong><br>' . $text . '</td></tr>';
$layout = static fn(string $preheader, string $inner): string =>
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Joshua Sambere</title></head>'
    . '<body style="margin:0;padding:0;background:#07070a">'
    . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#07070a">' . $preheader . '</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07070a" style="background:#07070a"><tr><td align="center" style="padding:32px 14px">'
    . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">'
    . '<tr><td style="padding:0 6px 18px;font:800 24px Arial,sans-serif;color:#f4f4f1;letter-spacing:-1px">JS<span style="color:#d1fe17">.</span></td></tr>'
    . '<tr><td height="3" style="background:#d1fe17;border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>'
    . '<tr><td bgcolor="#0f0f14" style="background:#0f0f14;border:1px solid #26262e;border-top:0;border-radius:0 0 24px 24px;padding:38px 34px">' . $inner . '</td></tr>'
    . '<tr><td style="padding:22px 6px;font:12px/1.7 Arial,sans-serif;color:#6e6e79"><strong style="color:#f4f4f1">Joshua Sambere</strong> &middot; Junior IT Specialist &amp; Web Developer<br>Binalbagan, Negros Occidental, Philippines</td></tr>'
    . '</table></td></tr></table></body></html>';

$fullName = $firstName . ' ' . $lastName;
$serviceText = $service !== '' ? $service : 'Not specified';
$stamp = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('M j, Y \a\t g:i A');
$replyHref = 'mailto:' . $email . '?subject=' . rawurlencode('Re: ' . ($service !== '' ? $service : 'Your inquiry'));

$ownerHtml = $layout(
    $escape($firstName) . ' sent a new inquiry about ' . $escape($serviceText),
    $pill('NEW INQUIRY')
    . '<h1 style="margin:22px 0 6px;font:800 34px/1.1 Arial,sans-serif;letter-spacing:-1.5px;color:#f4f4f1">' . $escape($firstName) . ' wants to talk.</h1>'
    . '<p style="margin:0 0 26px;font:15px/1.6 Arial,sans-serif;color:#9a9aa5">Received ' . $stamp . ' (Philippine time)</p>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">'
    . $row('Name', $escape($fullName))
    . $row('Email', '<a href="mailto:' . $escape($email) . '" style="color:#d1fe17;text-decoration:none">' . $escape($email) . '</a>')
    . $row('Service', $escape($serviceText))
    . '</table>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px"><tr><td style="background:#0a0a0e;border:1px solid #26262e;border-left:3px solid #d1fe17;border-radius:14px;padding:20px 22px">'
    . '<p style="margin:0 0 10px;font:bold 11px Arial,sans-serif;letter-spacing:2px;color:#d1fe17">MESSAGE</p>'
    . '<p style="margin:0;font:15px/1.75 Arial,sans-serif;color:#f4f4f1">' . nl2br($escape($message)) . '</p></td></tr></table>'
    . $button($replyHref, 'Reply to ' . $escape($firstName))
);

$clientHtml = $layout(
    'I got your message and will reply within 24 hours.',
    $pill('MESSAGE RECEIVED')
    . '<h1 style="margin:22px 0 12px;font:800 38px/1.08 Arial,sans-serif;letter-spacing:-1.5px;color:#f4f4f1">Thanks, ' . $escape($firstName) . '.</h1>'
    . '<p style="margin:0 0 28px;font:16px/1.7 Arial,sans-serif;color:#9a9aa5">Your inquiry landed safely in my inbox'
    . ($service !== '' ? ' and I noted your interest in <strong style="color:#d1fe17">' . $escape($service) . '</strong>' : '')
    . '. Here is what happens next.</p>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">'
    . $step('1', 'I read your message', 'Personally, not through an autoresponder.')
    . $step('2', 'You hear back within 24 hours', 'I will reply to this email address with questions or a quote.')
    . $step('3', 'We plan the work', 'Scope, timeline and price agreed before anything starts.')
    . '</table>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 ' . ($siteUrl !== '' ? '28px' : '0') . '"><tr><td style="background:#0a0a0e;border:1px solid #26262e;border-radius:14px;padding:18px 20px">'
    . '<p style="margin:0 0 8px;font:bold 11px Arial,sans-serif;letter-spacing:2px;color:#7d7d89">YOUR MESSAGE</p>'
    . '<p style="margin:0;font:14px/1.7 Arial,sans-serif;color:#c9c9d1">' . nl2br($escape(mb_strimwidth($message, 0, 300, '...'))) . '</p></td></tr></table>'
    . ($siteUrl !== '' ? $button($siteUrl, 'View my work') : '')
);

try {
    $mailer = new PHPMailer(true);
    $mailer->isSMTP();
    $mailer->Host = $smtpHost;
    $mailer->SMTPAuth = true;
    $mailer->Username = $smtpUsername;
    $mailer->Password = $smtpPassword;
    $mailer->SMTPSecure = $smtpEncryption === 'ssl'
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;
    $mailer->Port = $smtpPort;
    $mailer->Timeout = 15;
    $mailer->CharSet = PHPMailer::CHARSET_UTF8;
    $mailer->setFrom($smtpUsername, $mailFromName);
    $mailer->addAddress($mailTo);
    $mailer->addReplyTo($email, $fullName);
    $mailer->Subject = 'New inquiry from ' . $fullName . ($service !== '' ? ' - ' . $service : '');
    $mailer->isHTML(true);
    $mailer->Body = $ownerHtml;
    $mailer->AltBody = implode("\n", [
        'New portfolio inquiry',
        'Received: ' . $stamp . ' (Philippine time)',
        'Name: ' . $fullName,
        'Email: ' . $email,
        'Service: ' . $serviceText,
        '',
        'Message:',
        $message,
    ]);
    $mailer->send();
    $_SESSION['last_contact_submission'] = $now;

    $confirmationSent = false;
    try {
        $mailer->clearAddresses();
        $mailer->clearReplyTos();
        $mailer->addAddress($email, $fullName);
        $mailer->addReplyTo($mailTo, $mailFromName);
        $mailer->Subject = 'Thanks for reaching out, ' . $firstName;
        $mailer->Body = $clientHtml;
        $mailer->AltBody = "Hi {$firstName},\n\nThanks for your inquiry. I received your message and will reply within 24 hours."
            . ($service !== '' ? "\nI have noted your interest in: {$service}." : '')
            . "\n\nJoshua Sambere\nJunior IT Specialist - Web Developer";
        $mailer->send();
        $confirmationSent = true;
    } catch (MailException $exception) {
        error_log('Contact form confirmation email failed: ' . $exception->getMessage());
    }

    respond(200, [
        'success' => true,
        'message' => $confirmationSent
            ? 'Thanks, ' . $firstName . '! Your inquiry is in my inbox. A confirmation email is on its way.'
            : 'Thanks, ' . $firstName . '! Your inquiry is in my inbox. I\'ll reply within 24 hours.',
    ]);
} catch (MailException $exception) {
    error_log('Contact form email delivery failed: ' . $exception->getMessage());
    respond(500, ['success' => false, 'message' => 'Your message could not be sent. Please try again later.']);
}