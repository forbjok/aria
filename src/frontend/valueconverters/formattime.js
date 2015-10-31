import moment from "moment";

export class FormatTimeValueConverter {
  toView(value) {
    return moment(value).format("hh:mm:ss a");
  }
}
