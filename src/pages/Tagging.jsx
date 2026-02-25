import { useState, useEffect } from "react";
import ProjectSetup from "../components/ProjectSetup";
import Notification from "../components/Notification";
import { generateTEI } from "../utils/teiExport";
import teiOdd from "../tei_acallam.odd?url";
import "./Tagging.css";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ENTITY_TYPES = [
  { id: "persName", label: "Person" },
  { id: "placeName", label: "Place" },
  { id: "orgName", label: "Organisation" },
  { id: "title", label: "Text / Work" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "roleName", label: "Role/Title" },
  { id: "geogName", label: "Geographical Feature" },
  { id: "event", label: "Event" },
  { id: "object", label: "Object" }
];

const Tagging = ({ projectData, onUpdate, oddFilePath, onODDLoaded, existingOdd }) => {
  const [isProjectActive, setIsProjectActive] = useState(false);
  const [text, setText] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [activeType, setActiveType] = useState("persName");
  const [page, setPage] = useState("1");
  const [metadata, setMetadata] = useState(null);

  // New features state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [history, setHistory] = useState([]);

  // Dynamic tags from ODD
  const [availableTags, setAvailableTags] = useState(ENTITY_TYPES);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Mode: true = Editing Text (Unlocked), false = Annotating (Locked)
  const [isEditing, setIsEditing] = useState(true);

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
        <div className="tei-editor-section">
          <textarea
            id="tei-editor"
            placeholder={isEditing ? "Transcribe manuscript text here... or upload a file" : "Switch to Write Mode to edit text..."}
            value={text}
            onChange={(e) => isEditing && setText(e.target.value)}
            className={`tei-textarea ${!isEditing ? 'read-only' : ''}`}
            readOnly={!isEditing}
          />
          <button
            onClick={addAnnotation}
            className="tei-annotate-button"
            disabled={isEditing}
            style={{ opacity: isEditing ? 0.5 : 1, cursor: isEditing ? 'not-allowed' : 'pointer' }}
          >
            Annotate Selection
          </button>
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
      </div>

      <div className="tei-bottom-section">
        {/* Preview */}
        <div className="tei-preview-box">
          <h3 className="tei-section-title">TEI Preview (Full XML)</h3>
          <pre className="tei-preview-text">
            {generateTEI(metadata, text, annotations, page)}
          </pre>
        </div>

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
        </div>
      </div>
    </div>
  );
};

export default Tagging;
