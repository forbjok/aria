import * as express from "express";

import * as roomserver from "./roomserver";

export function server(...args: any[]) {
  return roomserver.create.apply(null, args);
}

export function store(storeType: string, ...args: any[]) {
  let store = require("./stores/" + storeType);

  return store.create.apply(store, args);
}
