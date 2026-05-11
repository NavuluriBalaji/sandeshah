
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const FormData = require("form-data");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const genAI = new GoogleGenerativeAI("${gemini_api_key}");
const SHEET_URL = "https://opensheet.elk.sh//Sheet1";

const CELEBRATION_SHEET_URL =
    "https://opensheet.elk.sh/1R_YkSwYm5b_e7wj8A0vbnbjTS3ZJG0D1pXZXZKThPSw/Celebrations";

const REMINDER_SHEET_URL =
    "https://opensheet.elk.sh/1R_YkSwYm5b_e7wj8A0vbnbjTS3ZJG0D1pXZXZKThPSw/Reminders";

const FESTIVAL_SHEET_URL =
    "https://opensheet.elk.sh/1R_YkSwYm5b_e7wj8A0vbnbjTS3ZJG0D1pXZXZKThPSw/Festivals";


const app = express();
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;

// 🔹 MongoDB connection (PASTE YOUR STRING)
mongoose.connect("mongodb://Admin:Test123@ac-kbywfcn-shard-00-00.fwu3ua4.mongodb.net:27017,ac-kbywfcn-shard-00-01.fwu3ua4.mongodb.net:27017,ac-kbywfcn-shard-00-02.fwu3ua4.mongodb.net:27017/whatsapp_bot?ssl=true&replicaSet=atlas-10kvq4-shard-0&authSource=admin&appName=Cluster0")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log(err));

// 🔹 Schema
const PostSchema = new mongoose.Schema({
    phone: String,
    image_url: String,
    user_text: String,
    captions: String,
    type: String, // IMAGE_TEXT / TEXT_ONLY
    created_at: {
        type: Date,
        default: Date.now
    }
});

const Post = mongoose.model("Post", PostSchema);

const twilio = require("twilio");

const client = twilio(
    "${twilio_sid_key}",
    "${twilio_auth_token}",
);

async function uploadToCloudinary(mediaUrl) {
    // 🔹 Step 1: Download image from Twilio (with auth)
    const imageResponse = await axios.get(mediaUrl, {
        responseType: "arraybuffer",
        auth: {
            username: "${twilio_sid_key}",
            password: "${twilio_auth_token}"
        }
    });

    // 🔹 Step 2: Convert to base64
    const base64Image = Buffer.from(imageResponse.data, "binary").toString("base64");

    const form = new FormData();
    form.append("file", `data:image/jpeg;base64,${base64Image}`);
    form.append("upload_preset", "n8n_upload");

    const response = await axios.post(
        "https://api.cloudinary.com/v1_1/ditkhnyut/image/upload",
        form,
        { headers: form.getHeaders() }
    );

    return response.data.secure_url;
}





// 🔹 Generate captions (replace with OpenAI/Groq)

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: "${groq_api_key}"
});

async function generateCaptions(input) {
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_tokens: 100,
        temperature: 0.7,
        messages: [
            {
                role: "user",
                content: `Generate exactly 3 short captions for: ${input}.

Rules:
- Each caption must be on a new line
- Maximum 12 words per caption
- No numbering
- No quotes
- No extra explanation
- you need to include AVK in every captions

Output example:
Caption one
Caption two
Caption three`
            }
        ]
    });

    return response.choices[0].message.content.trim();
}



// 🔹 MAIN WEBHOOK
app.post("/webhook", async (req, res) => {
    try {
        const from = req.body.From;
        const text = (req.body.Body || "").trim();
        const lowerText = text.toLowerCase();

        const hasMedia = req.body.NumMedia && req.body.NumMedia !== "0";
        const mediaUrl = req.body.MediaUrl0;

        // =========================
        // 📷 IMAGE + TEXT FLOW
        // =========================
        if (hasMedia) {
            const uploadedUrl = await uploadToCloudinary(mediaUrl);
            const captions = await generateCaptions(text);

            await Post.create({
                phone: from,
                image_url: uploadedUrl,
                user_text: text,
                captions,
                type: "IMAGE_TEXT"
            });

            return res.send(`
<Response>
  <Message>
    <Media>${uploadedUrl}</Media>
    ${captions}
  </Message>
</Response>
`);
        }

        // =========================
        // 📝 DRAFT FLOW
        // =========================
        if (lowerText === "draft") {
            const last = await Post.findOne({ phone: from })
                .sort({ created_at: -1 });

            if (!last) {
                return res.send(`<Response><Message>No data to draft</Message></Response>`);
            }

            // Case 1: image exists
            if (last.image_url) {
                return res.send(`
<Response>
  <Message>
    <Media>${last.image_url}</Media>
    ${last.captions}

Drafted successfully
  </Message>
</Response>
`);
            }

            // Case 2: only captions
            return res.send(`
<Response>
  <Message>
    ${last.captions}

Drafted successfully
  </Message>
</Response>
`);
        }

        // =========================
        // 🎨 POSTER GENERATION FLOW
        // =========================
        if (!hasMedia && lowerText.startsWith("create")) {
            const promptText = text
                .toLowerCase()
                .replace("create", "")
                .replace("wishes", "")
                .replace("poster", "")
                .trim();

            let imageUrl;

            // 🔥 TRY GEMINI FIRST
            const imageBuffer = await generateAIImage(promptText);

            if (imageBuffer) {
                console.log("Gemini image success");
                imageUrl = await uploadBufferToCloudinary(imageBuffer);
            } else {
                console.log("Fallback poster used");

                const localPath = await generatePoster(promptText);
                imageUrl = await uploadLocalToCloudinary(localPath);
            }

            const captions = await generateCaptions(promptText);

            await Post.create({
                phone: from,
                image_url: imageUrl,
                user_text: promptText,
                captions,
                type: "AI_POSTER"
            });

            res.set("Content-Type", "text/xml");

            return res.send(`
<Response>
  <Message>
    <Media>${imageUrl}</Media>
    ${captions}
  </Message>
</Response>
`);
        }
        // =========================
        // ✍️ TEXT ONLY FLOW
        // =========================
        const captions = await generateCaptions(text);

        await Post.create({
            phone: from,
            image_url: null,
            user_text: text,
            captions,
            type: "TEXT_ONLY"
        });

        return res.send(`
<Response>
  <Message>${captions}</Message>
</Response>
`);
    } catch (err) {
        console.error(err);
        return res.send(`<Response><Message>Error occurred</Message></Response>`);
    }
});


