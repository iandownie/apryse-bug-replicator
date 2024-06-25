import React, { useRef, useEffect, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import './App.css';

const App = () => {
  const viewer = useRef(null);
  const [highlights] = useState(new Map([["1", {term: "im", color: {r: 255, g: 0, b: 0}, regex: true, caseSensitive: false}], ["2", {term: "po", color: {r: 0, g: 255, b: 0}, regex: true, caseSensitive: true}]]))
  const [instance, setInstance] = useState(null);
  const [searchResults, setSearchResults] = useState(new Map());
  const [highlightAnnotations, setHighlightAnnotations] = useState(new Map());

  useEffect(() => {
    WebViewer(
      {
        path: '/webviewer/lib',
        initialDoc: '/files/PDFTRON_about.pdf',
        licenseKey: 'your_license_key'  // sign up to get a free trial key at https://dev.apryse.com
      },
      viewer.current,
    ).then((instance) => {
      const { documentViewer, annotationManager, Annotations } = instance.Core;
      setInstance(instance)
      window.instance = instance
      documentViewer.addEventListener('documentLoaded', () => {
        const rectangleAnnot = new Annotations.RectangleAnnotation({
          PageNumber: 1,
          // values are in page coordinates with (0, 0) in the top left
          X: 100,
          Y: 150,
          Width: 200,
          Height: 50,
          Author: annotationManager.getCurrentUser()
        });

        annotationManager.addAnnotation(rectangleAnnot);
        // need to draw the annotation otherwise it won't show up until the page is refreshed
        annotationManager.redrawAnnotation(rectangleAnnot);
      });
    });


  }, []);

  useEffect(() => {
    if (instance) {
      const { Annotations, annotationManager } = instance.Core;

      annotationManager.deleteAnnotations(
        annotationManager.getAnnotationsList()
      );

      for (const searchResult of searchResults) {
        const [id, resultGroup] = searchResult;
        if (resultGroup.length === 0) {
          return;
        }
        const highlight = highlights.get(id);
        const { r, g, b } = highlight.color;
        const results = [];
        resultGroup.forEach((result) => {
          const args = {
            PageNumber: result.pageNum,
            Quads: result.quads.map(
              (
                quad
              ) => ({
                x3: quad.x2,
                x4: quad.x1,
                y3: quad.cz,
                y4: quad.cz,
                ...quad
              })
            ),
            StrokeColor: new Annotations.Color(r, g, b, 1)
          };
          if (args.Quads.length === 0) {
            return;
          }
          const quadAnnot = new Annotations.TextHighlightAnnotation(args);

          results.push(quadAnnot);
        });
        console.log({results, resultGroup})
        annotationManager.addAnnotations(results);
        annotationManager.drawAnnotationsFromList(results);
        highlightAnnotations.set(id, results);
        setHighlightAnnotations(new Map(highlightAnnotations));
      }
    }
  }, [searchResults]);

  return (
    <div className="App">
      <button onClick={()=>replicateSearch(false, false)}>normal search (Problem: half the quad properties are uglified)</button>
      <button onClick={()=>replicateSearch(true, false)}>search wherein a map gets set (Problem: search silently breaks until page refresh)</button>
      <button onClick={()=>replicateSearch(false, true)}>search wherein regex is used (Problem: No quads returned)</button>
      <button onClick={()=>instance.Core.annotationManager.deleteAnnotations(
        instance.Core.annotationManager.getAnnotationsList()
      )}>Clear Anotation (No problem, just added for convenience)</button>
      <div className="header">React sample</div>
      <div className="webviewer" ref={viewer}></div>
    </div>
  );

  function replicateSearch(withMap = false, regex = false){
    const highlightsArr = [["1", {term: "im", color: {r: 255, g: 0, b: 0}, regex}], ["2", {term: "po", color: {r: 0, g: 255, b: 0}, regex}]]
    recurseThroughSearches(highlightsArr);
    const otherMap = new Map();
    otherMap.set("1", ["term"]);
    function recurseThroughSearches(highlightArray) {
      const [id, currentHighlight] = highlightArray.shift();
      const results = [];
      const mode = getSearchMode(currentHighlight);
      instance.Core.documentViewer.textSearchInit(currentHighlight.term, mode, {
        fullSearch: true,
        onError: (error) => {
          console.error(error);
        },
        onResult: (result) => {
          console.log({ result });
          results.push(result);
          if(withMap){
            const prevValue = otherMap.get(id);
            otherMap.set(id, [...prevValue, "new"]);
          }
          
        },
        onDocumentEnd() {
          searchResults.set(id, results);
          if (highlightArray.length < 1) {
            setSearchResults(new Map(searchResults));
          } else {
            recurseThroughSearches(highlightArray);
          }
        }
      });
    }
  }

  function getSearchMode(highlight) {
    if (instance) {
      const {
        Core: {
          Search: {
            Mode: { CASE_SENSITIVE, REGEX }
          }
        }
      } = instance;
      /*eslint no-bitwise: ["error", { "allow": ["|"] }] */
      switch (true) {
        case highlight.regex && highlight.caseSensitive:
          return REGEX | CASE_SENSITIVE;
        case highlight.regex:
          return REGEX; 
        case highlight.caseSensitive:
          return CASE_SENSITIVE;
        default:
          return 56; // Found this with instance.Core.documentViewer.getCurrentSearchMode(). I think it's the default?
      }
    }
  }
};

export default App;
