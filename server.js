const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const archiver = require("archiver");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// --- USERS ---
const users = [
    { username: "anonymiste", password: bcrypt.hashSync("#Paul@26@", 8) }
];

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- WHATSAPP LOGGER ---
async function sendWhatsApp(message) {
    const phone = "22891782947";  // ton numéro
    const apiKey = "1944847";     // ton API Key CallMeBot
    try {
        await axios.get(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`);
        console.log("✅ Message WhatsApp envoyé :", message);
    } catch (err) {
        console.error("❌ Erreur WhatsApp :", err.message);
    }
}

// --- LOGIN ---
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).send("Identifiants invalides");
    }
    const token = jwt.sign({ username }, "SECRET_KEY", { expiresIn: "1h" });
    res.json({ token });
});

// --- AUTHENTICATION ---
function authenticate(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).send("Token manquant");
    const token = authHeader.split(" ")[1];
    jwt.verify(token, "SECRET_KEY", (err, user) => {
        if (err) return res.status(403).send("Token invalide");
        req.user = user;
        next();
    });
}

// --- UPLOADS ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- ROUTES SÉCURISÉES ---

// Upload
app.post("/upload", authenticate, upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).send("Aucun fichier reçu !");
    const logMsg = `[${new Date().toISOString()}] ${req.user.username} a uploadé ${req.file.filename}`;
    console.log(logMsg);
    await sendWhatsApp(logMsg);
    res.send(`Fichier reçu : ${req.file.filename}`);
});

// Lister les fichiers
app.get("/files", authenticate, async (req, res) => {
    fs.readdir(UPLOAD_DIR, async (err, files) => {
        if (err) return res.status(500).send("Erreur serveur");
        const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        const logMsg = `[${new Date().toISOString()}] ${req.user.username} a listé les fichiers`;
        console.log(logMsg);
        await sendWhatsApp(logMsg);
        res.json(images);
    });
});

// Télécharger un fichier
app.get("/files/:name", authenticate, async (req, res) => {
    const fileName = req.params.name;
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).send("Fichier introuvable");
    if (!/\.(jpg|jpeg|png|gif)$/i.test(fileName)) return res.status(400).send("Fichier non autorisé");

    const logMsg = `[${new Date().toISOString()}] ${req.user.username} a téléchargé ${fileName}`;
    console.log(logMsg);
    await sendWhatsApp(logMsg);

    res.download(filePath);
});

// Télécharger toutes les images en ZIP
app.get("/download-all", authenticate, async (req, res) => {
    const zipName = "all_images.zip";
    res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(UPLOAD_DIR, false);
    archive.finalize();

    const logMsg = `[${new Date().toISOString()}] ${req.user.username} a téléchargé toutes les images en ZIP`;
    console.log(logMsg);
    await sendWhatsApp(logMsg);
});

// Galerie avancée
app.get("/gallery", authenticate, async (req, res) => {
    fs.readdir(UPLOAD_DIR, async (err, files) => {
        if (err) return res.status(500).send("Erreur serveur");
        let images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));

        const search = req.query.search ? req.query.search.toLowerCase() : null;
        if (search) images = images.filter(img => img.toLowerCase().includes(search));

        const page = parseInt(req.query.page) || 1;
        const perPage = 20;
        const totalPages = Math.ceil(images.length / perPage);
        const pagedImages = images.slice((page - 1) * perPage, page * perPage);

        const logMsg = `[${new Date().toISOString()}] ${req.user.username} a consulté la galerie, page ${page}, recherche: ${search || 'aucune'}`;
        console.log(logMsg);
        await sendWhatsApp(logMsg);

        let html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Galerie Avancée Sécurisée</title>
            <style>
                body { font-family: Arial; background:#f0f0f0; padding:20px; }
                h1 { text-align:center; }
                .gallery { display:grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap:15px; }
                .item { background:#fff; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1); text-align:center; overflow:hidden; }
                .item img { width:100%; height:200px; object-fit:cover; display:block; }
                .item a { display:inline-block; margin:10px 0; padding:5px 10px; background:#007BFF; color:#fff; text-decoration:none; border-radius:5px; }
                .item a:hover { background:#0056b3; }
                .pagination { text-align:center; margin:20px 0; }
                .pagination a { margin:0 5px; text-decoration:none; color:#007BFF; }
                .pagination a.current { font-weight:bold; color:#000; }
                .search-box { text-align:center; margin-bottom:20px; }
                .search-box input[type=text] { padding:5px; width:200px; }
                .search-box button { padding:5px 10px; }
                .download-all { text-align:center; margin-bottom:20px; }
                .download-all a { padding:10px 15px; background:#28a745; color:#fff; text-decoration:none; border-radius:5px; }
                .download-all a:hover { background:#1e7e34; }
            </style>
        </head>
        <body>
            <h1>Galerie Avancée Sécurisée</h1>
            <div class="download-all"><a href="/download-all">Télécharger toutes les images</a></div>
            <div class="search-box">
                <form method="get">
                    <input type="text" name="search" placeholder="Recherche par nom" value="${search || ''}">
                    <button type="submit">Rechercher</button>
                </form>
            </div>
            <div class="gallery">
        `;

        pagedImages.forEach(img => {
            html += `
                <div class="item">
                    <img src="/uploads/${img}" alt="${img}">
                    <a href="/uploads/${img}" download>Télécharger</a>
                </div>
            `;
        });

        html += `</div><div class="pagination">`;

        for(let i=1; i<=totalPages; i++){
            html += `<a href="/gallery?page=${i}${search ? '&search=' + encodeURIComponent(search) : ''}" class="${i===page?'current':''}">${i}</a>`;
        }

        html += `</div></body></html>`;
        res.send(html);
    });
});

// --- LANCEMENT SERVEUR ---
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
