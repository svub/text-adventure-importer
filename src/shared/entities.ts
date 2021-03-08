export interface HasElements {
  elements: Element[];
}

// generics
export interface Entity {
  id: string;
}
export interface Text {
  text?: string;
}
export interface Title {
  title: string;
}
export interface TextEntity extends Entity, Text {
}
export interface Reference {
  chapterId: string;
  sectionId: string;
}

// Config
export interface Choice extends Entity, Title {
  default?: boolean;
}
export interface Option extends Entity, Title {
  choices: Choice[];
}
export interface Config {
  themes?: string[];
  items: Item[];
  options: Option[];
  feedbackMode?: boolean;
  feedbackLink?: string;
  language?: string; // default 'en'
}

// entities

export enum Overlays {
  options = 'options',
  credits = 'credits',
  chapters = 'chapters',
  items = 'items',
  shareOverlay = 'shareOverlay',
}

export enum Functions {
  reset = 'reset',
  share = 'share',
}

export enum Pages {
  start = 'start',
}

export const Specials = { ...Overlays, ...Functions, ...Pages };
export type Specials = typeof Specials;

export interface Book extends Title {
  subTitle?: string;
  chapters: Chapter[];
  specials: {[id: string]: Section};
}

export interface Chapter extends Entity, Title {
  title: string;
  sections: Section[];
}

export interface Section extends HasElements, Entity, Title {
  elements: Element[];
  next: (Link | SpecialLink)[];
}

export interface Link extends Title, Reference {}

export interface SpecialLink extends Title, Entity {
  data?: string;
}

export function isSpecialLink(link: Link | SpecialLink): link is SpecialLink {
  return !!(link as SpecialLink).id;
}

export interface Item extends Entity, Title {
  thumbnail: string;
  media: string;
  description?: string;
  category?: string;
}

export interface State extends Entity {
  value: number;
}

// elements
export enum ElementType {
  paragraph = 'paragraph',
  if = 'if',
  else = 'else',
  addItem = 'addItem',
  removeItem = 'removeItem',
  state = 'state',
  style = 'style',
}

export type Element = {
  type: ElementType;
}
export interface Paragraph extends Element {
  type: ElementType.paragraph;
  text: string;
}
export interface If extends Element, HasElements {
  type: ElementType.if;
  condition: string;
}
export interface Else extends Element, HasElements {
  type: ElementType.else;
  ifCondition: string;
}
export interface AddItem extends Element {
  type: ElementType.addItem;
  id: string;
}
export interface RemoveItem extends Element {
  type: ElementType.removeItem;
  id: string;
}
export interface ChangeState extends Element {
  type: ElementType.state;
  id: string;
  modifier: string;
}
export interface Style extends Element, HasElements {
  type: ElementType.style;
  classes: string;
}
