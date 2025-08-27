const os = require("os");
const { exec } = require("child_process");
const notifier = require("node-notifier");
const axios = require("axios");


let lastStatus = null;

// Fonction pour vérifier le réseau
function checkNetwork() {
    const interfaces = os.networkInterfaces();
    let status = [];

    for (let iface in interfaces) {
        interfaces[iface].forEach(net => {
            if (net.family === "IPv4" && !net.internal) {
                status.push(`${iface}: ${net.address}`);
            }
        });
    }

    const currentStatus = status.length > 0 ? status.join(", ") : "🚫 Pas de connexion";

    // Comparer avec le dernier état
    if (currentStatus !== lastStatus) {
        lastStatus = currentStatus;
        notifier.notify({
            title: "État du réseau",
            message: currentStatus,
            sound: true
        });
        console.log("Notification envoyée:", currentStatus);
    }
    async function sendWhatsApp(message) {
        const phone = "22891782947";
        const apiKey = "1944847";
    
        try {
            await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`);
            console.log("✅ Message envoyé sur WhatsApp via CallMeBot");
        } catch (err) {
            console.error("❌ Erreur:", err.message);
        }
    }
    if (currentStatus !== lastStatus) {
        lastStatus = currentStatus;
        sendWhatsApp(`🚨 Notification : Changement d'état du réseau ! ${currentStatus}`);
    }
}

// Vérifie toutes les 10 secondes
setInterval(checkNetwork, 10000);

console.log("🔔 Surveillance du réseau en cours...");


// Vérifier l'état du stockage (Android/Linux)
function checkStorage() {
    console.log("\n=== État du stockage ===");
    
}

// Vérifier l'état du stockage
function checkStorage() {
    console.log("\n=== État du stockage ===");

    if (process.platform === "win32") {
        // Windows → utiliser 'wmic'
        exec("wmic logicaldisk get size,freespace,caption", (err, stdout, stderr) => {
            if (err) {
                console.error("Erreur stockage Windows:", err);
                return;
            }
            console.log(stdout);
        });
    } else {
        // Linux / Android → utiliser 'df'
        exec("df -h /data", (err, stdout, stderr) => {
            if (err) {
                console.error("Erreur lors de la vérification du stockage:", err);
                return;
            }
            console.log(stdout);
        });
    }
}


// Vérifier la mémoire vive
function checkMemory() {
    console.log("\n=== Mémoire RAM ===");
    const free = (os.freemem() / 1024 / 1024).toFixed(2);
    const total = (os.totalmem() / 1024 / 1024).toFixed(2);
    console.log(`Libre : ${free} MB`);
    console.log(`Total : ${total} MB`);
}

// Lancer les vérifications
checkNetwork();
checkStorage();
checkMemory();
