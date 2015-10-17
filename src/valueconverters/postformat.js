export class PostFormatValueConverter {
  toView(value) {
    if (!value)
      return value;

    return value.replace(/((^|\n)\>.*)/g, '<span class="quote">$1</span>')
      .replace(/\n/g, '<br>');
  }
}
