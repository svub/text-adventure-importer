import { Book, Chapter, Section, ElementType, Paragraph, If, Else, HasElements, Link, ChangeState, AddItem, RemoveItem } from './entities';
import { Token, TokenType } from './Lexer';

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
}

export type Command = {
  type: string;
  fields: string[];
  line: number;
};

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
    const getTitle = (command: Command): string => {
      const next = tokens[this.position + 1];
      if (next.type !== TokenType.paragraph) {
        this.error('Book needs a title as text after // book command', command, next);
      }
      this.position++;
      return next.data;
    }
    const topContainer = (command?: Command): HasElements => {
      const element = ([elseElement, ifElement, section].find(e => e !== null));
      if (!element) {
        if (command)
          this.error(`Found a "// ${command.type}" before first "// section"`, command);
        else
          this.error('Found text before first "// section"');
      }
      return element!;
    }

    if (tokens.length < 1) {
      this.error('No tokens');
    }

    do {
      const token = tokens[this.position];

      if (token.type === TokenType.command) {
        const command = this.parseCommand(token);
        switch (command.type) {
          case CommandType.book:
            if (book) this.error('Found a second "// book" command. Book already initialize', book, command);
            book = {
              title: getTitle(command),
              chapters: [],
            }
            break;
          case CommandType.chapter:
            if (!book) this.error('Found a "// chapter" before "// book"', command);
            chapter = {
              id: command.fields[0],
              title: getTitle(command),
              sections: [],
            };
            book!.chapters.push(chapter);
            break;
          case CommandType.section:
            if (!chapter) this.error('Found a "// section" before first "// chapter"', command);
            section = {
              id: command.fields[0],
              title: getTitle(command),
              elements: [],
              next: [],
            };
            chapter!.sections.push(section);
            break;
          case CommandType.next:
            if (!chapter) this.error('Found a "// >" before first "// chapter"', command);
            if (!section) this.error('Found a "// >" before first "// section"', command);
            const link: Link = {
              title: command.fields.slice(1).join(' '),
              sectionId: command.fields[0],
              chapterId: chapter!.id, // same chapter link
            };
            // TODO add link related commands
            section!.next.push(link);
            break;
          case CommandType.jump:
            if (!section) this.error('Found a "// >" before first "// section"', command);
            const jump: Link = {
              title: command.fields.slice(2).join(' '),
              sectionId: command.fields[0],
              chapterId: command.fields[1], // cross chapter link
            };
            // TODO add related commands
            section!.next.push(jump);
            break;
          case CommandType.state:
            const state: ChangeState = {
              type: ElementType.state,
              id: command.fields[0],
              modifier: command.fields[1],
            };
            topContainer(command).elements.push(state);
            break;
          case CommandType.item:
            if (!section) this.error('Found a "// item" before first "// section"', command);
            const item = (command.fields[0].toLocaleLowerCase() === 'remove')
              ? {
                type: ElementType.removeItem,
                id: command.fields[1],
              } as RemoveItem
              : {
                type: ElementType.addItem,
                id: command.fields[0],
              } as AddItem;
            topContainer(command).elements.push(item);
            break;
          case CommandType.if:
            if (ifElement) this.error('Found another "// if" before "// end if"', command);
            ifElement = {
              type: ElementType.if,
              condition: command.fields.join(' '),
              elements: [],
            };
            section!.elements.push(ifElement);
            break;
          case CommandType.else:
            if (!ifElement) this.error('Found "// else" before "// if"', command);
            elseElement = {
              type: ElementType.else,
              ifCondition: ifElement!.condition,
              elements: [],
            };
            section!.elements.push(elseElement);
            break;
          case CommandType.endif:
            if (!ifElement) this.error('Found "// endif" before "// if"', command);
            ifElement = elseElement = null;
            break;
          default:
            this.error(`Command type ${command.type} not implemented`, command);
          }
      } else { // text
        if (!section) this.error('Found a text before first "// section"', token);
        const element: Paragraph = {
          type: ElementType.paragraph,
          text: token.data,
        };
        topContainer().elements.push(element);
      }

      this.position++;
      // if (this.position >= tokens.length) break; // done
    } while (this.position < tokens.length);
    if (!book) {
      this.error('// book not found');
    }
    return book!;
  }

  parseCommand(token: Token): Command {
    if (token.type != TokenType.command) {
      this.error('Cannot parse command, token is not a command', token);
    }
    const elements = token.data.split(' ').map(s => s.trim()).filter(s => s.length > 0);
    return {
      type: elements[0].toLocaleLowerCase(),
      fields: elements.slice(1),
      line: token.line,
    }
  }

  error(message: string, ...data: any[]) {
    console.error(message, ...data);
    throw new Error(`${message}: ${data}`);
  }
}
