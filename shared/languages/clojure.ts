import clojure from './clojure.json';
import { genericPreamble } from './javascript';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return `(def result [])
;; Your logic here

(DM_setPanel result)
`;
  }

  return `(def transform (DM_getPanel ${panelIndex - 1}))
;; Your logic here
(DM_setPanel transform)`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(clojure.preamble, resultsFile, panelId, idMap);
}

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

export const CLOJURE = {
  name: clojure.name,
  defaultPath: clojure.defaultPath,
  defaultContent,
  preamble,
  exceptionRewriter,
};
