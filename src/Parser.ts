import { Book, Chapter, Section, ElementType, Paragraph, If, Else, HasElements, Link, ChangeState, AddItem, RemoveItem,
  SpecialLink, Style, Specials, Option, Config, Item, MediaType, Choice, FeedbackMode } from './shared/entities';
import { Token, TokenType } from './Lexer';
import { Functions } from './shared/entities';
import { parseBool } from './shared/util';
import showdown from 'showdown';

export enum CommandType {
  book = 'book',
  chapter = 'chapter',
  section = 'section',
  if = 'if',
  else = 'else',
  endif = 'endif',
  item = 'item',
  state = 'state',
  next = '>',
  jump = '>>',
  special = '<',
  comment = '#',
  style = 'style',
  endstyle = 'endstyle',
  credits = 'credits',
  itemDefinition = 'itemdef',
  endItemDefinition = 'enditemdef',
  option = 'option',
  choice = 'choice',
  endoption = 'endoption',
  feedback = 'feedback',
  language = 'language',
  pageScrollUpDelay = 'pagescrollupdelay',
}

export type Command = {
  type: string;
  fields: string[];
  line: number;
  url?: string;
};

export class ParserError extends Error {
  token?: Token;
  index?: number;

  constructor(message: string, token?: Token, index?: number) {
    super(message);
    this.token = token;
    this.index = index;
  }
}

const converter = new showdown.Converter();
converter.setOption('simpleLineBreaks', true)
converter.setOption('openLinksInNewWindow', true)
function parseMarkdown(text: string): string {
    return converter.makeHtml(text);
}

export default class Parser {
  position = 0;

  reset() {
    this.position = 0;
  }

