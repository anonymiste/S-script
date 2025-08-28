const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const archiver = require("archiver");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "SECRET_KEY";

// --- USERS ---
const users = [
    { username: "anonymiste", password: bcrypt.hashSync("#Paul@26@", 8) }
];

// --- CONFIG ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // SPA page + assets
app.use("/uploads", express.static(UPLOAD_DIR));

// --- AUTH ---
function authenticate(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "Token manquant" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Token invalide" });
        req.user = user;
        next();
    });
}

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: "Identifiants invalides" });

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
});

// --- MULTER UPLOAD ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- ROUTES SPA ---
app.post("/upload", authenticate, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu !" });
    res.json({ file: req.file.filename });
});

app.get("/files", authenticate, (req, res) => {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
    res.json(files);
});

app.get("/files/:name", (req, res) => {
    const token = req.query.token || req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).send("Token manquant");

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).send("Token invalide");
        const fileName = req.params.name;
        const filePath = path.join(UPLOAD_DIR, fileName);
        if (!fs.existsSync(filePath)) return res.status(404).send("Fichier introuvable");
        res.sendFile(filePath);
    });
});


app.get("/download-all", (req, res) => {
    const token = req.query.token || req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).send("Token manquant");

    jwt.verify(token, SECRET_KEY, (err) => {
        if (err) return res.status(403).send("Token invalide");
        const zipName = "all_images.zip";
        res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
        res.setHeader('Content-Type', 'application/zip');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        archive.directory(UPLOAD_DIR, false);
        archive.finalize();
    });
});

// Route pour supprimer tous les fichiers
app.post("/delete-all", (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) return res.status(500).send("Erreur serveur");

        files.forEach(file => {
            const filePath = path.join(UPLOAD_DIR, file);
            fs.unlink(filePath, err => {
                if (err) console.error("Erreur suppression :", filePath);
            });
        });

        res.send("✅ Tous les fichiers ont été supprimés !");
    });
});


// --- LANCEMENT SERVEUR ---
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
