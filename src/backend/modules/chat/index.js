"use strict";

module.exports = {
  server: require("./chatserver").server,
  store: function(storeType) {
    let store = require("./stores/" + storeType);
    let storeArgs = Array.prototype.slice.call(arguments, 1);

    return store.create.apply(store, storeArgs);
  }
}
