import express from "express";
import path from "path";

import { clerkMiddleware } from "@clerk/express";
import { ENV } from "./config/env.js";
import { connect } from "http2";
import { connectDB } from "./config/db.js";

const app = express();
app.use(clerkMiddleware());

const __dirname = path.resolve();

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../admin/dist")));

  // ready for deployment
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../admin", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
  });
};

startServer();
