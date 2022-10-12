<template lang="pug">
main.sources
  textarea.urls(ref="urls") example.html
  button.load(@click="load") load
  .book(v-if="bookJson")
    details
      summary intermediary steps
      textarea.text {{ bookText }}
      textarea.tokens {{ rawTokens }}
    p Put the following into book.ts
    textarea.book {{ bookJson }}
    button.prepConfig(@click="prepConfig") prepare config from loaded book
    .config(v-if="configText")
      p Put the following into book text to get you started with defining all your items
      textarea.config {{ configText }}
    //-   p Put the following into vue.config.js
    //-   textarea.config {{ vueConfig }}
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { loadText, log, warn, error } from "../shared/util";
import { TextEntity, Book, Element, ElementType, HasElements, AddItem, } from "../shared/entities";
import Lexer, { Token } from "../Lexer";
import Parser, { ParserError } from "../Parser";

type Parsed = TextEntity & {
  end: number;
};

@Component({
  name: "Sources",
})
export default class Sources extends Vue {
  book?: Book;
  bookText = '';
  rawTokens = '';
  bookJson = '';
  configText = '';

  mounted() {
    (this.$refs.urls! as HTMLTextAreaElement).value = localStorage.urls ?? "";
  }

  async extractText(raw: string, url: string) {
    // HTML?
    if (raw.indexOf("<!DOCTYPE html>") >= 0) {
      const doc = new DOMParser().parseFromString(raw, "text/html").documentElement;
      // Google Docs?
      if (url.indexOf("docs.google.com/document") >= 0 ||
         (doc.querySelector("#footer")?.textContent ?? "").indexOf("Published by Google Drive") >= 0) {
           const root = doc.querySelector("#contents > div")!;
        log("It's Doogle Docs. Root element", root.innerHTML);
        root.innerHTML = root.innerHTML
          .replace(/<p>|<h[\d]>/gi, "")
          .replace(/<br>|<\/p>|<\/h[\d]>/gi, "\n");
        return root.textContent;
      }
      if (doc.querySelector("body")) {
        log("It's plain HTML.");
        return doc.querySelector("body")!.textContent;
      }
      log("It's plain text.");
      return doc.textContent;
    }
  }

  async load() {
    const urlsText = (this.$refs.urls! as HTMLTextAreaElement).value || '/example-book.html';
    const urls = urlsText.split(/\n| /);
    localStorage.urls = (this.$refs.urls! as HTMLTextAreaElement).value;
    log("urls", urls);

    const lexer = new Lexer();
    const tokens: Token[] = (
      await Promise.all(
        urls
          .filter((url) => url && url.trim().length > 0)
          .map(async (url) => {
            log("Loading URL", url);
            const raw = await loadText(url);
            try {
              const text = await this.extractText(raw, url);
              this.bookText += `\n\n${url}:\n${text}`;
              return lexer.tokenize(text!, url)!;
            } catch (e) {
              error(`Failed parsing ${url}`, e?.message, e);
            }
          })
      )
    )
      .flat()
      .filter((token) => token !== null) as Token[];

    console.log("tokens", tokens);
    this.rawTokens = JSON.stringify(tokens, null, " ");
    const parser = new Parser();
    const messages: ParserError[] = [];
    try {
      this.book = parser.parse(tokens);
      log("loaded", this.book);
      const json = JSON.stringify(this.book, null, " ");
      this.bookJson =
`import { Book } from "./shared/entities";\n
const book: Book = ((${json}) as unknown) as Book;\n
export default book;`;
    } catch (error) {
      console.error(error);
      messages.push(error);
    }

    if (messages.length > 0) warn("Errors", messages);
    else log("Parsing successful.");
  }

  prepConfig() {
    if (!this.book) {
      error('Prepare config: book not initialized! Click "load" first.');
    }
    const elements = this.getAllElements(this.book!);
    let text = '';

    // add all items
    elements
      .filter((element) => element.type === ElementType.addItem)
      .forEach((element: Element) => {
        const addItem: AddItem = element as AddItem;
        text += `
// itemdef ${addItem.id} category? mediaType? mediaUrl?
${addItem.id}
Write your item description here, you can use markdown (optional)

Above, category should be a name without spaces, will be used as CSS class (optional)
MediaType can be link, audio, video (optional, required if using URL).
MediaUrl is a link to some website or a media file (optional, depending on mediaType).

// enditemdef
`;
      });

    log("prep config", text);
    this.configText = text;
  }

  test() {
    // each book needs 1+ chapters
    // each chapter needs 1+ sections
    // each if needs 1+ elements
    // each if should be followed by STATE or ITEM
    // each else needs 1+ elements
    // check that all formatting options are closed for each paragraph
    // check that each link has a target
    // check that each section is linked to
    // check if all items of addItem exist (has a itemdef for all items used)
    // check if items exist that are not in an addItem
    // check if all items of removeItem exist
    // check if items exist that are not in a removeItem
    // check if removeItem exist that have not been addItem before
    // credits required?
    // imprint required?
  }

  getAllElements(book: Book): Element[] {
    function findElements(has: HasElements): Element[] {
      const results: Element[] = [];
      has.elements.forEach((element) => {
        results.push(element);
        const a = element as any;
        if (a.elements) {
          results.push(...findElements(a as HasElements));
        }
      });
      return results;
    }
    const elements: Element[] = [];
    book.chapters.forEach((chapter) => {
      chapter.sections.forEach((section) => {
        elements.push(...findElements(section));
      });
    });
    return elements;
  }
}
</script>

<style lang="stylus">
main.sources
  margin auto
  max-width 70em

  &, & .book, & .config
    display flex
    flex-direction column

  textarea
    height 10em
    display block

    &.book
      height 30em
</style>
