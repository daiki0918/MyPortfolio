# Portfolio contact form setup

The contact form uses PHP, PHPMailer, and Gmail SMTP. It cannot send from a `file://` page or static-only hosting.

## Local setup on Windows

1. Install PHP 8.1+ and Composer.
2. From the project folder, install dependencies:

   ```powershell
   composer install
   ```

3. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. If you shared an app password anywhere, revoke it in your Google Account first. Generate a new Google App Password, then edit `.env` and set `SMTP_PASSWORD`. Never put the password in source code, chat, or commit `.env`.
5. Start PHP's local server from the project folder:

   ```powershell
   php -S 127.0.0.1:8000
   ```

6. Open `http://127.0.0.1:8000/` in your browser. Do not open `index.html` directly from File Explorer.

For production, deploy the project to hosting that runs PHP 8.1+, run `composer install` on the host (or deploy `vendor/` securely), and configure the SMTP values as hosting environment variables. Static-only hosts do not execute `contact.php`.

The form sends the inquiry to `MAIL_TO`, then sends a designed acknowledgment email to the visitor. The on-page confirmation appears after the inquiry reaches your inbox. If the acknowledgment email fails, the inquiry still succeeds and the server error log records the failure.
