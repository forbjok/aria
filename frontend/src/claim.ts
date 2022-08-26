import {autoinject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import { Router } from "aurelia-router";

import {LocalRoomAuthService} from "./services/localroomauthservice";
import { State } from "state";

import "styles/claim.less";

@autoinject
export class Claim {
  public claimError: string;
  public claimInfo: ClaimInfo;

  constructor(
    private http: HttpClient,
    private auth: LocalRoomAuthService,
    private state: State,
    private router: Router,
  ) {
    this.auth = auth;
  }

  activate(params: { roomName: string }) {
    if (!this.state.roomName) {
      this.router.navigateToRoute('room', params);
    }
  }

  claim() {
    console.log('DO CLAIM', this.state.roomName);

    return this.http.fetch(`/api/r/${this.state.roomName}/claim`, {
      method: "POST",
      headers: {
        "Accept": "application/json"
      }
    }).then((response) => {
      if (!response.ok) {
        this.claimError = response.statusText;
      }

      response.json().then((data: ClaimInfo) => {
        this.claimInfo = data;
        this.auth.set(data.token);
      });
    });
  }

  reload() {
    // Reload page
    window.location.reload();
  }
}
