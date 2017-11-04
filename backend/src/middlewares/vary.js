"use strict";
function vary() {
    return (req, res, next) => {
        res.header("Vary", "Accept-Encoding");
        next();
    };
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = vary;