//img prompt
async function generateAIImage(promptText) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-image"
        });

        const result = await model.generateContent(
            `A high-quality Indian festival poster of ${promptText}, 
       realistic people, decorations, cinematic lighting, vibrant colors`
        );

        const parts = result.response.candidates[0].content.parts;

        for (const part of parts) {
            if (part.inlineData) {
                return Buffer.from(part.inlineData.data, "base64");
            }
        }

        return null;
    } catch (err) {
        console.log("Gemini failed:", err.message);
        return null;
    }
}
async function uploadBufferToCloudinary(buffer) {
    const form = new FormData();
    form.append("file", buffer, "image.png");
    form.append("upload_preset", "n8n_upload");

    const res = await axios.post(
        "https://api.cloudinary.com/v1_1/ditkhnyut/image/upload",
        form,
        { headers: form.getHeaders() }
    );

    return res.data.secure_url;
}
function buildPosterPrompt(input) {
    return `
Create a vibrant, high-quality poster-style image for "${input}".

Style:
- Bright festive colors
- Rich lighting
- Cultural elements
- Center composition
- Clean background

No text in image.
`;
}

;

async function uploadLocalToCloudinary(filePath) {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath)); // ✅ now works
    form.append("upload_preset", "n8n_upload");

    const res = await axios.post(
        "https://api.cloudinary.com/v1_1/ditkhnyut/image/upload",
        form,
        { headers: form.getHeaders() }
    );

    return res.data.secure_url;
}


async function loadBackground(promptText) {
    const { loadImage } = require("canvas");

    const urls = [
        `https://images.unsplash.com/photo-1608889175111-e4d0c9d8dc6d?w=1024`,
        `https://picsum.photos/1024`,
        `https://placehold.co/1024x1024`
    ];

    for (let url of urls) {
        try {
            return await loadImage(url);
        } catch (err) {
            console.log("Background failed:", url);
        }
    }

    throw new Error("All background sources failed");
}

// keyword generator
async function generateVisualKeywords(input) {
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_tokens: 50,
        temperature: 0.7,
        messages: [
            {
                role: "user",
                content: `Give visual keywords for creating an image of "${input}".

Rules:
- Only keywords
- Comma separated
- No explanation

Example:
diwali → diya lights, fireworks, rangoli, night festival`
            }
        ]
    });

    return response.choices[0].message.content.trim();
}
async function getDynamicImage(promptText) {
    const keywords = await generateVisualKeywords(promptText);

    // create deterministic seed
    const seed = encodeURIComponent(keywords);

    return `https://picsum.photos/seed/${seed}/1024`;
}

async function generatePoster(promptText) {
    const { createCanvas, loadImage } = require("canvas");
    const fs = require("fs");

    const width = 1024;
    const height = 1024;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 🔥 AI-based image selection
    const imageUrl = await getDynamicImage(promptText);
    const bg = await loadImage(imageUrl);

    ctx.drawImage(bg, 0, 0, width, height);

    // overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,0.3)");
    gradient.addColorStop(1, "rgba(0,0,0,0.8)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // clean text (FIXED ISSUE)
    const cleanText = promptText.replace(/wishes|poster|invitation/gi, "").trim();

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 70px Arial";
    ctx.textAlign = "center";
    ctx.fillText("HAPPY", width / 2, 180);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 80px Arial";
    ctx.fillText(cleanText.toUpperCase(), width / 2, 300);

    ctx.font = "28px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Wishing you happiness and success", width / 2, 400);

    ctx.font = "bold 35px Arial";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("AVK", width / 2, 900);

    const path = `./poster-${Date.now()}.png`;

    fs.writeFileSync(path, canvas.toBuffer("image/png"));

    return path;
}


