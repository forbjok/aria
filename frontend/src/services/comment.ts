import { h, type VNode, type VNodeArrayChildren } from "vue";
import * as P from "parsimmon";

import Emote from "@/components/Emote.vue";

import type { RoomInfo } from "@/models";

export class CommentParser {
  constructor(private room: RoomInfo) {}

  /// Parse comment string and generate Vue VNode
  public parseComment(comment: string): VNode {
    const rootNodes: VNodeArrayChildren = [];
    let spoilerNodes: VNodeArrayChildren = [];

    let nodes = rootNodes;
    let text = "";
    let inSpoiler = false;

    const addText = (_text: string) => {
      text += _text;
    };

    const flushText = () => {
      if (text.length > 0) {
        nodes.push(h("span", {}, text));
        text = "";
      }
    };

    const addEmote = (text: string) => {
      const name = text.substring(1);
      const emote = this.room.emotes[name];
      if (!emote) {
        addText(text);
        return;
      }

      flushText();
      nodes.push(h(Emote, { emote }));
    };

    const addQuote = (text: string) => {
      flushText();
      nodes.push(h("span", { class: "quote" }, text));
    };

    const addQuoteLink = (text: string) => {
      flushText();
      nodes.push(h("a", { class: "quotelink", href: `#p${text.substring(2)}` }, text));
    };

    const addLink = (text: string) => {
      flushText();
      nodes.push(h("a", { href: text }, text));
    };

    const beginSpoiler = () => {
      flushText();
      nodes = spoilerNodes;
      inSpoiler = true;
    };

    const endSpoiler = () => {
      if (!inSpoiler) {
        return;
      }

      flushText();
      rootNodes.push(h("s", {}, spoilerNodes));
      spoilerNodes = [];
      nodes = rootNodes;
      inSpoiler = false;
    };

    const addNewLine = () => {
      flushText();
      nodes.push(h("br"));
    };

    const commentParser = P.createLanguage({
      comment: (r) =>
        P.alt(
          r.spoilerOpen,
          r.spoilerClose,
          r.emote,
          r.quotelink,
          r.quote,
          r.link,
          r.text,
          r.newline,
          r.whitespace
        ).many(),
      spoilerOpen: () => P.string("[spoiler]").map(beginSpoiler),
      spoilerClose: () => P.string("[/spoiler]").map(endSpoiler),
      emote: () => P.regexp(/!([\w\d]+)/).map(addEmote),
      quotelink: () => P.regexp(/>>(\d+)/).map(addQuoteLink),
      quote: () => P.regexp(/>([^\n]+)/).map(addQuote),
      link: () => P.regexp(/(https?:\/\/[^\s]*)/).map(addLink),
      text: () => P.regexp(/[^\s]+?/).map(addText),
      newline: () => P.regexp(/\n/).map(addNewLine),
      whitespace: () => P.regexp(/[^\S\n]+/).map(addText),
    });

    try {
      commentParser.comment.tryParse(comment);

      flushText();
      endSpoiler();
    } catch {
      // Fall back to including the comment in plain text
      // if parsing fails.
      nodes = [comment];
    }

    return h("div", { class: "comment" }, rootNodes);
  }
}