import { Disposable, window } from 'vscode';

import { LanguageConstants } from '../constants';

interface IHidableElement {
  show(): void;
  hide(): void;
}

export function enableOnlyForDafnyDocuments(element: IHidableElement): Disposable {
  // Immediately show the element if a Dafny document is already opened.
  updateVisibility(element);
  return window.onDidChangeActiveTextEditor(() => updateVisibility(element));
}

function updateVisibility(element: IHidableElement) {
  const editor = window.activeTextEditor;
  if(editor == null) {
    return;
  }
  const document = editor.document;
  if(document.languageId === LanguageConstants.Id) {
    element.show();
  } else {
    element.hide();
  }
}