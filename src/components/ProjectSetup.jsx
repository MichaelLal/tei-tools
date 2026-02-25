import { useState, useEffect } from "react";
import { parseODD } from "../utils/oddUtils";
import Notification from "./Notification";
import SchemaEditor from "./SchemaEditor";
import "../pages/Tagging.css";

const ProjectSetup = ({ onProjectReady, oddFilePath, onODDLoaded, existingOdd }) => {
    const [mode, setMode] = useState(null);
    const [oddModules, setOddModules] = useState([]);
    const [oddContent, setOddContent] = useState(""); // Raw string
    const [notification, setNotification] = useState(null);
    const [metadata, setMetadata] = useState({
        title: "",
        author: "",
        sourceDesc: "Born digital"
    });

    useEffect(() => {
        const loadODD = async () => {
            // Priority 1: Use existing/modified ODD from App state
            if (existingOdd) {
                setOddContent(existingOdd);
                setOddModules(parseODD(existingOdd));
                return;
            }

            // Priority 2: Fetch from file
            try {
                const response = await fetch(oddFilePath);
                if (!response.ok) throw new Error("File not found");
                const text = await response.text();
                setOddContent(text);
                if (onODDLoaded) onODDLoaded(text); // Lift state up

                const modules = parseODD(text);
                setOddModules(modules);
                if (modules.length === 0) {
                    setNotification({
                        type: 'warning',
                        message: "ODD Parsing Warning",
                        detail: "No modules found. Please check the ODD file format."
                    });
                }
            } catch (error) {
                console.error("Error loading ODD file:", error);
                setNotification({
                    type: 'error',
                    message: "ODD Load Error",
                    detail: "Could not load src/tei_acallam.odd. Ensure the file exists."
                });
            }
        };
        loadODD();
    }, [oddFilePath, existingOdd]);

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        onProjectReady({
            type: 'new',
            metadata: metadata,
            content: ""
        });
    };

    const handleContinueEditing = () => {
        // Collect all available tags from the ODD modules
        const availableTags = oddModules.flatMap(m => m.elements).filter(t => t !== "(All elements)" && t);
        const uniqueTags = [...new Set(availableTags)].sort();

        // Default basic tags if ODD returns nothing (failsafe)
        const tagsToUse = uniqueTags.length > 0
            ? uniqueTags.map(t => ({ id: t, label: t }))
            : null; // Null tells editor to use its defaults, or we can pass defaults here.

        // Jump straight to editor
        onProjectReady({
            type: 'existing',
            content: "",
            metadata: null,
            tags: tagsToUse
        });
    };

    // Create Mode
    if (mode === 'create') {
        return (
            <div className="tei-container project-setup-container">
                <div className="tei-top-section setup-create-layout">
                    <div className="tei-section module-summary">
                        <h3 className="tei-section-title" style={{ fontSize: '0.8rem' }}>ODD Definitions ({oddModules.length} Modules)</h3>
                        <div className="odd-modules-list" style={{ fontSize: '0.8rem' }}>
                            {oddModules.map((mod) => (
                                <details key={mod.name} className="module-item">
                                    <summary><strong>{mod.name}</strong></summary>
                                    <div className="module-elements">
                                        {mod.elements.join(", ")}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>

                    <div className="tei-section project-form">
                        <h3 className="tei-section-title">Project Metadata</h3>
                        <form onSubmit={handleCreateSubmit}>
                            <div className="form-group">
                                <label className="tei-label">Title</label>
                                <input
                                    className="tei-input"
                                    value={metadata.title}
                                    onChange={e => setMetadata({ ...metadata, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="tei-label">Author</label>
                                <input
                                    className="tei-input"
                                    value={metadata.author}
                                    onChange={e => setMetadata({ ...metadata, author: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="tei-label">Source Description</label>
                                <input
                                    className="tei-input"
                                    value={metadata.sourceDesc}
                                    onChange={e => setMetadata({ ...metadata, sourceDesc: e.target.value })}
                                />
                            </div>
                            <div className="tei-button-group">
                                <button type="submit" className="tei-annotate-button">
                                    Start Project
                                </button>
                                <button
                                    type="button"
                                    className="tei-delete-button"
                                    onClick={() => setMode(null)}
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Cancel / Back
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        );
    }

    const handleSchemaSave = (newXml) => {
        // Update local state
        setOddContent(newXml);
        setOddModules(parseODD(newXml));
        setMode(null);
        setNotification({
            type: 'success',
            message: "Schema Updated",
            detail: "New element has been added to the active ODD schema."
        });
        // In a real app, we would POST this to a backend to save to disk.
        // For now, it persists in memory for the session.
    };

    if (mode === 'schema-edit') {
        return (
            <SchemaEditor
                oddContent={oddContent}
                onSave={handleSchemaSave}
                onCancel={() => setMode(null)}
            />
        );
    }

    // Default / Selection Mode
    return (
        <div className="tei-container project-setup-container">
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    detail={notification.detail}
                    onClose={() => setNotification(null)}
                />
            )}
            <div className="tei-top-section setup-options">
                <div className="tei-section">
                    <h2 className="tei-section-title">Start Project</h2>
                    <div className="setup-buttons">
                        <button
                            className="tei-annotate-button"
                            onClick={() => setMode('create')}
                        >
                            Create New File
                        </button>
                        <button
                            className="tei-export-button"
                            onClick={handleContinueEditing}
                        >
                            Continue Editing
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectSetup;
