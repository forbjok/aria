import moment from "moment";

export class FormatTimeValueConverter {
  toView(value: string): string {
    const now = moment();
    const time = moment(value);

    if (now.isSame(time, "day")) {
      // If time is today, omit the date
      return time.format("HH:mm:ss");
    } else if (now.isSame(time, "year")) {
      // If time is not today, but this year, include date without year
      return time.format("MMM Do, HH:mm:ss");
    }

    // If time is not this year, include full date with year
    return time.format("MMM Do YYYY, HH:mm:ss");
  }
}
