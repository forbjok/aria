import {autoinject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {State} from "./state";
import {LocalRoomAuthService} from "./services/localroomauthservice";

@autoinject
export class Claim {
  private roomName: string;

  public claimError: string;
  public claimInfo: ClaimInfo;

  constructor(
    private http: HttpClient,
    private auth: LocalRoomAuthService,
    private state: State)
  {
    this.auth = auth;
    this.roomName = state.roomName;
  }

  claim() {
    return this.http.fetch(`/r/${this.roomName}/claim`, {
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
