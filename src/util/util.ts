import { Book, ElementType, HasElements, Reference, hasElements, Element } from "@/shared/entities";

export function downloadFile(data: Blob, fileName: string) {
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  link.remove();
}

export type ElementReference<Type extends Element> = Reference & {
  element: Type;
}

export function getAllElements<Type extends Element>(book: Book, filterType?: ElementType): ElementReference<Type>[] {
  function findElements(chapterId: string, sectionId: string, has: HasElements) {
    const results: ElementReference<Type>[] = [];
    has.elements.forEach((element) => {
      if (hasElements(element)) {
        results.push(...findElements(chapterId, sectionId, element as HasElements));
      }
      if (filterType && element.type != filterType) return;
      results.push({
        chapterId,
        sectionId,
        element: element as Type,
      });
    });
    return results;
  }

  const elements: ElementReference<Type>[] = [];
  book.chapters.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      elements.push(...findElements(chapter.id, section.id, section));
    });
  });
  return elements;
}