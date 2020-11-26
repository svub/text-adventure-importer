<template lang="pug">
main.sources
  textarea.urls(ref="urls")
    | https://docs.google.com/document/d/e/2PACX-1vRvBU8wGqFOEdnXAwQq618pk3oLmdofNJj2f4AvNmyl6wzz7vspLekZF95G_n2iXtPIjP6yMcHs4rw9/pub
    | https://docs.google.com/document/d/e/2PACX-1vQ_56Jw7HG3h6HuJ9q50w-wqyasNixc1o9yyiOhxjAnHtmgl53aKi1Z5WWZR1JdfOEXhkajBhvD2XoK/pub
  button.load(@click="load") load
  textarea.text(ref="text")
  textarea.tokens(ref="tokens")
  textarea.book(ref="book")
</template>

<script lang="ts">
  import { Component, Vue, Prop } from 'vue-property-decorator';
  import { State, Action } from 'vuex-class';
  import { loadText, log, warn } from '../shared/util';
  import { TextEntity, Book } from "../shared/entities";
  import Lexer from "../shared/Lexer";
  import Parser from "../shared/Parser";

  const dummy = window.location.href.includes('localhost');

type ParserMessage = {
    line: number;
    type: ["error", "warning"];
    error: any;
  };

  type Parsed = TextEntity & {
    end: number;
  };

  @Component({
    name: 'Sources',
  })
  export default class Sources extends Vue {
    // const textareas = { urls: ref(null), text: ref(null), tokens: ref(null), book: ref(null) }

    async load() {
      let book: Book;
      const urls = dummy
        ? ['/test-data1.html', '/test-data2.html']
        : (this.$refs.urls! as HTMLTextAreaElement).value!.split("\n");
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
      const messages: ParserMessage[] = [];
      try {
        book = parser.parse(tokens);
        log('load', book);
        (this.$refs.book! as HTMLTextAreaElement).value = `export default ${JSON.stringify(book, null, ' ')};`;
      } catch (parserMessages) {
        messages.push(...parserMessages);
      }

      if (messages.length > 0)
        warn("Errors", messages);
      else
        log("Parsing successful.");
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
