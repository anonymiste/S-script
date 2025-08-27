const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const archiver = require("archiver");

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).send("Aucun fichier reçu !");
    console.log(`✅ Fichier reçu : ${req.file.filename}`);
    res.send(`Fichier reçu : ${req.file.filename}`);
});

app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));

app.get("/files", (req, res) => {
    fs.readdir("uploads", (err, files) => {
        if (err) return res.status(500).send("Erreur serveur");
        res.json(files);
    });
});

app.get("/files/:name", (req, res) => {
    const fileName = req.params.name;
    const filePath = path.join("uploads", fileName);
    res.download(filePath);
});


app.get("/download-all", (req, res) => {
    const uploadsDir = path.join(__dirname, "uploads");
    const zipName = "all_images.zip";

    res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    archive.directory(uploadsDir, false);
    archive.finalize();
});

app.get("/gallery", (req, res) => {
    const uploadsDir = path.join(__dirname, "uploads");
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).send("Erreur serveur");

        let images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));

        // Recherche
        const search = req.query.search ? req.query.search.toLowerCase() : null;
        if (search) {
            images = images.filter(img => img.toLowerCase().includes(search));
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const perPage = 20;
        const totalPages = Math.ceil(images.length / perPage);
        const pagedImages = images.slice((page - 1) * perPage, page * perPage);

        // HTML
        let html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Galerie Avancée</title>
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
            <h1>Galerie Avancée</h1>
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

