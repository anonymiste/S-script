const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).send("Aucun fichier reçu !");
    console.log(`✅ Fichier reçu : ${req.file.filename}`);
    res.send(`Fichier reçu : ${req.file.filename}`);
});

app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
