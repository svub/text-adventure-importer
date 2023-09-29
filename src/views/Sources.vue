<template lang="pug">
main.sources
  p. 
    Add links to your annotated text files below &mdash; 
    can be plain text, HTML or a published Google Doc &mdash; order matters!
  textarea.urls(v-model="sources") example.html
  p Open the console (press F12) to see what the system is working on.
  button.load(@click="loadText") load
  .book(v-if="bookJson")
    details
      summary intermediary steps
      p Raw text
      textarea.text {{ bookText }}
      p Tokens
      textarea.tokens {{ rawTokens }}

    p Put the following into book.ts
    textarea.book {{ bookJson }}

    button.prepConfig(@click="prepConfig") prepare config from loaded book
    .config(v-if="configText")
      p Put the following into book text to get you started with defining all your items
      textarea.config {{ configText }}

    p 
      | Azure key, region, and voice for creating text-to-speech audio: 
      br
      input.azureKey(type="text" v-model="azureKey")
      input.azureRegion(type="text" v-model="azureRegion")
      input.azureVoice(type="text" v-model="azureVoice")
      br
      | To also read out the decisions, enter the text to be spoken before reading the decisions 
      | (two fields: first for decision with only one option, second for two or more) 
      | and then the word or phrase to be spoken between each option:
      br
      input.decisionIntroSingle(type="text" v-model="decisionIntroSingle")
      input.decisionIntro(type="text" v-model="decisionIntro")
      input.decisionConjunction(type="text" v-model="decisionConjunction")
      br
      | The audio files will be zipped so you can download then. 
      | Maximum MB per ZIP before creating another ZIP to continue.
      br
      input.maxMBytes(type="text" v-model.number="maxMBytesPerZip")
      br
      | For testing, you can limit how many ZIP files should be created. Zero for unlimited.
      br
      input.synthesisLimit(type="text" v-model.number="synthesisLimit")
      br
      | Replacement map: if the audio for some words sounds strange, Go to Azure Speech Studio to test if you can find 
      | a different spelling that sounds good. When you do, add the replacements here in following form: 
      | Original &gt;&gt;&gt; Replacement. The replacement will be used to generate the audio.
      br
      textarea.replacements(type="text" v-model.number="replacements")
      br
      | The system will continue in case it failed half way before. 
      | Clear this field to make the process start from scratch.
      br
      input.synthesisProgress(type="text" v-model.number="synthesisProgress")
    button.prepAudio(@click="generateAudio") generate text-to-speech audio for this book
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { mapFields } from 'vuex-map-fields';
import { flattenDeep } from 'lodash';
import JSZip from 'jszip';
import { loadText, log, warn, error } from "../shared/util";
import { Book, Element, ElementType, AddItem, Paragraph } from "../shared/entities";
import Lexer, { Token } from "../Lexer";
import Parser, { ParserError } from "../Parser";
import { TextAndFilename, createSynthesizer, synthesizeAudio } from '@/util/audio';
import { downloadFile, getAllElements } from '@/util/util';

@Component({
  name: "Sources",
  computed: {
    ...mapFields(['sources',
      'azureKey', 'azureRegion', 'azureVoice',
      'decisionIntroSingle', 'decisionIntro', 'decisionConjunction',
      'maxMBytesPerZip', 'replacements',
      'synthesisProgress', 'synthesisLimit',]),
  },
})
export default class Sources extends Vue {
  book?: Book;
  bookText = '';
  rawTokens = '';
  bookJson = '';
  configText = '';
  public sources!: string;
  public azureKey!: string;
  public azureRegion!: string;
  public azureVoice!: string;
  public decisionIntroSingle!: string;
  public decisionIntro!: string;
  public decisionConjunction!: string;
  public maxMBytesPerZip!: number;
  public replacements!: string;
  public synthesisProgress!: number;
  public synthesisLimit!: number;

  // mounted() { }

