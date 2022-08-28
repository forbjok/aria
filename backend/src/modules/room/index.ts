import * as express from "express";

import * as roomserver from "./roomserver";

export function server(...args: any[]) {
  return roomserver.create.apply(null, args);
}
