import * as express from "express";

import * as chatserver from "./chatserver";

export function server(...args: any[]) {
  return chatserver.create.apply(null, args);
}

export function store(storeType: string, ...args: any[]) {
  let store = require("./stores/" + storeType);

  return store.create.apply(store, args);
}
