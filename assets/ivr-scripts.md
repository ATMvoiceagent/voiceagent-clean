# ATM VoiceAgent — IVR Scripts (canonical copy)

_Last updated: 2025-10-07_

## Main Menu (verbatim)
- “Thank you for contacting ATM Support. If you have questions about pricing and product information, or you're looking to purchase or place an A T M, press 1.”
- “If you have an error code on your A T M screen, press 2. If you're experiencing an issue such as a stuck card or not receiving cash, press 3. Or to have a technician call you back, press 4. Please make your selection now.”

---

## Option 1 — Sales
Prompt:
- “To receive a text link to our website for product information, press 1. To speak with Jeff in sales, press 2.”

If **1** (text website link):
- “Please confirm the mobile number to receive the text. Press 1 to use your number ending in XXXX or press 2 to enter a new 10-digit mobile number.”
  - If **1** (use caller’s number):
    - “Okay, I’ve sent you the link by text. Please take a moment to explore our website. If you have any questions, feel free to call us back, and you can speak directly with Jeff. Thanks for calling ATM support. Goodbye.”
  - If **2** (enter new number, then send):
    - “Okay, I’ve sent you the link by text. Please take a moment to explore our website. If you have any questions, feel free to call us back, and you can speak directly with Jeff. Thanks for calling ATM support. Goodbye.”

If **2** (transfer to sales):
- “Okay, let me transfer you to Jeff now.”

> Notes:
> - Use `SALES_NUMBER` for the transfer (we removed `JEFF_NUMBER`).
> - SMS `from`: `SMS_FROM` (`CALLER_ID`) and link: `WEBSITE_URL`.

---

## Option 2 — ATM Error Lookup
Collect:
- “Okay, please enter your error code using your phone’s keypad, then press the pound sign.”
- “For example, for the error code D 1 7 0 0, you would press the number 3 for the letter D, followed by 1, 7, 0, 0. Enter your error code now, then press the pound sign.”

If code **found**:
- “I found your error code D, # # # # … [code read out] [title].”
- “Here is a brief summary of the steps:”  
  → Read the short steps.

Then choice:
- “Press 1 if you want me to text you these troubleshooting steps. Or press 2 to skip.”

If **1** (send steps):
- If error **has a video**:
  - “I sent the steps to resolve the issue by text, along with a link to a video that demonstrates how to fix the problem. Please call us back if you're unable to resolve the issue. Thank you for contacting ATM support. Goodbye!”
- If **no video**:
  - “I sent the steps to resolve the issue by text. Please call us back if you are unable to resolve the issue. Thanks for calling ATM support. Goodbye.”

If **2** (skip):
- “No problem. Call us back if you're unable to resolve your issue. Thanks for calling ATM support. Goodbye.”

If code **not found**:
- “I could not find that error code. I will connect you with a technician.” → route to Tech Callback.

> Test codes currently embedded:
> - D1700 (video) — keypad 31700
> - D1701 — keypad 31701
> - D0004 — keypad 4
> - D20002 — keypad 20002

---

## Option 3 — Common Issues (DTMF 1–4)
Prompt:
- “If your card is stuck press 1, if the screen is frozen press 2, if you didn’t get your money press 3, for any other issue press 4.”

### 3-1 Card Stuck (confirm-number flow)
Explain:
- “The ATM needs to be powered off in order for you to retrieve your card. To help identify the correct ATM terminal, I need to text you a secure link so you can share your location with me. This allows me to locate the exact ATM terminal number, so I can send an automatic reboot which will release your card.”

Confirm/send/CB:
- “Press 1 to confirm the mobile number ending in XXXX. Press 2 to enter a different 10-digit mobile number. Or press 3 if you would rather have a technician call you back.”
  - If **1** or **2** (send link and trigger reboot workflow):
    - “I’ve sent the reboot command. If the reboot is unsuccessful, please try unplugging the power cord to the ATM, or you can call us back, and we’ll connect you with a technician. Thank you for contacting ATM support. Goodbye!”
  - If **3**:
    - “Okay, no problem. Let’s get some information so we can have a technician call you back.” → go to Tech Callback.

### 3-2 Screen Frozen (confirm-number flow)
Explain:
- “The ATM needs to be powered off in order for it to come back into service. To help identify the correct ATM terminal, I need to text you a secure link so you can share your location with me. This allows me to locate the exact ATM terminal number, so I can send an automatic reboot which will restart the ATM.”

Confirm/send/CB:
- “Press 1 to confirm the mobile number ending in XXXX. Press 2 to enter a different 10-digit mobile number. Or press 3 if you would rather have a technician call you back.”
  - If **1** or **2** (send link and trigger reboot workflow):
    - “I’ve sent the reboot command. If the reboot is unsuccessful, please try unplugging the power cord to the ATM, or you can call us back, and we’ll connect you with a technician. Thank you for contacting ATM support. Goodbye!”
  - If **3** → Tech Callback.

### 3-3 Didn’t Get Money
- SMS claim link, then:
- “I’ve sent you a text message with the claim link. Please complete it and we’ll follow up. Goodbye.”

### 3-4 Other
- Route to Tech Callback.

---

## Option 4 — Technician Callback (high-level script)
Flow:
1) Collect first name.  
2) Confirm callback number (use caller ID or enter 10 digits).  
3) Store city (or nearest cross-street if provided).  
4) Short description of the issue.  
5) Offer to send secure location link (GEO_URL) if helpful.  
6) Confirm submission and end call.

Closers:
- “Thank you. A technician will call you back shortly. Goodbye.”

> Notes:
> - Call recording: deferred (off).  
> - Email/SendGrid: deferred.  
> - SMS from: `SMS_FROM`.  
> - Links: `GEO_URL`, `CLAIM_LINK`, `WEBSITE_URL`.

