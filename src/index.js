import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { log } from "console";
import express from "express";
import { errorMonitor } from "events";

dotenv.config();

const app = express();

const port = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log("\nServer is listening on port ", port);
    });
  })
  .catch((error) => {
    console.log("MongoBD connection failed : ", error);
  });
