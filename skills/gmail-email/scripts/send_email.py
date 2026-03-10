#!/usr/bin/env python3
"""
Send email via Gmail SMTP
"""
import smtplib
import argparse
import os
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

def load_env():
    """Load environment variables from .env file if it exists"""
    env_file = Path(__file__).parent.parent / '.env'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def send_email(to, subject, body, from_email=None, app_password=None):
    """Send email via Gmail SMTP"""
    
    # Get credentials
    from_email = from_email or os.getenv('GMAIL_USER')
    app_password = app_password or os.getenv('GMAIL_APP_PASSWORD')
    
    if not from_email or not app_password:
        print("ERROR: Gmail credentials not found!", file=sys.stderr)
        print("\nPlease set credentials using one of these methods:", file=sys.stderr)
        print("\n1. Environment variables:", file=sys.stderr)
        print("   export GMAIL_USER='your-email@gmail.com'", file=sys.stderr)
        print("   export GMAIL_APP_PASSWORD='your-app-password'", file=sys.stderr)
        print("\n2. Create a .env file in skills/gmail-email/:", file=sys.stderr)
        print("   GMAIL_USER=your-email@gmail.com", file=sys.stderr)
        print("   GMAIL_APP_PASSWORD=your-app-password", file=sys.stderr)
        print("\nTo generate an App Password:", file=sys.stderr)
        print("   1. Enable 2FA on your Gmail account", file=sys.stderr)
        print("   2. Go to https://myaccount.google.com/apppasswords", file=sys.stderr)
        print("   3. Generate an app password for 'Mail'", file=sys.stderr)
        sys.exit(1)
    
    # Create message
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to
    msg['Subject'] = subject
    
    msg.attach(MIMEText(body, 'plain'))
    
    # Send email
    try:
        print(f"Connecting to Gmail SMTP server...", file=sys.stderr)
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        
        print(f"Logging in as {from_email}...", file=sys.stderr)
        server.login(from_email, app_password)
        
        print(f"Sending email to {to}...", file=sys.stderr)
        text = msg.as_string()
        server.sendmail(from_email, to, text)
        server.quit()
        
        print(f"✓ Email sent successfully to {to}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        print("ERROR: Authentication failed. Check your credentials.", file=sys.stderr)
        print("Make sure you're using an App Password, not your regular password.", file=sys.stderr)
        return False
    except Exception as e:
        print(f"ERROR: Failed to send email: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='Send email via Gmail SMTP')
    parser.add_argument('--to', required=True, help='Recipient email address')
    parser.add_argument('--subject', required=True, help='Email subject')
    parser.add_argument('--body', required=True, help='Email body')
    parser.add_argument('--from', dest='from_email', help='Sender email (default: GMAIL_USER env var)')
    parser.add_argument('--password', dest='app_password', help='Gmail app password (default: GMAIL_APP_PASSWORD env var)')
    
    args = parser.parse_args()
    
    # Load .env file if exists
    load_env()
    
    # Send email
    success = send_email(
        to=args.to,
        subject=args.subject,
        body=args.body,
        from_email=args.from_email,
        app_password=args.app_password
    )
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
