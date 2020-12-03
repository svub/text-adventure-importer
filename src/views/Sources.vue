<template lang="pug">
main.sources
  textarea.urls(ref="urls")
  button.load(@click="load") load
  details
    summary intermediary steps
    textarea.text(ref="text")
    textarea.tokens(ref="tokens")
  textarea.book(ref="book")
  button.prepConfig(@click="prepConfig") prepare config from loaded book
  textarea.config(ref="config")
</template>

<script lang="ts">
  import { Component, Vue } from 'vue-property-decorator';
  import { State, Mutation } from 'vuex-class';
  import { error, loadText, log, warn } from '../shared/util';
  import { TextEntity, Book, Config, Element, ElementType, HasElements, AddItem } from "../shared/entities";
  import Lexer from "../shared/Lexer";
  import Parser, { ParserError } from "../shared/Parser";

  const dummy = window.location.href.includes('localhost');

  type Parsed = TextEntity & {
    end: number;
  };

  @Component({
    name: 'Sources',
  })
  export default class Sources extends Vue {

    @Mutation setBook!: Function;
    @Mutation setConfig!: Function;
    @State config?: Config;
    @State book?: Book;

    mounted() {
      (this.$refs.urls! as HTMLTextAreaElement).value = localStorage.urls ?? '';
    }

    async load() {
      // let book: Book;
      const urls = dummy
        ? ['/test-data1.html', '/test-data2.html']
        : (this.$refs.urls! as HTMLTextAreaElement).value!.split(/\n| /);
      localStorage.urls = (this.$refs.urls! as HTMLTextAreaElement).value;
      console.log(urls);

      const text = (await Promise.all(urls.map(async (url) => {
        console.log(url);
        const raw = await loadText(url);
        // HTML?
        try {
          if (raw.indexOf('<!DOCTYPE html>') >= 0) {
            console.log('HTML');
            const doc = new DOMParser().parseFromString(raw, "text/html").documentElement;
            // console.log(doc);
            console.log(doc.querySelector('#footer')!.textContent!);
            // Google Docs?
            if ((url.indexOf('docs.google.com/document') >= 0) ||
              (doc.querySelector('#footer')!.textContent!.indexOf('Published by Google Drive') >= 0)) {
              console.log('GDocs');
              const root = doc.querySelector('#contents > div')!;
              console.log(root);
              root.innerHTML = root.innerHTML.replace(/<p>|<h[\d]>/gi, "").replace(/<br>|<\/p>|<\/h[\d]>/gi, "\n");
              return root.textContent;
            }
            if (doc.querySelector('body')) {
              console.log('body');
              return doc.querySelector('body')!.textContent;
            }
            return doc.textContent;
          }
        } catch (error) {
          console.error(`Failed parsing ${url}`, error);
        }
        return raw;
      }))).join("\n");
      // console.log('text',text);
      (this.$refs.text! as HTMLTextAreaElement).value = text;

      const lexer = new Lexer();
      const tokens = lexer.tokenize(text);
      console.log('tokens', tokens);
      (this.$refs.tokens! as HTMLTextAreaElement).value = JSON.stringify(tokens, null, ' ');
      const parser = new Parser();
      const messages: ParserError[] = [];
      try {
        this.setBook({ book: parser.parse(tokens) });
        log('loaded', this.book);
        (this.$refs.book! as HTMLTextAreaElement).value = `export default ${JSON.stringify(this.book, null, ' ')};`;
      } catch (error) {
        console.error(error);
        messages.push(error);
      }

      if (messages.length > 0)
        warn("Errors", messages);
      else
        log("Parsing successful.");
    }

    prepConfig() {
      if (!this.book) {
        error('Prepare config: book not initialized! Click "load" first.');
      }
      const config: Config = this.config && window.confirm('Extend existing config from loaded book? (Cancel = create new)')
        ? this.config
        : {
          items: [],
        };

      const elements = this.getAllElements(this.book!);

      // add all items
      elements
        .filter(element => element.type === ElementType.addItem)
        .forEach((element: Element) => {
          const addItem: AddItem = element as AddItem;
          if (!config.items.find(item => item.id === addItem.id)) {
            config.items.push({
              id: addItem.id,
              title: addItem.id,
              thumbnail: 'URL to thumbnail file',
              media: 'URL to media file',
              category: 'category (optional)',
            });
          }
        });

      this.setConfig({ config });
      log('prep config', this.config);
      (this.$refs.config! as HTMLTextAreaElement).value = `export default ${JSON.stringify(this.config, null, ' ')};`;
    }

    test() {
      // each book needs 1+ chapters
      // each chapter needs 1+ sections
      // each if needs 1+ elements
      // each else needs 1+ elements
      // check that all formatting options are closed for each paragraph
      // check that each link has a target
      // check that each section is linked to
      // check if all items of addItem exist
      // check if items exist that are not in an addItem
      // check if all items of removeItem exist
      // check if items exist that are not in a removeItem
      // check if removeItem exist that have not been addItem before
    }

    getAllElements(book: Book): Element[] {
      function findElements(has: HasElements): Element[] {
        const results: Element[] = [];
        has.elements.forEach(element => {
          results.push(element);
          const a = element as any;
          if (a.elements) {
            results.push(...findElements(a as HasElements));
          }
        });
        return results;
      }
      const elements: Element[] = [];
      book.chapters.forEach(chapter => {
        chapter.sections.forEach(section => {
          elements.push(...findElements(section));
        })
      });
      return elements;
    }
  }

</script>

<style lang="stylus">
main.sources
  display flex
  flex-direction column
  margin auto
  max-width 70em

  textarea
    height 10em

    &.book
      height 30em
</style>
