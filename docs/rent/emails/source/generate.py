#!/usr/bin/env python3
"""Bake the Drive Exotiq transactional email set.

One shared shell (brand system) + per-template bodies -> fully inlined,
self-contained HTML files ready for the edge function to interpolate with
simple {{VARIABLE}} replacement. Run from this directory:

    python3 generate.py

Design language mirrors the booking platform: #06070a canvas, #0D0F14 frame,
gold #C8A664, serif headlines (Georgia everywhere, Newsreader progressively
enhanced where supported), letter-spaced eyebrow labels. Table-based and
inline-styled for Gmail/Outlook/Apple Mail; no images required for the
design to hold (image blocks are optional variables).
"""

from pathlib import Path

GOLD = "#C8A664"
GOLD_DEEP = "#1A1308"
CANVAS = "#06070a"
FRAME = "#0D0F14"
CARD = "#161922"
BORDER = "#2A2E3A"
TEXT = "#F0F2F5"
MUTED = "#9BA1B0"
FAINT = "#5C6272"

SERIF = "'Newsreader', Georgia, 'Times New Roman', serif"
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def shell(title: str, preheader: str, body_rows: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>{title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root {{ color-scheme: dark; supported-color-schemes: dark; }}
    body {{ margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }}
    a {{ color: {GOLD}; }}
    @media only screen and (max-width: 620px) {{
      .container {{ width: 100% !important; }}
      .px {{ padding-left: 20px !important; padding-right: 20px !important; }}
      .h1 {{ font-size: 26px !important; line-height: 32px !important; }}
    }}
  </style>
</head>
<body style="margin:0; padding:0; background-color:{CANVAS};" bgcolor="{CANVAS}">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CANVAS}" style="background-color:{CANVAS};">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="{FRAME}" style="width:600px; max-width:600px; background-color:{FRAME}; border-radius:16px; overflow:hidden; border:1px solid {BORDER};">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:{SANS}; font-size:12px; letter-spacing:6px; color:{GOLD}; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

{body_rows}

          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid {BORDER}; padding-top:20px; font-family:{SANS}; font-size:12px; line-height:18px; color:{FAINT};">
                  Booking {{{{BOOKING_REF}}}} &middot; {{{{OPERATOR_NAME}}}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def eyebrow(text: str) -> str:
    return f"""          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:{SANS}; font-size:10px; letter-spacing:4px; color:{FAINT}; text-transform:uppercase;">{text}</div>
            </td>
          </tr>
"""


def headline(text: str, sub: str) -> str:
    return f"""          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:{SERIF}; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:{TEXT};">{text}</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:{SANS}; font-size:14px; line-height:22px; color:{MUTED};">{sub}</div>
            </td>
          </tr>
"""


def gold_card(rows_html: str) -> str:
    return f"""          <tr>
            <td class="px" style="padding: 18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14130F" style="background-color:#14130F; border:1px solid {GOLD}; border-radius:12px;">
                <tr><td style="padding: 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{rows_html}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
"""


def money_row(label: str, note: str, amount: str, top_border: bool = False, bold: bool = False) -> str:
    border = f"border-top:1px solid {BORDER};" if top_border else ""
    color = TEXT if bold else MUTED
    weight = "700" if bold else "400"
    note_html = f"<br><span style=\"font-size:11px; color:{FAINT};\">{note}</span>" if note else ""
    return f"""                    <tr>
                      <td style="{border} padding:10px 0; font-family:{SANS}; font-size:14px; color:{color}; font-weight:{weight};">{label}{note_html}</td>
                      <td align="right" style="{border} padding:10px 0; font-family:{SANS}; font-size:15px; color:{TEXT}; font-weight:{weight}; white-space:nowrap;">{amount}</td>
                    </tr>
"""


def detail_card() -> str:
    cell = f"font-family:{SANS}; padding:6px 0;"
    label = f"font-size:10px; letter-spacing:2.5px; color:{FAINT}; text-transform:uppercase;"
    value = f"font-size:14px; color:{TEXT}; padding-top:2px;"
    return f"""          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CARD}" style="background-color:{CARD}; border:1px solid {BORDER}; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="{cell}"><div style="{label}">Vehicle</div><div style="{value}">{{{{VEHICLE_NAME}}}}</div></td>
                      <td width="50%" style="{cell}"><div style="{label}">Dates</div><div style="{value}">{{{{DATE_RANGE}}}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="{cell}"><div style="{label}">Pickup</div><div style="{value}">{{{{PICKUP_TIME}}}}</div></td>
                      <td width="50%" style="{cell}"><div style="{label}">Location</div><div style="{value}">{{{{LOCATION}}}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
"""


def button(label: str, url_var: str) -> str:
    return f"""          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="{GOLD}" style="background-color:{GOLD}; border-radius:12px;">
                    <a href="{{{{{url_var}}}}}" target="_blank" style="display:block; padding:16px 24px; font-family:{SANS}; font-size:15px; font-weight:700; color:{GOLD_DEEP}; text-decoration:none;">{label}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
"""


def note(text: str) -> str:
    return f"""          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:{SANS}; font-size:12px; line-height:18px; color:{FAINT};">{text}</div>
            </td>
          </tr>
"""


TWO_CHARGES = "Two charges on your statement: your operator's rental, and an <span style=\"color:" + MUTED + ";\">EXOTIQ&nbsp;RENT</span> charge for booking fee + protection. One card entry."

TEMPLATES = {
    "payment-approved": {
        "title": "Approved — complete payment | Drive Exotiq",
        "preheader": "{{OPERATOR_NAME}} approved your {{VEHICLE_NAME}}. Complete payment by {{PAYMENT_DEADLINE}}.",
        "body": (
            eyebrow("You're approved")
            + headline("The {{VEHICLE_SHORT}} is yours to lock in.",
                       "{{OPERATOR_NAME}} approved booking {{BOOKING_REF}}. Complete payment and it's confirmed.")
            + gold_card(
                money_row("{{OPERATOR_NAME}} rental", "Appears as your operator on your statement", "{{RENTAL_AMOUNT}}")
                + money_row("Booking fee + protection", "Appears as EXOTIQ RENT", "{{EXOTIQ_AMOUNT}}", top_border=True)
                + money_row("Total due", "", "{{TOTAL_DUE}}", top_border=True, bold=True)
            )
            + detail_card()
            + button("Complete payment", "PAY_URL")
            + note("Your payment window closes <span style=\"color:" + MUTED + ";\">{{PAYMENT_DEADLINE}}</span> — after that the dates release back to the calendar.")
            + note(TWO_CHARGES)
        ),
    },
    "payment-reminder": {
        "title": "24 hours left to complete payment | Drive Exotiq",
        "preheader": "Your {{VEHICLE_NAME}} is still held — payment window closes {{PAYMENT_DEADLINE}}.",
        "body": (
            eyebrow("Payment reminder")
            + headline("Still holding your {{VEHICLE_SHORT}}.",
                       "Booking {{BOOKING_REF}} is approved and waiting — the payment window closes {{PAYMENT_DEADLINE}}.")
            + gold_card(
                money_row("Total due", "Rental + booking fee + protection", "{{TOTAL_DUE}}", bold=True)
            )
            + detail_card()
            + button("Complete payment", "PAY_URL")
            + note("If the window closes, the dates release automatically and the reservation ends. No charges have been made yet.")
        ),
    },
    "receipt-confirmed": {
        "title": "Confirmed — your receipt | Drive Exotiq",
        "preheader": "Paid and confirmed. {{VEHICLE_NAME}}, {{DATE_RANGE}} — your operator will reach out before pickup.",
        "body": (
            eyebrow("Booking confirmed")
            + headline("Confirmed. The keys are next.",
                       "Payment received for booking {{BOOKING_REF}}. {{OPERATOR_NAME}} will reach out before pickup.")
            + gold_card(
                money_row("{{OPERATOR_NAME}} rental", "Appears as your operator on your statement", "{{RENTAL_AMOUNT}}")
                + money_row("Booking fee + protection", "Appears as EXOTIQ RENT", "{{EXOTIQ_AMOUNT}}", top_border=True)
                + money_row("Total paid", "", "{{TOTAL_PAID}}", top_border=True, bold=True)
            )
            + detail_card()
            + button("View your booking", "CONFIRMATION_URL")
            + note("A refundable security deposit hold is placed at pickup — it is never charged unless there's damage. Free cancellation with a full refund until 72 hours before pickup.")
        ),
    },
    "refund-confirmation": {
        "title": "Refunded in full | Drive Exotiq",
        "preheader": "Both charges for booking {{BOOKING_REF}} have been refunded.",
        "body": (
            eyebrow("Refund confirmed")
            + headline("Refunded in full.",
                       "Booking {{BOOKING_REF}} was cancelled inside the free window — both charges are on their way back.")
            + gold_card(
                money_row("{{OPERATOR_NAME}} rental", "Refunded to your card", "{{RENTAL_AMOUNT}}")
                + money_row("Booking fee + protection", "Refunded to your card", "{{EXOTIQ_AMOUNT}}", top_border=True)
                + money_row("Total refunded", "", "{{TOTAL_REFUNDED}}", top_border=True, bold=True)
            )
            + note("Refunds typically appear on your statement within 5–10 business days, depending on your bank.")
            + button("Browse the fleet", "STOREFRONT_URL")
            + note("The road's still there whenever you're ready.")
        ),
    },
    "payment-expired": {
        "title": "Payment window closed | Drive Exotiq",
        "preheader": "The payment window for booking {{BOOKING_REF}} has closed and the dates were released.",
        "body": (
            eyebrow("Window closed")
            + headline("The window closed on this one.",
                       "The 48-hour payment window for booking {{BOOKING_REF}} passed, so the dates released back to the calendar. Nothing was charged.")
            + detail_card()
            + button("Book it again", "VEHICLE_URL")
            + note("Same car, new dates — approval is usually faster the second time.")
        ),
    },
}


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent
    for name, spec in TEMPLATES.items():
        html = shell(spec["title"], spec["preheader"], spec["body"])
        (out_dir / f"{name}.html").write_text(html)
        print(f"baked {name}.html ({len(html)} bytes)")


if __name__ == "__main__":
    main()
