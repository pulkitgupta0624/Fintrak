import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Env } from "./env.config.ts";
import streamifier from "streamifier";

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: Env.CLOUDINARY_CLOUD_NAME,
  api_key: Env.CLOUDINARY_API_KEY,
  api_secret: Env.CLOUDINARY_API_SECRET,
});

// ================= MULTER MEMORY STORAGE =================
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => {
    const isValid = /^image\/(jpe?g|png)$/.test(file.mimetype);

    if (!isValid) {
      return cb(new Error("Only JPG and PNG images are allowed"));
    }

    cb(null, true);
  },
});

// ================= CLOUDINARY UPLOAD HELPER =================
export const uploadToCloudinary = (
  buffer: Buffer,
  folder = "images"
) => {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        quality: "auto:good",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url || "");
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};
