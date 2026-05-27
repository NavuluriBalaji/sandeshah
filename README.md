# WhatsApp AI Automation Bot

An AI-powered WhatsApp automation system built using Node.js, Twilio, MongoDB, Groq AI, Gemini AI, Cloudinary, and Google Sheets.

The system automatically generates:
- WhatsApp greeting messages
- Festival wishes
- Reminder notifications
- AI-generated posters
- Automated celebration workflows

---

# Features

- AI-generated captions
- WhatsApp automation
- Festival and reminder scheduling
- AI poster generation
- Cloudinary media uploads
- MongoDB data storage
- Google Sheets integration
- Cron-based automation

---

# Tech Stack

- Node.js
- Express.js
- MongoDB
- Twilio API
- Groq AI
- Gemini AI
- Cloudinary
- Google Sheets
- Node Cron

---

# Installation

Clone the repository:

```bash
git clone <your-repository-url>
cd whatsapp-ai-bot
```

Install dependencies:

```bash
npm install
```

---

# Environment Setup

Create a `.env` file in the project root directory.

You can copy the example file:

```bash
cp .env.example .env
```

Update all required environment variables inside `.env`.

---

# Required Environment Variables

Create a file named:

```bash
.env.example
```

Add the following:

```env
# =========================================
# Server Configuration
# =========================================
PORT=3000

# =========================================
# MongoDB Configuration
# =========================================
MONGODB_CONNECTION_STRING=

# =========================================
# Twilio WhatsApp Configuration
# =========================================
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# =========================================
# Groq AI Configuration
# =========================================
GROQ_API_KEY=

# =========================================
# Gemini AI Configuration
# =========================================
GEMINI_API_KEY=

# =========================================
# Cloudinary Configuration
# =========================================
CLOUDINARY_UPLOAD_URL=
CLOUDINARY_UPLOAD_PRESET=n8n_upload

# =========================================
# Google Sheet URLs
# =========================================
CELEBRATION_SHEET_URL=
REMINDER_SHEET_URL=
FESTIVAL_SHEET_URL=
```

---

# Required Packages

Install all dependencies using:

```bash
npm install express mongoose axios form-data dotenv twilio groq-sdk node-cron canvas @google/generative-ai
```

---

# Project Structure

```bash
project/
│
├── .env
├── .env.example
├── package.json
├── server.js
├── README.md
└── node_modules/
```

---

# Running the Project

Start the server:

```bash
node server.js
```

Or using nodemon:

```bash
npx nodemon server.js
```

---

# WhatsApp Webhook Setup

Configure the Twilio webhook URL:

```bash
POST /webhook
```

Example:

```bash
https://your-domain.com/webhook
```

---

# Google Sheet Structure

## Celebrations Sheet

| date | name | phone | type | poster_url |
|------|------|------|------|------|

---

## Reminders Sheet

| date | name | phone | reminder_message |
|------|------|------|------|

---

## Festivals Sheet

| date | name | phone | event | poster_url |
|------|------|------|------|------|

---

# Supported Flows

## 1. Text Message Flow

User sends:

```text
Birthday wishes
```

Bot returns AI-generated greeting message.

---

## 2. Image + Text Flow

User sends:
- Image
- Caption prompt

Bot:
- Uploads image
- Generates AI caption
- Returns drafted content

---

## 3. AI Poster Generation

User sends:

```text
Create Diwali Poster
```

Bot:
- Generates AI poster
- Uploads to Cloudinary
- Returns generated poster with caption

---

## 4. Draft Flow

User sends:

```text
draft
```

Bot returns previously generated content.

---

# Automation

Cron jobs automatically process:
- Festivals
- Celebrations
- Reminders

Current cron schedule:

```js
* * * * *
```

Runs every minute.

---

# Security Notes

- Never commit `.env` files
- Keep API keys private
- Use environment variables for all secrets
- Rotate credentials regularly

Add this to `.gitignore`:

```bash
.env
node_modules
```



