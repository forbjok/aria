"use strict";

var path = require("path");

var rootDir = path.join(__dirname, "../..");

var config = {
  port: process.env.PORT || 5000,
  uploadsPath: process.env.UPLOADS_PATH || path.join(rootDir, "uploads"),
  dataStore: require("./stores/postgresql")
};

module.exports = config;
