const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const wifi = require("node-wifi");

// CONFIGURATION
const INTERNAL_ROOT = "/storage/emulated/0/";
const EXTERNAL_ROOTS = ["/storage"];
const SERVER_URL = "http://TON_SERVEUR/upload";
const HISTORY_FILE = "uploaded.json";
const BATCH_SIZE = 3;
const IGNORE_FOLDERS = ["Android", "LOST.DIR"];
const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Initialiser node-wifi
wifi.init({ iface: null });

// Charger l'historique
let uploadedFiles = [];
if (fs.existsSync(HISTORY_FILE)) {
    uploadedFiles = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
}

// Sauvegarder l'historique
function saveHistory() {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(uploadedFiles, null, 2));
}

// Fonction WhatsApp
async function sendWhatsApp(message) {
    const phone = "22891782947";
    const apiKey = "1944847";

    try {
        await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`);
        console.log("✅ Message envoyé sur WhatsApp via CallMeBot");
    } catch (err) {
        console.error("❌ Erreur WhatsApp:", err.message);
    }
}

// Upload d'une image
async function uploadImage(filePath) {
    try {
        const form = new FormData();
        form.append("image", fs.createReadStream(filePath));
        await axios.post(SERVER_URL, form, { headers: form.getHeaders() });
        console.log(`✅ Upload réussi : ${filePath}`);
        uploadedFiles.push(filePath);
        saveHistory();

        // Notification WhatsApp
        await sendWhatsApp(`✅ Upload réussi : ${filePath}`);
    } catch (err) {
        console.error(`❌ Échec upload ${filePath}:`, err.message);
        await sendWhatsApp(`❌ Échec upload : ${filePath} \nErreur : ${err.message}`);
    }
}

// Collecte récursive des images
function collectImages(folder, images = []) {
    let entries;
    try {
        entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch (err) {
        return images;
    }

    for (let entry of entries) {
        const fullPath = path.join(folder, entry.name);
        if (entry.isDirectory()) {
            if (!IGNORE_FOLDERS.includes(entry.name)) {
                collectImages(fullPath, images);
            }
        } else if (/\.(jpg|jpeg|png|gif)$/i.test(entry.name)) {
            if (!uploadedFiles.includes(fullPath)) {
                images.push(fullPath);
            }
        }
    }
    return images;
}

// Upload par lots
async function uploadBatch(images) {
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(uploadImage));
    }
}

// Vérifier la connexion Wi-Fi
async function isWifiConnected() {
    try {
        const connections = await wifi.getCurrentConnections();
        return connections.length > 0;
    } catch (err) {
        console.error("Erreur Wi-Fi :", err.message);
        return false;
    }
}

// Fonction principale
async function main() {
    const wifiConnected = await isWifiConnected();
    if (!wifiConnected) {
        console.log("⚠️ Pas de Wi-Fi. Uploads suspendus.");
        await sendWhatsApp("⚠️ Pas de Wi-Fi. Uploads suspendus.");
        return;
    }

    console.log("🔔 Wi-Fi détecté. Scan des images...");

    // Stockage interne
    let images = collectImages(INTERNAL_ROOT);

    // Carte SD / stockage externe
    for (let root of EXTERNAL_ROOTS) {
        try {
            const subdirs = fs.readdirSync(root, { withFileTypes: true });
            for (let sub of subdirs) {
                if (sub.isDirectory() && sub.name !== "emulated") {
                    images = images.concat(collectImages(path.join(root, sub.name)));
                }
            }
        } catch (err) { /* ignoré si inaccessible */ }
    }

    console.log(`📁 ${images.length} images à uploader...`);
    if (images.length > 0) {
        await uploadBatch(images);
        console.log("✅ Upload terminé !");
        await sendWhatsApp(`✅ Upload terminé ! ${images.length} image(s) envoyée(s).`);
    } else {
        console.log("✅ Aucune nouvelle image à uploader.");
        await sendWhatsApp("✅ Aucune nouvelle image à uploader.");
    }
}

// Lancer la surveillance en continu
main(); // premier scan
setInterval(main, SCAN_INTERVAL);
