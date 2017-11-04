import {Aurelia} from 'aurelia-framework';

import {State} from "./state";

export function configure(aurelia: Aurelia) {
  aurelia.use
    .standardConfiguration()
    .developmentLogging();

  // Uncomment the line below to enable animation.
  // aurelia.use.plugin('aurelia-animator-css');

  // Anyone wanting to use HTMLImports to load views, will need to install the following plugin.
  // aurelia.use.plugin('aurelia-html-import-template-loader')

  aurelia.start().then(a => {
    let attributes: any = a.host.attributes;

    let start = attributes.start.value;

    let state = new State();
    state.roomName = attributes.room.value;
    aurelia.use.instance(State, state);
    
    a.setRoot(start);
  });
}