  async extractText(raw: string, url: string) {
    // HTML?
    if (raw.indexOf("<!DOCTYPE html>") >= 0) {
      const doc = new DOMParser().parseFromString(raw, "text/html").documentElement;
      // Google Docs?
      if (url.indexOf("docs.google.com/document") >= 0 ||
        (doc.querySelector("#publish-banner-text")?.textContent ?? "").indexOf("Published using Google Docs") >= 0) {
        const root = doc.querySelector("#contents > div")!;
        log("It's Google Docs. Root element:", root.innerHTML);
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

  async loadText() {
    const urlsText = this.sources ?? '/example-book.html';
    const urls = urlsText.split(/\n| /);
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
              error(`Failed parsing ${url}`, (e as any)?.message, e);
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
      messages.push(error as ParserError);
    }

    if (messages.length > 0) warn("Errors", messages);
    else log("Parsing successful.");
  }

  prepConfig() {
    if (!this.book) {
      error('Prepare config: book not initialized! Click "load" first.');
    }
    const elements = getAllElements(this.book!).map(ref => ref.element);
    let text = '';

    // add all items
    elements
      .filter((element) => element.type === ElementType.addItem)
      .forEach((element: Element) => {
        const addItem: AddItem = element as AddItem;
        text += `
// itemdef ${addItem.id} category? mediaType? mediaUrl?
${addItem.id}
This will be the headine of your item.

Here, you can write a description - markdown is enabled. This descriptive text is optional.
About the parameters in the first line: 
Category should be a name without spaces, it will be used as CSS class for the time, (optional)
MediaType can be 'link', 'audio', or 'video' (optional, required if using URL).
MediaUrl is a link to some website or a media file (optional, depending on mediaType).

// enditemdef
`;
      });

    log("prep config", text);
    this.configText = text;
  }

  async generateAudio() {
    if (!this.book) {
      error('Prepare config: book not initialized! Click "load" first.');
    }

    const paragraphs = getAllElements<Paragraph>(this.book, ElementType.paragraph)
      .map(ref => {
        const text = ref.element.text
          .replace(/<p>|<h[\d]>|<em>|<\/em>/gi, "")
          .replace(/<br>|<\/p>|<\/h[\d]>/gi, "\n")
          .replace(/&nbsp;/gi, " ");
        const filename = `${ref.chapterId}-${ref.sectionId}-paragraph-${ref.element.id}.mp3`;
        return { text, filename };
      });
    const totalLength = paragraphs.reduce((sum, ref) => sum + ref.text.length, 0);
    console.log('Total number of paragraphs', paragraphs.length, '; of characters', totalLength);

    const decisionsAndHeadings: TextAndFilename[] = flattenDeep(this.book.chapters.map(chapter => {
      return chapter.sections.map(section => {
        const entries: TextAndFilename[] = [];
        if (this.decisionIntro) {
          const intro = section.next.length > 1 ? this.decisionIntro : this.decisionIntroSingle;
          const choices = section.next.map(link => link.title);
          const text = `${intro}\n${choices.join(`\n${this.decisionConjunction}\n`)}`;
          const filename = `${chapter.id}-${section.id}-decision.mp3`;
          entries.push({ text, filename });
        }
        const text = section.title;
        const filename = `${chapter.id}-${section.id}-title.mp3`;
        entries.push({ text, filename });
        return entries;
      });
    }));
    console.log('decisions and headings', decisionsAndHeadings.length);

    const replacements = this.replacements.split("\n")
      .map(line => line.split(">>>"))
      .map(line => [line[0].trim(), line[1].trim()]);

    async function saveZip(zip: JSZip, filename: string) {
      const zipFile = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipFile, filename);
    }

    // example voices "de-DE-KillianNeural" "de-DE-ChristophNeural"
    const synthesizer = createSynthesizer(this.azureKey, this.azureRegion, this.azureVoice);
    const maxPerZip = this.maxMBytesPerZip * 1024 * 1024;
    let currentSize = 0;
    let zip = new JSZip();
    let counter = 0;
    const texts = [...paragraphs, ...decisionsAndHeadings];
    console.log('Total number of characters', texts.reduce((sum, ref) => sum + ref.text.length, 0));

    for (const [index, ref] of texts.entries()) {
      if (this.synthesisProgress > 0 && this.synthesisProgress > index) continue; // skip forward
      try {
        let text = ref.text;
        replacements.forEach(replace => text = text.replaceAll(replace[0], replace[1]));
        const result = await synthesizeAudio(text, synthesizer);
        console.log(`${index}/${texts.length}`, ref.filename, result.message);
        zip.file(ref.filename, result.data);
        currentSize += result.data.byteLength;
        if (currentSize > maxPerZip) {
          await saveZip(zip, `${this.book.title}-${this.azureVoice}-audio-files-${counter}.zip`);
          zip = new JSZip();
          currentSize = 0;
          counter++;
          this.synthesisProgress = index;
        }
      } catch (e) {
        console.error(`${index}/${texts.length}`, ref.filename, e);
        continue;
      }
      if (this.synthesisLimit > 0 && counter >= this.synthesisLimit) break;
    }

    if (currentSize > 0) {
      await saveZip(zip, `${this.book.title}-${this.azureVoice}-audio-files-${counter}.zip`);
    }
    synthesizer.close();
  }

  validate() {
    // TODO automatically validate the book to avoid typos and logic errors
    // each book needs 1+ chapters
    // each chapter needs 1+ sections
    // each if needs 1+ elements
    // each if should be followed by STATE or ITEM
    // each else needs 1+ elements
    // check that all formatting options are closed for each paragraph
    // check that each link has a target
    // check that each section is linked to (no orphans)
    // check that all items for addItem exist (has an itemdef for all items used)
    // check if items exist that are not in an addItem (no orphans)
    // check if all items of removeItem exist
    // check if items exist that are not in a removeItem (could be, but print hint to spot possible mistakes)
    // check if removeItem exist that have not been addItem before (potential logic error)
    // check if all audio files are downloaded if TTS is enabled
    // credits required?
    // imprint required?
  }
}
</script>

<style lang="stylus">
main.sources
  margin auto
  max-width 70em

  &, & .book, & .config, & details
    display flex
    flex-direction column
    > *
      width 100%

  textarea
    height 10em
    width 100%
    display block

    &.book
      height 20em
</style>