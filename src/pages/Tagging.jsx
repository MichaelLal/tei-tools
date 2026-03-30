import { useState, useEffect, useRef } from "react";
import ProjectSetup from "../components/ProjectSetup";
import Notification from "../components/Notification";
import { generateTEI } from "../utils/teiExport";
import { getGeminiFeedback, getGeminiSuggestions, getGeminiAutoAnnotations } from "../utils/gemini";
import teiOdd from "../tei_acallam.odd?url";
import teiXsd from "../tei_acallam.xsd?url";
import { validateAgainstXSD } from "../utils/xmlValidator";
import "./Tagging.css";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getEducationalHint = (errorMsg) => {
  if (!errorMsg) return "Please review the TEI Guidelines for this tag.";
  const cleanMsg = errorMsg.replace(/\{http:\/\/.*?\}/g, "");

  if (cleanMsg.includes("XML Syntax Error")) {
    return "This is a structural syntax error (e.g., missing a closing tag, typos, overlapping tags, or unescaped characters). Check the syntax on the highlighted line and ensure your XML tags are correctly opened and closed.";
  }

  if (cleanMsg.includes("not expected")) {
    const expectedListMatch = cleanMsg.match(/Expected is one of \(\s*(.*?)\s*\)/);
    if (expectedListMatch && expectedListMatch[1]) {
      return `This tag is not allowed here. The schema specifically expects one of the following tags instead: \n[ ${expectedListMatch[1]} ]`;
    }
    const singleMatch = cleanMsg.match(/Expected is \( (.*?) \)/);
    if (singleMatch && singleMatch[1]) {
      return `This tag is not allowed here. The schema specifically expects the following tag instead: <${singleMatch[1]}>`;
    }
    return "This tag is not allowed here. Check its parent element to see what tags are permitted, or ensure it is spelled correctly.";
  }

  if (errorMsg.includes("attribute") && errorMsg.includes("not allowed")) {
    const attrMatch = errorMsg.match(/attribute '(.*?)' is not allowed/i);
    if (attrMatch && attrMatch[1]) {
      return `The attribute "${attrMatch[1]}" is not permitted on this element. Remove it or update your schema.`;
    }
    return "This attribute is not defined for this element in your custom ODD schema. Remove it or update your ODD.";
  }

  if (errorMsg.includes("Missing child element")) {
    const missingMatch = errorMsg.match(/Expected is (?:one of )?\(\s*(.*?)\s*\)/);
    if (missingMatch && missingMatch[1]) {
      return `This element is missing required children tags. Please add one of the following according to the structure: \n[ ${missingMatch[1]} ]`;
    }
    return "This element requires specific children tags inside it to be valid. Please refer to your schema structure.";
  }

  if (errorMsg.includes("facet")) {
    return "The value inside this attribute is incorrectly formatted. It must strictly follow the data type pattern defined in your Schema (e.g. strict URIs or date formats).";
  }

  return "Review your custom schema definition to ensure this structure is explicitly allowed.";
};

const ENTITY_TYPES = [
  { id: "persName", label: "Person", descriptions: { en: "Names of specific individuals." }, usage: "Highlight a person's full name, first name, or alias (e.g., 'Patrick Pearse').", docSource: "tei_acallam.odd", docExample: '<persName type="hero">Finn mac Cumaill</persName>', exampleSource: "TEI P5 Guidelines", example: '<persName>Elvis Presley</persName>' },
  { id: "placeName", label: "Place", descriptions: { en: "Geographic locations or settlements." }, usage: "Highlight a city, country, or specific location name (e.g., 'Dublin').", docSource: "tei_acallam.odd", docExample: '<placeName ref="#tara">Teamhair</placeName>', exampleSource: "TEI P5 Guidelines", example: '<placeName>Rochester</placeName>' },
  { id: "orgName", label: "Organisation", descriptions: { en: "Named groups, institutions, or businesses." }, usage: "Highlight entities like 'General Post Office' or 'Fianna'.", docSource: "tei_acallam.odd", docExample: '<orgName type="band">na Fiann</orgName>', exampleSource: "TEI P5 Guidelines", example: '<orgName>Federal Bureau of Investigation</orgName>' },
  { id: "title", label: "Text / Work", descriptions: { en: "Titles of books, manuscripts, or artworks." }, usage: "Highlight the name of a published or historical document.", docSource: "tei_acallam.odd", docExample: '<title>Acallam na Senórach</title>', exampleSource: "TEI P5 Guidelines", example: '<title>A Christmas Carol</title>' },
  { id: "date", label: "Date", descriptions: { en: "Specific calendar dates." }, usage: "Highlight a date or timeframe (e.g., '1916-04-24' or 'Easter Monday').", docSource: "tei_acallam.odd", docExample: '<date when="1100">12th Century</date>', exampleSource: "TEI P5 Guidelines", example: '<date when="1980-02">early February 1980</date>' },
  { id: "time", label: "Time", descriptions: { en: "Specific times of day." }, usage: "Highlight a time reference (e.g., 'noon', '12:00').", docSource: "tei_acallam.odd", docExample: '<time when="06:00:00">maidin</time>', exampleSource: "TEI P5 Guidelines", example: '<time when="12:00:00">noon</time>' },
  { id: "roleName", label: "Role/Title", descriptions: { en: "Titles or roles held by people." }, usage: "Highlight noble or military titles like 'Commander', 'King', or 'President'.", docSource: "tei_acallam.odd", docExample: '<roleName type="title">Rí</roleName>', exampleSource: "TEI P5 Guidelines", example: '<roleName type="honorific">Sir</roleName>' },
  { id: "geogName", label: "Geographical Feature", descriptions: { en: "Natural geographic features." }, usage: "Highlight rivers, valleys, or mountains (e.g., 'River Liffey').", docSource: "tei_acallam.odd", docExample: '<geogName type="mountain">Sliabh na mBan</geogName>', exampleSource: "TEI P5 Guidelines", example: '<geogName>Windrush Valley</geogName>' },
  { id: "event", label: "Event", descriptions: { en: "Historical or named events." }, usage: "Highlight named events like 'Easter Rising' or 'Battle of Clontarf'.", docSource: "tei_acallam.odd", docExample: '<event><label>Cath Gabhra</label></event>', exampleSource: "TEI P5 Guidelines", example: '<event when="1415-10-25"><label>Battle of Agincourt</label></event>' },
  { id: "object", label: "Object", descriptions: { en: "Physical or historical objects." }, usage: "Highlight significant artifacts, weapons, or items.", docSource: "tei_acallam.odd", docExample: '<object type="weapon"><name>Sleá</name></object>', exampleSource: "TEI P5 Guidelines", example: '<object type="stele"><name>Rosetta Stone</name></object>' },
  { id: "note", label: "Note", descriptions: { en: "Editorial or contextual notes." }, usage: "Highlight text to explicitly mark it as a structured editorial note.", docSource: "tei_acallam.odd", docExample: '<note type="gloss">This refers to Finn.</note>', exampleSource: "TEI P5 Guidelines", example: '<note>The reading here is uncertain.</note>' },
  { id: "pb", label: "Page Break", descriptions: { en: "Page beginnings or breaks." }, usage: "Used to indicate the start of a new page.", docSource: "tei_acallam.odd", docExample: '<pb n="12a"/>', exampleSource: "TEI P5 Guidelines", example: '<pb n="1" facs="page1.png"/>' }
];

