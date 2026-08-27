import asyncio
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate

from app.core.config import settings


def _send_email_sync(to_email: str, subject: str, body_html: str):
    if not settings.smtp_user or not settings.smtp_password:
        print("SMTP не настроен. Письмо не отправлено.")
        print(f"To: {to_email}\nSubject: {subject}\nBody: {body_html}")
        return

    msg = MIMEMultipart("alternative")

    # Mail.ru требует строгий RFC-формат: кодирование кириллицы в UTF-8 и наличие даты
    sender_email = settings.smtp_from_email or settings.smtp_user

    msg["From"] = formataddr((str(Header("МУВИХАНТЕР", "utf-8")), sender_email))
    msg["To"] = to_email
    msg["Subject"] = Header(subject, "utf-8").encode()
    msg["Date"] = formatdate(localtime=True)

    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()

        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
        server.quit()
        print(f"Email успешно отправлен на {to_email}")
    except Exception as e:
        print(f"Ошибка отправки email: {e}")


async def send_reset_password_email(to_email: str, token: str):
    reset_url = f"{settings.site_url}/reset-password?token={token}"

    subject = "Восстановление пароля | МУВИХАНТЕР"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #ffffff; background-color: #111116; padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="color: #e50914; margin-top: 0; font-size: 24px; font-weight: 900;">Восстановление пароля</h2>
        <p style="color: #d1d5db; font-size: 15px; line-height: 1.5;">Привет! Мы получили запрос на сброс пароля для твоего аккаунта в МУВИХАНТЕРЕ.</p>
        <p style="color: #d1d5db; font-size: 15px; line-height: 1.5;">Если это был ты, нажми на кнопку ниже, чтобы придумать новый пароль:</p>
        
        <div style="text-align: center; margin: 28px 0;">
            <a href="{reset_url}" style="display: inline-block; padding: 14px 28px; background-color: #e50914; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">Сбросить пароль</a>
        </div>
        
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Ссылка действительна 1 час. Если ты не запрашивал сброс пароля, просто проигнорируй это письмо.</p>
    </div>
    """

    await asyncio.to_thread(_send_email_sync, to_email, subject, body_html)
