import * as express from "express";

import * as chatserver from "./chatserver";

export function server(...args: any[]) {
  return chatserver.create.apply(null, args);
}
