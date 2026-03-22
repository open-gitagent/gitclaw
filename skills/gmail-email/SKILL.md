---
name: gmail-email
description: Send emails via Gmail SMTP using App Password authentication.
---

# Gmail Email Skill

Send emails via Gmail SMTP.

## Setup

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Sign in to your Google account
   - Select "Mail" and your device
   - Generate password and save it

3. **Configure credentials**:
   ```bash
   export GMAIL_USER="your-email@gmail.com"
   export GMAIL_APP_PASSWORD="your-16-char-app-password"
   ```

   Or create a `.env` file in the skill directory:
   ```
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   ```

## Usage

```bash
python3 scripts/send_email.py \
  --to "recipient@example.com" \
  --subject "Subject line" \
  --body "Email body text"
```

## Requirements

- Python 3.6+
- No additional packages needed (uses stdlib smtplib)