  parse(tokens: Token[]): Book {
    let book: Book | null = null;
    let chapter: Chapter | null = null;
    let section: Section | null = null;
    let ifElement: If | null = null;
    let elseElement: Else | null = null;
    let styleElement: Style | null = null;
    let itemDefinition: Item | null = null;
    let option: Option | null = null;
    // let specials: Chapter = {
    //   id: '__specials__',
    //   title: 'Special Sections',
    //   sections: [],
    // };
    const getTitle = (command: Command): string => {
      const next = tokens[this.position + 1];
      if (next.type !== TokenType.paragraph) {
        this.error('Book needs a title as text after // book command', next, this.position + 1, command, next);
      }
      this.position++;
      return next.data;
    }
    const topContainer = (token: Token, index?: number, command?: Command): HasElements => {
      /* TODO: this is not working for recursion.
        There should be a list of elements representing the depth in the tree and
        then a push/pop technique to add a layer and remove one - only this way, there can be an infinite amount
        of recursion, e.g. an if with a style inside and then another if inside.
        If changed, needs to be changed further down, e.g.
        section!.elements.push(ifElement);
        needs to be changed to
        topContainer()... */
      const element = ([itemDefinition, styleElement, elseElement, ifElement, section].find(e => e !== null));
      if (!element) {
        if (command)
          this.error(`Found a "// ${command.type}" before first container`, token, index, command);
        else
          this.error('Found text before first container', token, index);
        }
      return element!;
    }

    if (tokens.length < 1) {
      this.error('No tokens', null);
    }

    do {
      const token = tokens[this.position];

      if (token.type === TokenType.command) {
        const command = this.parseCommand(token, this.position);
        switch (command.type) {

          // book
          // <title>
          case CommandType.book:
            if (book) this.error('Found a second "// book" command. Not allowed.', token, this.position, book, command);
            book = {
              title: getTitle(command),
              chapters: [],
              specials: {},
              config: {
                items: [],
                options: [],
                feedbackMode: {
                  enabled: false,
                },
                language: 'en',
              }
            };
            break;

          // chapter <id>
          // <title>
          case CommandType.chapter:
            if (!book) this.error('Found a "// chapter" before "// book"', token, this.position, command);
            chapter = {
              id: command.fields[0],
              title: getTitle(command),
              sections: [],
            };
            book!.chapters.push(chapter);
            break;

          // section <id>
          // <title>
          case CommandType.section:
            if (!chapter) this.error('Found a "// section" before first "// chapter"', token, this.position, command);
            section = {
              id: command.fields[0],
              title: getTitle(command),
              elements: [],
              next: [],
            };
            chapter!.sections.push(section);
            break;

            // > <sectionId>
          case CommandType.next:
            if (!chapter) this.error('Found a "// >" before first "// chapter"', token, this.position, command);
            if (!section) this.error('Found a "// >" before first "// section"', token, this.position, command);
            const link: Link = {
              title: command.fields.slice(1).join(' '),
              chapterId: chapter!.id, // same chapter link
              sectionId: command.fields[0],
            };
            // TODO: allow commands to be attached to jumps somehow, i.e. do X when jumping
            section!.next.push(link);
            break;

          // >> <chapterId> <sectionId>
          case CommandType.jump:
            if (!chapter) this.error('Found a "// >>" before first "// chapter"', token, this.position, command);
            if (!section) this.error('Found a "// >>" before first "// section"', token, this.position, command);
            const jump: Link = {
              title: command.fields.slice(2).join(' '),
              chapterId: command.fields[0], // cross chapter link
              sectionId: command.fields[1],
            };
            // TODO: allow commands to be attached to jumps somehow, i.e. do X when jumping
            section!.next.push(jump);
            break;

          // < <functionId>
          // OR
          // < share <data>
          case CommandType.special:
            if (!chapter) this.error('Found a "// <" before first "// chapter"', token, this.position, command);
            if (!section) this.error('Found a "// <" before first "// section"', token, this.position, command);
            const id = command.fields.shift()!;
            if (!Specials[id]) this.error('Special func not found', token, this.position, id, Specials);
            const data = [Functions.share].includes(Functions[id]) ? command.fields.shift() : '';
            const special: SpecialLink = {
              title: command.fields.join(' '),
              id,
              data,
            };
            // TODO: allow commands to be attached to jumps somehow, i.e. do X when jumping
            section!.next.push(special);
            break;

          // state <id> <modifier>
          case CommandType.state:
            const state: ChangeState = {
              type: ElementType.state,
              id: command.fields[0].toLowerCase(),
              modifier: command.fields[1],
            };
            topContainer(token, this.position, command).elements.push(state);
            break;

          // TODO: better to resolve this switch case into two commands // item and // removeitem or // itemremove?
          // item <id>
          // OR
          // item remove <id>
          case CommandType.item:
            if (!section) this.error('Found a "// item" before first "// section"', token, this.position, command);
            const item = (command.fields[0].toLowerCase() === 'remove')
              ? {
                type: ElementType.removeItem,
                id: command.fields[1].toLowerCase(),
              } as RemoveItem
              : {
                type: ElementType.addItem,
                id: command.fields[0].toLowerCase(),
              } as AddItem;
            topContainer(token, this.position, command).elements.push(item);
            break;

          // if
          case CommandType.if:
            if (ifElement) this.error('Found another "// if" before "// end if"', token, this.position, command);
            ifElement = {
              type: ElementType.if,
              condition: command.fields.join(' '),
              elements: [],
            };
            section!.elements.push(ifElement);
            break;

          // else
          case CommandType.else:
            if (!ifElement) this.error('Found "// else" before "// if"', token, this.position, command);
            elseElement = {
              type: ElementType.else,
              ifCondition: ifElement!.condition,
              elements: [],
            };
            section!.elements.push(elseElement);
            break;

          // endif
          case CommandType.endif:
            if (!ifElement) this.error('Found "// endif" before "// if"', token, this.position, command);
            ifElement = elseElement = null;
            break;

          case CommandType.comment:
            break; // ignore comments

          // style
          case CommandType.style:
            if (styleElement) this.error('Found another "// if" before "// end if"', token, this.position, command);
            const tempElement: Style = {
              type: ElementType.style,
              classes: command.fields.join(' '),
              elements: [],
            };
            topContainer(token, this.position, command).elements.push(tempElement);
            styleElement = tempElement;
            break;

          // endstyle
          case CommandType.endstyle:
            if (!styleElement) this.error('Found "// endstyle" before "// style"', token, this.position, command);
            styleElement = null;
            break;

          // credits
          // <title>
          case CommandType.credits:
            if (!book) this.error('Found a "// credits" before "// book"', token, this.position, command);
            const credits: Section = {
              id: Specials.credits,
              title: getTitle(command),
              elements: [],
              next: [],
            };
            book!.specials[Specials.credits] = credits;
            section = credits;
            break;

          // itemdef <id> <category?> <mediaUrl?> <mediaType?>
          case CommandType.itemDefinition:
            if (!book) this.error('Found a "// itemdef" before "// book"', token, this.position, command);
            itemDefinition = {
              id: command.fields[0].toLowerCase(),
              category: (command.fields[1] ?? '').toLowerCase(),
              mediaUrl: command.fields[2] ?? undefined,
              mediaType: command.fields[3] ? MediaType[command.fields[3]] : undefined,
              title: getTitle(command),
              elements: [],
            };
            book!.config.items.push(itemDefinition);
            break;

          // enditemdef
          case CommandType.endItemDefinition:
            if (!itemDefinition) this.error('Found "// enditemdef" before "// itemdef"', token, this.position, command);
            itemDefinition = null;
            break;

          // option <id>
          // <title>
          case CommandType.option:
            if (!book) this.error('Found a "// itemdef" before "// book"', token, this.position, command);
            option = {
              id: command.fields[0].toLowerCase(),
              title: getTitle(command),
              choices: [],
            };
            book!.config.options.push(option);
            break;

          // choice <id>
          case CommandType.choice:
            if (!option) this.error('Found a "// choice" before "// option"', token, this.position, command);
            const choice: Choice = {
              id: command.fields[0].toLowerCase(),
              title: getTitle(command),
              default: parseBool(command.fields[1], ['default']),
            };
            option!.choices.push(choice);
            break;

          // endoption
          case CommandType.endoption:
            if (!option) this.error('Found "// endoption" before "// option"', token, this.position, command);
            option = null;
            break;

          // feedback <enabled> <feedbackUrl?>
          // OR
          // feedback <enabled> url <feedbackUrl> <fragments1> <fragments2> ...
          case CommandType.feedback:
            if (!book) this.error('Found a "// feedback" before "// book"', token, this.position, command);
            const mode = (command.fields[1] ?? '').toLocaleLowerCase();
            const feedback: FeedbackMode = {
              enabled: parseBool(command.fields[0]),
              ...(mode !== 'url'
                ? {
                  feedbackLink: command.fields[1],
                }
                : {
                  feedbackLink: command.fields[2],
                  urlFragments: command.fields.slice(3),
                })
            };
            book!.config.feedbackMode = feedback;
            break;

          // language <id>
          case CommandType.language:
            if (!book) this.error('Found a "// language" before "// book"', token, this.position, command);
            // TODO: check against list of supported languages?
            book!.config.language = (command.fields[0] ?? 'en').toLowerCase();
            break;

          // pageScrollUpDelay <id>
          case CommandType.pageScrollUpDelay:
            if (!book) this.error('Found a "// pageScrollUpDelay" before "// book"', token, this.position, command);
            // TODO: merge this with language and others into something generic such as "// config ..."
            book!.config.pageScrollUpDelay = parseInt(command.fields[0] ?? 1);
            break;

          default:
            this.error(`Command type ${command.type} not implemented`, token, this.position, command);
        }
      } else { // text
        const container = topContainer(token);
        const element: Paragraph = {
          type: ElementType.paragraph,
          text: parseMarkdown(token.data),
        };
        container.elements.push(element);
      }

      this.position++;
    } while (this.position < tokens.length);

    if (!book) {
      this.error('// book not found', null);
    }
    return book!;
  }

  parseCommand(token: Token, index: number): Command {
    if (token.type != TokenType.command) {
      this.error('Cannot parse command, token is not a command', token, index);
    }
    // https://eslint.org/docs/rules/no-irregular-whitespace
    //                            handle nbsp
    const elements = token.data.split(/ |\u00A0/).map(s => s.trim()).filter(s => s.length > 0);
    return {
      type: elements[0].toLowerCase(),
      fields: elements.slice(1),
      line: token.line,
      ... (token.url ? { url: token.url } : {}),
    }
  }

  error(message: string, token: Token | null, index?: number, ...data: any[]) {
    console.error('Parsing error: ', message, token, index, ...data);
    throw new ParserError(`${message}: ${data}`, token ?? undefined, index);
  }
}