// ===============================
// 📅 GOOGLE SHEET FETCH METHODS
// ===============================

async function fetchCelebrations() {
    const res = await axios.get(CELEBRATION_SHEET_URL);
    return res.data;
}

async function fetchReminders() {
    const res = await axios.get(REMINDER_SHEET_URL);
    return res.data;
}

async function fetchFestivals() {
    const res = await axios.get(FESTIVAL_SHEET_URL);
    return res.data;
}

// ===============================
// 📅 GET TODAY ROWS
// ===============================

function getTodayRows(data) {

    const today = new Date()
        .toISOString()
        .split("T")[0];

    return data.filter(
        item =>
            item.date &&
            item.date.trim() === today
    );
}

// ===============================
// 💬 COMMON MESSAGE FORMATTER
// ===============================

function buildMessage({
    name = "",
    title = "",
    captions = "",
    footer = "AVK Greetings"
}) {

    return `
Hello ${name},

${title ? title + "\n" : ""}

${captions}

- ${footer}
`;
}

// ===============================
// ⏰ SINGLE CRON
// ===============================

const cron = require("node-cron");

cron.schedule("* * * * *", async () => {

    console.log("Checking all sheets...");

    try {

        await processCelebrations();

        await processReminders();

        await processFestivals();

        console.log("All automations completed");

    } catch (err) {

        console.error("Cron error:", err);

    }

});

// ===============================
// 🎉 CELEBRATIONS FLOW
// ===============================

async function processCelebrations() {

    console.log("Checking celebrations...");

    const data = await fetchCelebrations();

    const rows = getTodayRows(data);

    if (!rows.length) {
        console.log("No celebrations today");
        return;
    }

    for (const item of rows) {

        const alreadySent = await Post.findOne({
            phone: item.phone,
            user_text: item.name,
            type: "CELEBRATION",
            created_at: {
                $gte: new Date(
                    new Date().setHours(0, 0, 0, 0)
                )
            }
        });

        if (alreadySent) {
            console.log("Celebration already sent");
            continue;
        }

        const captions = await generateCaptions(
            `${item.type} wishes for ${item.name}`
        );

        const message = buildMessage({
            name: item.name,
            title: "🎉 Celebration Wishes",
            captions,
            footer: "AVK Greetings"
        });

        await client.messages.create({
            from: "whatsapp:+14155238886",

            to: item.phone,

            body: message,

            mediaUrl: item.poster_url
                ? [item.poster_url]
                : undefined
        });

        await Post.create({
            phone: item.phone,
            image_url: item.poster_url || null,
            user_text: item.name,
            captions,
            type: "CELEBRATION"
        });

        console.log("Celebration sent:", item.name);
    }
}

// ===============================
// 🔔 REMINDERS FLOW
// ===============================

async function processReminders() {

    console.log("Checking reminders...");

    const data = await fetchReminders();

    const rows = getTodayRows(data);

    if (!rows.length) {
        console.log("No reminders today");
        return;
    }

    for (const item of rows) {

        const alreadySent = await Post.findOne({
            phone: item.phone,
            user_text: item.reminder_message,
            type: "REMINDER",
            created_at: {
                $gte: new Date(
                    new Date().setHours(0, 0, 0, 0)
                )
            }
        });

        if (alreadySent) {
            console.log("Reminder already sent");
            continue;
        }

        const message = buildMessage({
            name: item.name,
            title: "🔔 Reminder",
            captions: item.reminder_message,
            footer: "AVK Team"
        });

        await client.messages.create({
            from: "whatsapp:+14155238886",

            to: item.phone,

            body: message
        });

        await Post.create({
            phone: item.phone,
            image_url: null,
            user_text: item.reminder_message,
            captions: item.reminder_message,
            type: "REMINDER"
        });

        console.log("Reminder sent:", item.name);
    }
}

// ===============================
// 🎊 FESTIVAL FLOW
// ===============================

async function processFestivals() {

    console.log("Checking festivals...");

    const data = await fetchFestivals();

    const rows = getTodayRows(data);

    if (!rows.length) {
        console.log("No festivals today");
        return;
    }

    for (const item of rows) {

        const alreadySent = await Post.findOne({
            phone: item.phone,
            user_text: item.event,
            type: "FESTIVAL",
            created_at: {
                $gte: new Date(
                    new Date().setHours(0, 0, 0, 0)
                )
            }
        });

        if (alreadySent) {
            console.log("Festival already sent");
            continue;
        }

        const captions = await generateCaptions(
            item.event
        );

        const message = buildMessage({
            name: item.name || "User",
            title: `🎊 ${item.event}`,
            captions,
            footer: "AVK Greetings"
        });

        await client.messages.create({
            from: "whatsapp:+14155238886",

            to: item.phone,

            body: message,

            mediaUrl: item.poster_url
                ? [item.poster_url]
                : undefined
        });

        await Post.create({
            phone: item.phone,
            image_url: item.poster_url || null,
            user_text: item.event,
            captions,
            type: "FESTIVAL"
        });

        console.log("Festival sent:", item.event);
    }
}
// 🔹 START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

