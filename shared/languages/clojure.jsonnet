{
  id: "clojure",
  name: "Clojure",
  defaultPath: "clojure",
  preamble: '
(ns main
  (:require [clojure.data.json :as json]))

(defn DM_getPanel [i]
  (json/read (java.io.FileReader.
    (str "$$RESULTS_FILE$$" (get (json/read-str "$$JSON_ID_MAP$$") (.toString i))))))

(defn DM_setPanel [v]
  (json/write (java.io.FileWriter. "$$PANEL_RESULTS_FILE$$") v))

(defn DM_getPanelFile [i]
  (str "$$RESULTS_FILE$$" (get (json/read-str "$$JSON_ID_MAP$$") (.toString i))))
',
}
