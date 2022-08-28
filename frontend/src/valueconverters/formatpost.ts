import * as xssFilters from "xss-filters";

export class FormatPostValueConverter {
  toView(value: string): string {
    if (!value) {
      return value;
    }

    return xssFilters
      .inHTMLData(value)
      .replace(/((^|\n)>.*)/g, '<span class="quote">$1</span>') // Color quotes
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>') // Clickable links
      .replace(/\n/g, "<br>"); // Convert newlines to HTML line breaks
  }
}
