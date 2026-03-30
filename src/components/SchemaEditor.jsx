import React, { useState } from "react";
import { addElementToODD } from "../utils/oddUtils";
import "../pages/Tagging.css"; // Reuse existing styles

const SchemaEditor = ({ oddContent, onSave, onCancel }) => {
    const [name, setName] = useState("");
    const [module, setModule] = useState("core");
    const [description, setDescription] = useState("");
    const [error, setError] = useState(null);

    const validateName = (val) => {
        const regex = /^[a-zA-Z][a-zA-Z0-9]*$/;
        return regex.test(val);
    };

    const handleSave = () => {
        if (!validateName(name)) {
            setError("Invalid Name: Must start with a letter and contain only alphanumeric characters (no spaces).");
            return;
        }
        if (!description.trim()) {
            setError("Description is required.");
            return;
        }
        if (!oddContent) {
            setError("No ODD loaded to modify.");
            return;
        }

        try {
            const newXml = addElementToODD(oddContent, { name, module, description });
            onSave(newXml);
        } catch (err) {
            setError("Failed to update ODD: " + err.message);
        }
    };

    return (
        <div className="tei-container project-setup-container">
            <div className="tei-section" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 className="tei-section-title" style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Add New Schema Element</h2>

                {error && (
                    <div style={{
                        padding: '10px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '6px',
                        marginBottom: '15px',
                        border: '1px solid #f87171'
                    }}>
                        {error}
                    </div>
                )}

                <div className="tei-form-group">
                    <label className="tei-label">Element Name (Strict)</label>
                    <input
                        className="tei-input"
                        value={name}
                        onChange={(e) => { setError(null); setName(e.target.value); }}
                        placeholder="e.g. persName, placeName"
                    />
                    <small style={{ color: '#666', fontSize: '1rem' }}>CamelCase, no spaces, starts with letter.</small>
                </div>

                <div className="tei-form-group">
                    <label className="tei-label">TEI Module</label>
                    <select
                        className="tei-input"
                        value={module}
                        onChange={(e) => setModule(e.target.value)}
                    >
                        <option value="core">core (Common elements)</option>
                        <option value="namesdates">namesdates (People, Places)</option>
                        <option value="textstructure">textstructure (Divs, Paragraphs)</option>
                        <option value="header">header (Metadata)</option>
                        <option value="figures">figures (Tables, Figures)</option>
                        <option value="transcr">transcr (Transcription)</option>
                    </select>
                </div>

                <div className="tei-form-group">
                    <label className="tei-label">Description (Required)</label>
                    <textarea
                        className="tei-textarea"
                        style={{ height: '100px' }}
                        value={description}
                        onChange={(e) => { setError(null); setDescription(e.target.value); }}
                        placeholder="Describe the purpose of this element..."
                    />
                </div>

                <div className="tei-button-group" style={{ marginTop: '20px' }}>
                    <button
                        onClick={handleSave}
                        className="tei-annotate-button"
                        disabled={!name || !description}
                        style={{ opacity: (!name || !description) ? 0.6 : 1 }}
                    >
                        Save to Schema
                    </button>
                    <button
                        onClick={onCancel}
                        className="tei-delete-button"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchemaEditor;
