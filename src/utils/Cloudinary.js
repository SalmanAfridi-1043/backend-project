import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (path) => {
  try {
    if (!path) return null;

    const response = await cloudinary.uploader.upload(path, {
      resource_type: "auto",
    });

    // console.log("File uploaded response : ", response);

    fs.unlinkSync(path);

    return response;
  } catch (error) {
    fs.unlinkSync(path);
    console.log("Cloudinary uploading error : ", error);
    return null;
  }
};

const _extractPublicIdFromUrl = (url) => {
  try {
    if (!url || typeof url !== "string") return null;

    // Parse pathname after '/upload/' and remove version and extension
    const parsed = new URL(url);
    const pathname = parsed.pathname; // e.g. /<cloud>/image/upload/v1234/folder/file.jpg

    const parts = pathname.split("/upload/");
    if (parts.length < 2) return null;

    let afterUpload = parts[1];

    // remove version like v123456/
    afterUpload = afterUpload.replace(/^v\d+\//, "");

    // remove extension
    const publicId = afterUpload.replace(/\.[^.]+$/, "");

    // remove leading slash if present
    return publicId.replace(/^\//, "");
  } catch (error) {
    return null;
  }
};

const deleteFromCloudinary = async (publicIdOrUrl) => {
  try {
    if (!publicIdOrUrl) return null;

    // If a full URL is passed, extract public_id from it
    let publicId = publicIdOrUrl;
    if (
      publicIdOrUrl.startsWith("http") ||
      publicIdOrUrl.includes("cloudinary.com")
    ) {
      const extracted = _extractPublicIdFromUrl(publicIdOrUrl);
      if (!extracted) return null;
      publicId = extracted;
    }

    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return response;
  } catch (error) {
    console.log("Cloudinary delete error :", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