const Tagging = ({ projectData, onUpdate, oddFilePath, onODDLoaded, existingOdd }) => {
  const [isProjectActive, setIsProjectActive] = useState(false);
  const [text, setText] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [activeType, setActiveType] = useState("persName");
  const [page, setPage] = useState("1");
  const [metadata, setMetadata] = useState(null);

  // Custom preferred language for tag descriptions
  const [preferredLang, setPreferredLang] = useState("en");

  // New features state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [history, setHistory] = useState([]);

  // Dynamic tags from ODD
  const [availableTags, setAvailableTags] = useState(ENTITY_TYPES);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Validation State
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Mode: true = Editing Text (Unlocked), false = Annotating (Locked)
  const [isEditing, setIsEditing] = useState(true);

  // Usability features
  const [fontSize, setFontSize] = useState(16);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [previewZoomLevel, setPreviewZoomLevel] = useState(100);
  const [previewMode, setPreviewMode] = useState('text'); // 'text', 'full', 'hidden'
  const backdropRef = useRef(null);

  // AI & Suggestions State
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isVerifyingAi, setIsVerifyingAi] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [aiTextSuggestions, setAiTextSuggestions] = useState(null);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false);
  const [showAnnotateMenu, setShowAnnotateMenu] = useState(false);
  const [pendingAiAnnotations, setPendingAiAnnotations] = useState([]);

  // AI Configuration State
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gemini-2.5-flash"); // Changed default from 1.5 which is 404ing on this account

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
    const savedModel = localStorage.getItem("gemini_model");
    if (savedModel && !savedModel.includes("1.5")) {
      setModelName(savedModel);
    } else {
      localStorage.setItem("gemini_model", "gemini-2.5-flash");
      setModelName("gemini-2.5-flash");
    }
  }, []);

  const handleScroll = (e) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.target.scrollTop;
      backdropRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  useEffect(() => {
    if (!text || annotations.length === 0) {
      setSuggestedTags([]);
      return;
    }

    // Build unique tagged strings dictionary
    const taggedStrings = new Map();
    annotations.forEach(a => {
      const cleanText = a.text.trim();
      if (cleanText.length > 2) {
        taggedStrings.set(cleanText.toLowerCase(), { type: a.type, attributes: a.attributes, originalText: cleanText });
      }
    });

    const newSuggestions = [];
    const lowerText = text.toLowerCase();

    taggedStrings.forEach((tagInfo, searchStr) => {
      let startIndex = 0;
      let index;
      while ((index = lowerText.indexOf(searchStr, startIndex)) > -1) {
        const endIndex = index + searchStr.length;

        // Ensure not already inside an existing annotation
        const isAlreadyTagged = annotations.some(a =>
          (index >= a.start && index < a.end) ||
          (endIndex > a.start && endIndex <= a.end) ||
          (index <= a.start && endIndex >= a.end)
        );

        if (!isAlreadyTagged) {
          newSuggestions.push({
            id: `sug-${index}-${endIndex}`,
            start: index,
            end: endIndex,
            text: text.substring(index, endIndex),
            type: tagInfo.type,
            attributes: tagInfo.attributes
          });
        }
        startIndex = endIndex;
      }
    });

    // Group suggestions by matched word
    const grouped = newSuggestions.reduce((acc, sug) => {
      if (!acc[sug.text]) acc[sug.text] = { ...sug, instances: [] };
      acc[sug.text].instances.push(sug);
      return acc;
    }, {});

    setSuggestedTags(Object.values(grouped));
  }, [annotations, text]);

  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem("gemini_api_key", val);
  };

  const handleModelChange = (e) => {
    const val = e.target.value;
    setModelName(val);
    localStorage.setItem("gemini_model", val);
  };

  const handleAiValidation = async (annotation) => {
    if (!apiKey) {
      alert("Please configure your Gemini API Key in the AI Configuration panel below first!");
      return;
    }

    setIsVerifyingAi(true);
    setAiFeedback(null);

    let attrStr = "";
    if (annotation.attributes) {
      Object.entries(annotation.attributes).forEach(([k, v]) => {
        if (v) attrStr += ` ${k}="${v}"`;
      });
    }
    const xmlSnippet = `<${annotation.type}${attrStr}>${annotation.text}</${annotation.type}>`;

    try {
      const result = await getGeminiFeedback(apiKey, xmlSnippet, availableTags, modelName);
      setAiFeedback({ id: annotation.id, text: result });
    } catch (e) {
      setNotification({
        type: 'error',
        message: 'AI Validation Failed',
        detail: e.message
      });
      setAiFeedback({ id: annotation.id, text: `Error: ${e.message}` });
    } finally {
      setIsVerifyingAi(false);
    }
  };

  const handleGetAiSuggestions = async () => {
    if (!text || text.trim() === "") {
      setNotification({ type: 'error', message: 'No text available to analyze.' });
      return;
    }
    if (!apiKey) {
      alert("Please configure your Gemini API Key in the AI Configuration panel below first!");
      return;
    }

    setIsFetchingSuggestions(true);
    setAiTextSuggestions(null);
    try {
      // console.log(text);

      const result = await getGeminiSuggestions(apiKey, text, availableTags, modelName);
      setAiTextSuggestions(result);
    } catch (e) {
      setNotification({
        type: 'error',
        message: 'AI Suggestion Failed',
        detail: e.message
      });
      setAiTextSuggestions(`Error: ${e.message}`);
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  const handleAutoAnnotateFullText = async () => {
    setShowAnnotateMenu(false);
    if (!text || text.trim() === "") {
      setNotification({ type: 'error', message: 'No text available to analyze.' });
      return;
    }
    if (!apiKey) {
      alert("Please configure your Gemini API Key in the AI Configuration panel below first!");
      return;
    }

    setIsAutoAnnotating(true);
    setNotification({ type: 'info', message: 'AI is analyzing document. This may take a few seconds...' });

    try {
      const jsonStr = await getGeminiAutoAnnotations(apiKey, text, availableTags, modelName);
      const parsedItems = JSON.parse(jsonStr);

      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        setNotification({ type: 'warning', message: 'No tags matched by AI.' });
        setIsAutoAnnotating(false);
        return;
      }

      const pendingList = [];
      let matchCount = 0;

      parsedItems.forEach(item => {
        if (!item.text || !item.type) return;

        const searchStr = item.text;
        let startIndex = 0;
        let index;

        while ((index = text.toLowerCase().indexOf(searchStr.toLowerCase(), startIndex)) > -1) {
          const endIndex = index + searchStr.length;

          const isAlreadyTagged = annotations.some(a =>
            (index >= a.start && index < a.end) ||
            (endIndex > a.start && endIndex <= a.end) ||
            (index <= a.start && endIndex >= a.end)
          );

          if (!isAlreadyTagged) {
            pendingList.push({
              id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              start: index,
              end: endIndex,
              text: text.substring(index, endIndex),
              type: item.type,
              attributes: {}
            });
            matchCount++;
          }
          startIndex = endIndex;
        }
      });

      setPendingAiAnnotations(pendingList);
      setNotification({ type: 'success', message: `AI found ${matchCount} tags! Please review them in the list below.` });
    } catch (err) {
      setNotification({ type: 'error', message: `AI Auto-Tag Failed: ${err.message}` });
    } finally {
      setIsAutoAnnotating(false);
    }
  };

  const renderHighlightedText = (content, anns) => {
    if (!content) return null;
    if (!anns || anns.length === 0) return content;

    // Sort annotations by start index. For simple visualization, we assume no overlaps 
    // or we just render them sequentially. If they overlap, the first one wins here.
    const sorted = [...anns].sort((a, b) => a.start - b.start);

    const result = [];
    let lastIndex = 0;

    sorted.forEach(ann => {
      if (ann.start >= lastIndex) {
        // Push raw text before annotation
        result.push(content.slice(lastIndex, ann.start));

        // Generate a consistent pastel color based on the tag type
        const colorHash = ann.type.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = colorHash % 360;
        const highlightColor = `hsla(${hue}, 70%, 80%, 0.6)`;

        result.push(
          <mark key={ann.id} className="tei-highlight" style={{ backgroundColor: highlightColor }}>
            {content.slice(ann.start, ann.end)}
          </mark>
        );
        lastIndex = ann.end;
      }
    });

    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result;
  };

  // Effect to load project data when passed from App
  useEffect(() => {
    // Only load if we are not already working on this data (prevent overwrite loop)
    // For now, we assume if isProjectActive is false, we are loading fresh.
    // Ideally we would compare a project ID.
    if (projectData && !isProjectActive) {
      setText(projectData.content || "");
      if (projectData.metadata) {
        setMetadata(projectData.metadata);
      }
      if (projectData.tags) {
        setAvailableTags(projectData.tags);
        if (projectData.tags.length > 0) setActiveType(projectData.tags[0].id);
      }
      // If we have content, ensure we are in write mode or annotate mode as preferred? 
      // Defaulting to Editing (Write Mode) is fine.
      setIsProjectActive(true);
    }
  }, [projectData]);

  // Sync state back to App for Search/Persistence
  useEffect(() => {
    if (isProjectActive && onUpdate) {
      // Debounce could be added here if performance issues arise
      onUpdate({
        content: text,
        annotations: annotations,
        metadata: metadata,
        page: page
      });
    }
  }, [text, annotations, metadata, page]);

  const handleProjectReady = (data) => {
    // Local Init
    setText(data.content || "");
    if (data.metadata) setMetadata(data.metadata);
    if (data.tags) {
      setAvailableTags(data.tags);
      if (data.tags.length > 0) setActiveType(data.tags[0].id);
    }
    setIsProjectActive(true);

    // Sync specific initial data to Global App State
    if (onUpdate) onUpdate(data);
  };

  const uploadTextFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.xml')) {
      setNotification({
        type: 'error',
        message: "File Format Error",
        detail: "Please upload a .txt or .xml file."
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result);
      setAnnotations([]);
      setNotification({
        type: 'success',
        message: "File Loaded",
        detail: `Successfully loaded ${file.name}`
      });
    };
    reader.onerror = () => {
      setNotification({
        type: 'error',
        message: "Read Error",
        detail: "Could not read the file content."
      });
    };
    reader.readAsText(file);
  };

  const addAnnotation = () => {
    const ta = document.getElementById("tei-editor");
    if (!ta || ta.selectionStart === ta.selectionEnd) {
      setNotification({
        type: 'warning',
        message: "Selection Required",
        detail: "Please select text in the editor to annotate."
      });
      return;
    }

    const id = generateId();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const newAnnotation = {
      id,
      type: activeType,
      start,
      end,
      text: text.slice(start, end),
      attributes: {} // Init empty attributes
    };

    setAnnotations([...annotations, newAnnotation]);
    setSelectedAnnotationId(id); // Auto-select new annotation to edit attributes
    setNotification(null); // Clear any previous warnings
  };

  const removeAnnotation = (id) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const updateAnnotationAttribute = (key, value) => {
    if (!selectedAnnotationId) return;
    setAnnotations(annotations.map(a =>
      a.id === selectedAnnotationId
        ? { ...a, attributes: { ...a.attributes, [key]: value } }
        : a
    ));
  };

  // Get current selected annotation object
  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);

  // Comments Validation & Addition
  const addComment = () => {
    if (!newComment.trim()) {
      setNotification({
        type: 'warning',
        message: "Empty Comment",
        detail: "Please enter text before adding a comment."
      });
      return;
    }
    setComments([...comments, {
      id: generateId(),
      text: newComment,
      timestamp: new Date().toLocaleTimeString()
    }]);
    setNewComment("");
    setNotification(null);
  };

  const toggleMode = (targetMode) => {
    // If trying to go TO Edit mode (true) FROM Annotate mode (false)
    // and we have annotations, warn user.
    if (targetMode === true && !isEditing && annotations.length > 0) {
      if (!window.confirm("Switching to Edit Mode will CLEAR all existing annotations to prevent alignment errors. Continue?")) {
        return;
      }
      setAnnotations([]); // Clear if confirmed
    }
    setIsEditing(targetMode);
    setSelectedAnnotationId(null);
  };

  const handleCloseProject = () => {
    if (text || annotations.length > 0) {
      if (!window.confirm("Are you sure you want to close this project? Unsaved changes will be lost.")) {
        return;
      }
    }
    setIsProjectActive(false);
    setText("");
    setAnnotations([]);
    setHistory([]);
    setComments([]);
  };

  const saveToHistory = () => {
    const snap = {
      id: generateId(),
      timestamp: new Date().toLocaleTimeString(),
      text: text,
      annotations: [...annotations],
      page: page
    };
    setHistory([snap, ...history]);
  };

  const restoreFromHistory = (snap) => {
    if (window.confirm("Restore this version? Unsaved changes will be lost.")) {
      setText(snap.text);
      setAnnotations(snap.annotations);
      setPage(snap.page);
    }
  };

  const downloadTEI = () => {
    const xml = generateTEI(metadata, text, annotations, page);

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Tagged_File.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const xml = generateTEI(metadata, text, annotations, page);
      const res = await fetch(teiXsd);
      if (!res.ok) throw new Error("Could not fetch the XSD schema file.");
      const xsdString = await res.text();

      const result = await validateAgainstXSD(xml, xsdString);
      setValidationResult(result);
    } catch (err) {
      setValidationResult({ valid: false, errors: [{ message: err.message }] });
    }
    setIsValidating(false);
  };

  if (!isProjectActive) {
    return (
      <ProjectSetup
        onProjectReady={handleProjectReady}
        oddFilePath={oddFilePath || teiOdd}
        onODDLoaded={onODDLoaded}
        existingOdd={existingOdd}
      />
    );
  }

  return (
    <div className="tei-container">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          detail={notification.detail}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="tei-top-section">
        {/* Controls */}
        <div className="tei-control-panel">
          <button
            onClick={handleCloseProject}
            className="tei-delete-button"
            style={{ marginBottom: '10px', width: '100%', textAlign: 'center' }}
          >
            ← Back to Setup
          </button>

          <div className="tei-section mode-switch-section" style={{ marginBottom: '15px' }}>
            <h3 className="tei-section-title">Editor Mode</h3>
            <div className="tei-mode-toggle">
              <button
                className={`tei-toggle-btn ${isEditing ? 'active' : ''}`}
                onClick={() => toggleMode(true)}
              >
                Write Text
              </button>
              <button
                className={`tei-toggle-btn ${!isEditing ? 'active' : ''}`}
                onClick={() => toggleMode(false)}
              >
                Annotate
              </button>
            </div>
            <p className="tei-helper-text" style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
              {isEditing ? "Type freely. Tagging is disabled." : "Text is locked. Select text to tag."}
            </p>
          </div>

          {/* Dynamic Panel: Show Entity Types OR Attribute Editor */}
          {!isEditing && (
            !selectedAnnotation ? (
              <div className="tei-section">
                <h3 className="tei-section-title">Entity Types</h3>
                <div className="tei-search-container">
                  <input
                    type="text"
                    placeholder="Search tags..."
                    className="tei-search-input"
                    onChange={(e) => setActiveType(e.target.value)}
                    list="tag-options"
                  />
                  <datalist id="tag-options">
                    {availableTags.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </datalist>
                  <div className="tei-current-selection">
                    <span className="tei-label-small">Active: </span>
                    <span className="tei-active-tag">{availableTags.find(t => t.id === activeType)?.label || activeType}</span>
                  </div>
                  {(() => {
                    const activeMeta = availableTags.find(t => t.id === activeType);
                    let displayDescriptions = activeMeta?.descriptions || {};
                    let displayUsage = activeMeta?.usage;

                    const fallback = ENTITY_TYPES.find(t => t.id === activeType);

                    // Fallback to our rich hardcoded dictionary if generated from ODD and it has absolutely no descriptions!
                    if (Object.keys(displayDescriptions).length === 0) {
                      if (fallback && fallback.descriptions) {
                        displayDescriptions = fallback.descriptions;
                        displayUsage = fallback.usage;
                      }
                    }

                    // Define defaults for tags derived dynamically from ODD
                    let displayDocSource = activeMeta?.docSource || fallback?.docSource || "tei_acallam.odd";
                    let displayDocExample = activeMeta?.docExample || fallback?.docExample || `<${activeType}>Sample Text</${activeType}>`;
                    let displayExampleSource = activeMeta?.exampleSource || fallback?.exampleSource;
                    let displayExample = activeMeta?.example || fallback?.example; // may be undefined for dynamic tags

                    const availableLangs = Object.keys(displayDescriptions);

                    if (availableLangs.length > 0 || displayUsage || displayDocExample) {
                      // Autoselect 'en' if preferredLang is absent but 'en' exists, otherwise use the first language available.
                      const currentLang = availableLangs.includes(preferredLang)
                        ? preferredLang
                        : (availableLangs.includes("en") ? "en" : (availableLangs[0] || ""));

                      return (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', borderLeft: '3px solid #2d5a8c', fontSize: '0.85rem', color: '#444' }}>

                          {availableLangs.length > 0 && (
                            <div style={{ marginBottom: displayUsage || displayDocExample ? '10px' : '0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong>Description:</strong>
                                {availableLangs.length > 1 && (
                                  <select
                                    style={{ padding: '2px 4px', fontSize: '0.75rem', borderRadius: '3px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' }}
                                    value={currentLang}
                                    onChange={(e) => setPreferredLang(e.target.value)}
                                  >
                                    {availableLangs.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                                  </select>
                                )}
                              </div>
                              <div style={{ lineHeight: '1.4' }}>{displayDescriptions[currentLang]}</div>
                            </div>
                          )}

                          {displayUsage && (
                            <div style={{ paddingTop: availableLangs.length > 0 ? '10px' : '0', borderTop: availableLangs.length > 0 ? '1px solid #e0e0e0' : 'none', marginBottom: displayDocExample ? '10px' : '0' }}>
                              <strong>How to Use:</strong> {displayUsage}
                            </div>
                          )}

                          {displayDocExample && (
                            <div style={{ paddingTop: '10px', borderTop: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                              {displayDocSource && (
                                <div>
                                  <span className="source-badge doc" style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'inline-block', marginBottom: '4px' }}>
                                    📚 {displayDocSource}
                                  </span>
                                  <label className="tei-label" style={{ fontSize: '9px', letterSpacing: '1px', display: 'block', marginBottom: '2px' }}>SCHEMA SOURCE</label>
                                  <div className="example-box" style={{ padding: '6px', fontSize: '0.8rem', backgroundColor: '#1e293b', color: '#e2e8f0', borderRadius: '4px', fontFamily: 'monospace', overflowX: 'auto' }}>
                                    {displayDocExample}
                                  </div>
                                </div>
                              )}

                              {displayExampleSource && displayExample && (
                                <div>
                                  <span className="source-badge example" style={{ fontSize: '0.7rem', padding: '2px 6px', display: 'inline-block', marginBottom: '4px' }}>
                                    🌍 Official Source: {displayExampleSource}
                                  </span>
                                  <label className="tei-label" style={{ fontSize: '9px', letterSpacing: '1px', display: 'block', marginBottom: '2px' }}>OFFICIAL SOURCE</label>
                                  <div className="example-box" style={{ padding: '6px', fontSize: '0.8rem', backgroundColor: '#1e293b', color: '#e2e8f0', borderRadius: '4px', fontFamily: 'monospace', overflowX: 'auto' }}>
                                    {displayExample}
                                  </div>
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ) : (
              <div className="tei-section tei-attribute-editor">
                <div className="tei-section-header-row">
                  <h3 className="tei-section-title">Edit Tag: &lt;{selectedAnnotation.type}&gt;</h3>
                  <button className="tei-close-btn" onClick={() => setSelectedAnnotationId(null)}>Done</button>
                </div>

                <div className="tei-form-group">
                  <label className="tei-label">Type / Subtype</label>
                  <input
                    type="text"
                    className="tei-input"
                    placeholder="e.g. person, place..."
                    value={selectedAnnotation.attributes?.type || ""}
                    onChange={(e) => updateAnnotationAttribute("type", e.target.value)}
                  />
                </div>

                <div className="tei-form-group">
                  <label className="tei-label">xml:lang (Language)</label>
                  <select
                    className="tei-input"
                    value={selectedAnnotation.attributes?.["xml:lang"] || ""}
                    onChange={(e) => updateAnnotationAttribute("xml:lang", e.target.value)}
                  >
                    <option value="">(None)</option>
                    <option value="ga">Irish (ga)</option>
                    <option value="en">English (en)</option>
                    <option value="la">Latin (la)</option>
                  </select>
                </div>

                <div className="tei-form-group">
                  <label className="tei-label">Ref (URI/ID)</label>
                  <input
                    type="text"
                    className="tei-input"
                    placeholder="#id or http://..."
                    value={selectedAnnotation.attributes?.ref || ""}
                    onChange={(e) => updateAnnotationAttribute("ref", e.target.value)}
                  />
                </div>

                <div className="tei-form-group">
                  <label className="tei-label">Cert (Certainty)</label>
                  <select
                    className="tei-input"
                    value={selectedAnnotation.attributes?.cert || ""}
                    onChange={(e) => updateAnnotationAttribute("cert", e.target.value)}
                  >
                    <option value="">(None)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="tei-form-group">
                  <label className="tei-label">Resp (Responsibility)</label>
                  <input
                    type="text"
                    className="tei-input"
                    placeholder="Editor ID..."
                    value={selectedAnnotation.attributes?.resp || ""}
                    onChange={(e) => updateAnnotationAttribute("resp", e.target.value)}
                  />
                </div>

              </div>
            )
          )}

          {isEditing && (
            <div className="tei-section">
              <p className="tei-empty-text">Switch to "Annotate" mode to add tags.</p>
            </div>
          )}

          <div className="tei-section">
            <label className="tei-label">Upload Text File</label>
            <input
              type="file"
              accept=".txt,.xml"
              onChange={uploadTextFile}
              className="tei-file-input"
            />
          </div>

          <div className="tei-section">
            <label className="tei-label">Page Number</label>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="tei-input"
            />
          </div>

          <div className="tei-section">
            <button onClick={saveToHistory} className="tei-entity-button" style={{ width: '100%', textAlign: 'center' }}>
              Save to History
            </button>
          </div>

          <button
            onClick={downloadTEI}
            className="tei-export-button"
          >
            Export TEI XML
          </button>
        </div>

        {/* Editor */}
        <div className="tei-editor-section" style={{ minWidth: 0 }}>
          {/* Usability Toolbar */}
          <div className="tei-editor-toolbar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>
              {isEditing ? "Write Mode: Type your transcription below" : "Annotate Mode: Select text and click Annotate"}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Font Size (px):</span>
                <button onClick={() => setFontSize(s => Math.max(10, s - 1))} title="Decrease Font Size" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>-</button>
                <input type="number" value={fontSize} onChange={(e) => setFontSize(Math.max(10, Math.min(72, Number(e.target.value) || 14)))} style={{ width: '45px', padding: '2px 4px', textAlign: 'center', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '13px' }} title="Manual Font Size" />
                <button onClick={() => setFontSize(s => Math.min(72, s + 1))} title="Increase Font Size" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>+</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Zoom (%):</span>
                <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} title="Zoom Out" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>-</button>
                <input type="number" step="10" value={zoomLevel} onChange={(e) => setZoomLevel(Math.max(50, Math.min(300, Number(e.target.value) || 100)))} style={{ width: '50px', padding: '2px 4px', textAlign: 'center', border: '1px solid #d0d0d0', borderRadius: '4px', fontSize: '13px' }} title="Manual Zoom Level" />
                <button onClick={() => setZoomLevel(z => Math.min(300, z + 10))} title="Zoom In" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>+</button>
              </div>
            </div>
          </div>

          <div className="tei-editor-container" style={{ zoom: `${zoomLevel}%` }}>
            {/* Transparent backdrop for highlighting */}
            <div
              ref={backdropRef}
              className="tei-textarea-backdrop"
              style={{ fontSize: `${fontSize}px` }}
            >
              {renderHighlightedText(text, annotations)}
            </div>

            <textarea
              id="tei-editor"
              onScroll={handleScroll}
              placeholder={isEditing ? "Transcribe manuscript text here... or upload a file" : "Switch to Write Mode to edit text..."}
              value={text}
              onChange={(e) => isEditing && setText(e.target.value)}
              className={`tei-textarea ${!isEditing ? 'read-only' : ''}`}
              readOnly={!isEditing}
              style={{ fontSize: `${fontSize}px` }}
            />
          </div>

          <div className="tei-annotate-group" style={{ position: 'relative', display: 'flex' }}>
            <button
              onClick={addAnnotation}
              className="tei-annotate-button"
              disabled={isEditing}
              style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, opacity: isEditing ? 0.5 : 1, cursor: isEditing ? 'not-allowed' : 'pointer' }}
            >
              Annotate Selection
            </button>
            <button
              className="tei-annotate-button"
              disabled={isEditing || isAutoAnnotating}
              onClick={() => setShowAnnotateMenu(!showAnnotateMenu)}
              style={{ width: '40px', borderLeft: '1px solid rgba(255,255,255,0.3)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, opacity: isEditing ? 0.5 : 1, cursor: isEditing ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ▼
            </button>

            {showAnnotateMenu && !isEditing && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '5px', backgroundColor: 'white', border: '1px solid #d0d0d0', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10 }}>
                <button
                  onClick={handleAutoAnnotateFullText}
                  disabled={isAutoAnnotating}
                  style={{ display: 'block', width: '100%', padding: '10px 15px', border: 'none', backgroundColor: 'transparent', textAlign: 'left', cursor: isAutoAnnotating ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                >
                  {isAutoAnnotating ? "🤖 Analyzing..." : "✨ Auto-Annotate Full Text with AI"}
                </button>
              </div>
            )}
          </div>

          {/* AI Tagging Assistant */}
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={handleGetAiSuggestions}
              disabled={isFetchingSuggestions}
              className="tei-entity-button"
              style={{ width: '100%', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: isFetchingSuggestions ? 'wait' : 'pointer', border: '1px solid #1a73e8', backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 'bold' }}
            >
              {isFetchingSuggestions ? "🤖 Analyzing text..." : "🤖 Ask AI for Tagging Suggestions"}
            </button>
            {aiTextSuggestions && (
              <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #1a73e8', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: '#1a73e8' }}>AI Tagging Suggestions</strong>
                  <button onClick={() => setAiTextSuggestions(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666', lineHeight: 1 }}>&times;</button>
                </div>
                {aiTextSuggestions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Tools Section (Comments & History) */}
      <div className="tei-tools-grid">
        <div className="tei-tool-panel">
          <h3 className="tei-section-title">Comments</h3>
          <div className="tei-comments-input-group">
            <input
              type="text"
              className="tei-input"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button onClick={addComment} className="tei-annotate-button" style={{ width: 'auto', marginTop: '5px' }}>Add</button>
          </div>
          <div className="tei-list-container small-list">
            {comments.length === 0 && <p className="tei-empty-text">No comments yet</p>}
            {comments.map(c => (
              <div key={c.id} className="tei-comment-item">
                <small>{c.timestamp}</small>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="tei-tool-panel">
          <h3 className="tei-section-title">Saved History</h3>
          <div className="tei-list-container small-list">
            {history.length === 0 && <p className="tei-empty-text">No saved versions</p>}
            {history.map(h => (
              <div key={h.id} className="tei-history-item">
                <span>{h.timestamp} - Page {h.page}</span>
                <button onClick={() => restoreFromHistory(h)} className="tei-restore-button">Restore</button>
              </div>
            ))}
          </div>
        </div>

        <div className="tei-tool-panel">
          <h3 className="tei-section-title">AI Configuration</h3>
          <p style={{ fontSize: '0.8rem', color: '#555', margin: '0 0 10px 0' }}>Configure Gemini to enable tag validation and auto-suggestions.</p>
          <div className="tei-form-group">
            <input
              type="password"
              placeholder="Enter Gemini API Key..."
              value={apiKey}
              onChange={handleApiKeyChange}
              className="tei-input"
              style={{ padding: '6px', fontSize: '0.85rem' }}
            />
          </div>
          <div className="tei-form-group" style={{ marginTop: '10px' }}>
            <select
              className="tei-input"
              value={modelName}
              onChange={handleModelChange}
              style={{ padding: '6px', fontSize: '0.85rem' }}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (New Default)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro Exp</option>
              <option value="gemini-pro">Gemini 1.0 Pro (Legacy)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tei-bottom-section">
        {/* Preview */}
        <div className="tei-preview-box">
          <div className="tei-section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 className="tei-section-title" style={{ margin: 0 }}>TEI Preview</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <span style={{ fontSize: '0.8rem', color: '#666', alignSelf: 'center' }}>Zoom:</span>
                <button onClick={() => setPreviewZoomLevel(z => Math.max(50, z - 10))} title="Zoom Out" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>-</button>
                <span style={{ fontSize: '0.8rem', alignSelf: 'center', minWidth: '35px', textAlign: 'center' }}>{previewZoomLevel}%</span>
                <button onClick={() => setPreviewZoomLevel(z => Math.min(300, z + 10))} title="Zoom In" style={{ padding: '2px 8px', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold' }}>+</button>
              </div>
              <select
                value={previewMode}
                onChange={(e) => setPreviewMode(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', border: '1px solid #d0d0d0', borderRadius: '4px', backgroundColor: '#fff', fontWeight: 'bold', color: '#000', outline: 'none' }}
              >
                <option value="text">View: Annotated Text Only</option>
                <option value="full">View: Full TEI XML</option>
                <option value="hidden">Hide Preview</option>
              </select>
              <button
                onClick={handleValidate}
                className="tei-entity-button"
                disabled={isValidating}
                style={{ padding: '6px 16px', fontSize: '0.9rem', cursor: isValidating ? 'wait' : 'pointer' }}
              >
                {isValidating ? "Validating..." : "Validate XML"}
              </button>
            </div>
          </div>

          {validationResult && (
            <div style={{ marginBottom: '15px', padding: '10px', borderRadius: '4px', backgroundColor: validationResult.valid ? '#e6f4ea' : '#fce8e6', border: `1px solid ${validationResult.valid ? '#34a853' : '#ea4335'}` }}>
              <h4 style={{ margin: '0 0 5px 0', color: validationResult.valid ? '#1e8e3e' : '#d93025' }}>
                {validationResult.valid ? "✅ Validation Passed" : "❌ Validation Failed - Check the schema rules below!"}
              </h4>
              {!validationResult.valid && !!validationResult.errors && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#d93025' }}>
                    Found {validationResult.errors.length} schema violation(s).
                  </p>
                  <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#d93025', maxHeight: '150px', overflowY: 'auto' }}>
                    {validationResult.errors.map((err, idx) => {
                      const cleanMessage = err.message.replace(/\{http:\/\/.*?\}/g, "");
                      if (!err.loc) return <li key={idx} style={{ marginBottom: '4px' }}>System Error: {cleanMessage}</li>;
                      return <li key={idx} style={{ marginBottom: '4px' }}>Line {err.loc.lineNumber}: {cleanMessage}</li>;
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {previewMode !== 'hidden' && (
            <pre className="tei-preview-text" style={{ position: 'relative', fontSize: `${fontSize}px`, zoom: `${previewZoomLevel}%` }}>
              {(() => {
                const fullXml = generateTEI(metadata, text, annotations, page, true);
                const displayXml = previewMode === 'full' ? fullXml : generateTEI(metadata, text, annotations, page, false);

                let lineOffset = 0;
                if (previewMode !== 'full') {
                  const firstDisplayLine = displayXml.split('\n')[0].trim();
                  const fullLines = fullXml.split('\n');
                  const matchIndex = fullLines.findIndex(l => l.trim() === firstDisplayLine);
                  if (matchIndex !== -1) {
                    lineOffset = matchIndex;
                  }
                }

                if (!validationResult || validationResult.valid) return displayXml;

                const lines = displayXml.split('\n');
                return lines.map((lineContent, index) => {
                  const displayLineNum = index + 1;
                  const actualFullLineNum = displayLineNum + lineOffset;

                  const lineErrors = validationResult.errors?.filter(e => e.loc && e.loc.lineNumber === actualFullLineNum) || [];

                  if (lineErrors && lineErrors.length > 0) {
                    const errorMessages = lineErrors.map(e => {
                      const cleanMsg = e.message.replace(/\{http:\/\/.*?\}/g, "");
                      return `Error: ${cleanMsg}\n\n💡 How to Fix: ${getEducationalHint(e.message)}`;
                    }).join('\n\n---\n\n');
                    return (
                      <span
                        key={index}
                        className="error-highlight"
                        title={errorMessages}
                        style={{
                          backgroundColor: '#d93025',
                          color: 'white',
                          display: 'block',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          cursor: 'help'
                        }}
                      >
                        {lineContent}
                      </span>
                    );
                  }
                  return <span key={index} style={{ display: 'block', padding: '2px 4px' }}>{lineContent}</span>;
                });
              })()}
            </pre>
          )}
        </div>

        {/* Pending AI Annotations Review */}
        {pendingAiAnnotations.length > 0 && (
          <div className="tei-annotations-list" style={{ marginBottom: '20px', backgroundColor: '#fdf8e4', border: '1px solid #faebcc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 className="tei-section-title" style={{ color: '#8a6d3b', margin: 0 }}>Review AI Auto-Tags ({pendingAiAnnotations.length})</h3>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => { setAnnotations([...annotations, ...pendingAiAnnotations]); setPendingAiAnnotations([]); }}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', backgroundColor: '#dff0d8', color: '#3c763d', border: '1px solid #d6e9c6', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Accept All
                </button>
                <button
                  onClick={() => setPendingAiAnnotations([])}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', backgroundColor: '#f2dede', color: '#a94442', border: '1px solid #ebccd1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Reject All
                </button>
              </div>
            </div>
            <div className="tei-list-container">
              {pendingAiAnnotations.map(p => (
                <div key={p.id} className="tei-annotation-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #faebcc', marginBottom: '8px' }}>
                  <div className="tei-annotation-content" style={{ flex: 1 }}>
                    <strong className="tei-annotation-type" style={{ color: '#8a6d3b' }}>{p.type}</strong>
                    <p className="tei-annotation-text" style={{ margin: '4px 0 0 0' }}>"{p.text}"</p>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                    <button
                      onClick={() => { setAnnotations([...annotations, p]); setPendingAiAnnotations(pendingAiAnnotations.filter(x => x.id !== p.id)); }}
                      style={{ padding: '4px 10px', backgroundColor: '#dff0d8', color: '#3c763d', border: '1px solid #d6e9c6', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      title="Accept Tag"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setPendingAiAnnotations(pendingAiAnnotations.filter(x => x.id !== p.id))}
                      style={{ padding: '4px 10px', backgroundColor: '#f2dede', color: '#a94442', border: '1px solid #ebccd1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      title="Reject Tag"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annotations List */}
        <div className="tei-annotations-list">
          <h3 className="tei-section-title">Annotations ({annotations.length})</h3>
          <div className="tei-list-container">
            {annotations.length === 0 ? (
              <p className="tei-empty-text">Select text and annotate to get started</p>
            ) : (
              annotations.map(a => (
                <div
                  key={a.id}
                  className={`tei-annotation-item ${selectedAnnotationId === a.id ? 'selected-annotation' : ''}`}
                  onClick={() => setSelectedAnnotationId(a.id)}
                  style={{ cursor: 'pointer', border: selectedAnnotationId === a.id ? '2px solid #2d5a8c' : '1px solid #d0d0d0' }}
                >
                  <div className="tei-annotation-content">
                    <strong className="tei-annotation-type">{a.type}</strong>
                    <p className="tei-annotation-text">"{a.text}"</p>
                    {/* Show indicator if attributes exist */}
                    {a.attributes && Object.keys(a.attributes).length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                        {Object.entries(a.attributes).map(([k, v]) => v ? `${k}=${v} ` : '').join('')}
                      </div>
                    )}

                    {selectedAnnotationId === a.id && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAiValidation(a); }}
                          disabled={isVerifyingAi}
                          style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: '#e8f0fe', border: '1px solid #1a73e8', color: '#1a73e8', borderRadius: '4px', cursor: isVerifyingAi ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isVerifyingAi ? "🤖 Analyzing..." : "🤖 Ask AI for Feedback"}
                        </button>
                        {aiFeedback && aiFeedback.id === a.id && (
                          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#333' }}>
                            <strong style={{ display: 'block', marginBottom: '4px' }}>AI Feedback:</strong>
                            {aiFeedback.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAnnotation(a.id); }}
                    className="tei-delete-button"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* AI Tag Suggestions */}
          {suggestedTags.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 className="tei-section-title">Tag Suggestions ({suggestedTags.reduce((sum, g) => sum + g.instances.length, 0)})</h3>
              <div className="tei-list-container small-list" style={{ maxHeight: 'max-content' }}>
                {suggestedTags.map(group => (
                  <div key={group.id} className="tei-annotation-item" style={{ borderLeft: '4px solid #fbbc04', marginBottom: '8px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#b08000', fontSize: '0.9rem' }}>Suggest: &lt;{group.type}&gt;</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#444' }}>
                          Found <strong>{group.instances.length}</strong> matching instance(s) of <strong>"{group.text}"</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newAnnos = group.instances.map(inst => ({
                            id: `anno-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            start: inst.start,
                            end: inst.end,
                            text: inst.text,
                            type: inst.type,
                            attributes: { ...inst.attributes }
                          }));
                          setAnnotations([...annotations, ...newAnnos]);
                        }}
                        style={{ fontSize: '0.75rem', padding: '6px 10px', backgroundColor: '#fbbc04', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Tag All
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Tagging;
