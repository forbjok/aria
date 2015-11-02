export class FormatPostValueConverter {
  toView(value) {
    if (!value) {
      return value;
    }

    /*eslint quotes: 0*/
    return value.replace(/((^|\n)\>.*)/g, '<span class="quote">$1</span>')
      .replace(/\n/g, '<br>');
  }
}
