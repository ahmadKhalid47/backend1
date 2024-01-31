const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 8080;
const multer = require("multer");

app.use(cors());
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: "dcdynkm5d",
  api_key: "157745433978489",
  api_secret: "AqvKiU623z4vCZStGiBvBgk-2vQ",
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "upload",
    format: async (req, file) => "png",
  },
});

const upload = multer({
  storage: storage,
});

app.post("/upload", upload.single("image"), async (req, res) => {
  console.log("one");
  const result = await cloudinary.uploader.upload(req.file.path);
  console.log(result.secure_url);
  res.json({ image: result.secure_url });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
