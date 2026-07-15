const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();

app.use(cors());

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

app.post("/remove-background", upload.single("image"), (req, res) => {

    const imagePath = req.file.path;

    const python = spawn("python", [
        "./ai/remove_background.py",
        imagePath
    ]);

    let result = "";

    python.stdout.on("data", data => {
        result += data.toString();
    });

    python.on("close", () => {
        res.json({
            image: result.trim()
        });
    });

});

app.listen(5000, () => {
    console.log("Server running");
});