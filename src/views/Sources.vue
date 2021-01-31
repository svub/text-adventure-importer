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
    .config(v-if="configJson")
      p Put the following into config.ts
      textarea.config {{ configJson }}
      p Put the following into vue.config.js
      textarea.config {{ vueConfig }}
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { State, Mutation } from "vuex-class";
import { loadText, log, warn, error } from "../shared/util";
import {
  TextEntity,
  Book,
  Config,
  Element,
  ElementType,
  HasElements,
  AddItem,
} from "../shared/entities";
import Lexer, { Token } from "../shared/Lexer";
import Parser, { ParserError } from "../shared/Parser";

const dummy = window.location.href.includes("localhost");

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
  configJson = '';
  vueConfigJson = '';

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
    // let book: Book;
    const urls = dummy
      // ? new Array(14).fill(0).map((v, index) => `/test-data${index}.html`)
      ? ['/example.html']
      : (this.$refs.urls! as HTMLTextAreaElement).value!.split(/\n| /);
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
      // (this.$refs
      //   .book! as HTMLTextAreaElement).value = `import { Book } from "./shared/entities";
      //   const book: Book = (${json}) as unknown) as Book;
      //   export default book;`;
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
    const existing = prompt('Paste existing config, leave empty to create a new config');
    const config: Config =
      existing
        ? JSON.parse(existing)
        : {
            items: [],
          };

    const elements = this.getAllElements(this.book!);

    // add all items
    elements
      .filter((element) => element.type === ElementType.addItem)
      .forEach((element: Element) => {
        const addItem: AddItem = element as AddItem;
        if (!config.items.find((item) => item.id === addItem.id)) {
          config.items.push({
            id: addItem.id,
            title: addItem.id,
            thumbnail: "URL to thumbnail file",
            media: "URL to media file",
            description: "Longer description text for this item (optional)",
            category: "Category (optional)",
          });
        }
      });

    // this.setConfig({ config });
    // this.config = config;
    log("prep config", config);
    const configJson = JSON.stringify(config, null, " ");
    // (this.$refs.config! as HTMLTextAreaElement).value = `export default ${configJson};`;
    this.configJson = `export default ${configJson};`;

    // (this.$refs.vueConfig! as HTMLTextAreaElement).value = `// vue.config.js
    //   module.exports = {
    //     chainWebpack: config => {
    //       config
    //         .plugin('html')
    //         .tap(args => {
    //             args[0].title = "${this.book.title}";
    //             return args;
    //         });
    //     }
    //   }`;
    this.vueConfigJson =
`// vue.config.js
module.exports = {
  chainWebpack: config => {
    config
      .plugin('html')
      .tap(args => {
          args[0].title = "${this.book.title}";
          return args;
      });
  }
}`;
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
    // check if all items of addItem exist
    // check if items exist that are not in an addItem
    // check if all items of removeItem exist
    // check if items exist that are not in a removeItem
    // check if removeItem exist that have not been addItem before
    // credits required
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
