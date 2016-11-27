import * as express from "express";

export default function vary(): express.Handler {
  return (req: express.Request, res: express.Response, next: express.NextFunction): any => {
    res.header("Vary", "Accept-Encoding");
    next();
  }
}
