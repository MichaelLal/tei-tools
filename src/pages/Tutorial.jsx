import { useState, useEffect } from "react";
import { parseODD } from "../utils/oddUtils";
import { getGeminiFeedback } from "../utils/gemini";
import teiOdd from "../tei_acallam.odd?url";
import "./Tutorial.css";

const ENTITY_TYPES = [
  { id: "persName", icon: "👤", label: "Person", desc: "(personal name) contains a proper noun or proper-noun phrase referring to a person, possibly including one or more of the person's forenames, surnames, honorifics, added names, etc.", usage: "Highlight a person's full name, first name, or alias.", docSource: "tei_acallam.odd", docExample: '<persName type="hero">Finn mac Cumaill</persName>', exampleSource: "TEI P5 Guidelines", example: '<persName>Elvis Presley</persName>' },
  { id: "placeName", icon: "📍", label: "Place", desc: "(place name) contains an absolute or relative place name.", usage: "Highlight a city, country, or specific location name.", docSource: "tei_acallam.odd", docExample: '<placeName ref="#tara">Teamhair</placeName>', exampleSource: "TEI P5 Guidelines", example: '<placeName>Rochester</placeName>' },
  { id: "orgName", icon: "🏢", label: "Organisation", desc: "(organization name) contains an organizational name.", usage: "Highlight entities like 'General Post Office' or 'Fianna'.", docSource: "tei_acallam.odd", docExample: '<orgName type="band">na Fiann</orgName>', exampleSource: "TEI P5 Guidelines", example: '<orgName>Federal Bureau of Investigation</orgName>' },
  { id: "title", icon: "📖", label: "Text / Work", desc: "(title) contains a title for any kind of work.", usage: "Highlight the name of a published or historical document.", docSource: "tei_acallam.odd", docExample: '<title>Acallam na Senórach</title>', exampleSource: "TEI P5 Guidelines", example: '<title>A Christmas Carol</title>' },
  { id: "date", icon: "📅", label: "Date", desc: "(date) contains a date in any format.", usage: "Highlight a date or timeframe.", docSource: "tei_acallam.odd", docExample: '<date when="1100">12th Century</date>', exampleSource: "TEI P5 Guidelines", example: '<date when="1980-02">early February 1980</date>' },
  { id: "time", icon: "🕒", label: "Time", desc: "(time) contains a phrase defining a time of day in any format.", usage: "Highlight a time reference.", docSource: "tei_acallam.odd", docExample: '<time when="06:00:00">maidin</time>', exampleSource: "TEI P5 Guidelines", example: '<time when="12:00:00">noon</time>' },
  { id: "roleName", icon: "🎖️", label: "Role/Title", desc: "(role name) contains a name component which indicates that the referent has a particular role or position in society, such as an official title or rank.", usage: "Highlight noble or military titles like 'Commander', 'King', or 'President'.", docSource: "tei_acallam.odd", docExample: '<roleName type="title">Rí</roleName>', exampleSource: "TEI P5 Guidelines", example: '<roleName type="honorific">Sir</roleName>' },
  { id: "geogName", icon: "🏔️", label: "Geographical Feature", desc: "(geographical name) identifies a name associated with some geographical feature such as Windrush Valley or Mount Sinai.", usage: "Highlight rivers, valleys, or mountains.", docSource: "tei_acallam.odd", docExample: '<geogName type="mountain">Sliabh na mBan</geogName>', exampleSource: "TEI P5 Guidelines", example: '<geogName>Windrush Valley</geogName>' },
  { id: "event", icon: "⚔️", label: "Event", desc: "(event) contains data relating to anything of significance that happens in time.", usage: "Highlight named events like 'Easter Rising' or 'Battle of Clontarf'.", docSource: "tei_acallam.odd", docExample: '<event><label>Cath Gabhra</label></event>', exampleSource: "TEI P5 Guidelines", example: '<event when="1415-10-25"><label>Battle of Agincourt</label></event>' },
  { id: "object", icon: "🏺", label: "Object", desc: "(object) contains a description of a single identifiable physical object, such as a 2nd century AD stone stele or a gold coin.", usage: "Highlight significant artifacts, weapons, or items.", docSource: "tei_acallam.odd", docExample: '<object type="weapon"><name>Sleá</name></object>', exampleSource: "TEI P5 Guidelines", example: '<object type="stele"><name>Rosetta Stone</name></object>' },
  { id: "note", icon: "🗒️", label: "Note", desc: "(note) contains a note or annotation.", usage: "Add supplementary information or explain a difficult passage.", docSource: "tei_acallam.odd", docExample: '<note type="gloss">This refers to Finn.</note>', exampleSource: "TEI P5 Guidelines", example: '<note>The reading here is uncertain.</note>' },
  { id: "pb", icon: "📄", label: "Page Break", desc: "(page beginning) marks the beginning of a new page in a paginated document.', usage: 'Include the 'n' attribute to specify the page number.", docSource: "tei_acallam.odd", docExample: '<pb n="12a"/>', exampleSource: "TEI P5 Guidelines", example: '<pb n="1" facs="page1.png"/>' },
];

const ATTRIBUTES = [
  { id: "xml:id", label: "Unique ID", desc: "A unique identifier for the element.", usage: "Use to link annotations or identify a person across multiple files.", docSource: "tei_acallam.odd", docExample: 'xml:id="finn1"', exampleSource: "TEI P5 Guidelines", example: 'xml:id="CH1"' },
  { id: "ref", label: "Reference", desc: "(reference) provides an explicit means of locating a full definition or identity for the entity being named by means of one or more URIs.", usage: "Use to link to Wikipedia or a biographical database.", docSource: "tei_acallam.odd", docExample: 'ref="#finn1"', exampleSource: "TEI P5 Guidelines", example: 'ref="http://en.wikipedia.org/wiki/William_Shakespeare"' },
  { id: "type", label: "Sub-type", desc: "characterizes the element in some sense, using any convenient classification scheme or typology.", usage: "For Place, type could be 'city' or 'street'. For Person, 'fictional' vs 'historical'.", docSource: "tei_acallam.odd", docExample: 'type="hero"', exampleSource: "TEI P5 Guidelines", example: 'type="fictional"' },
  { id: "xml:lang", label: "Language", desc: "Specifies the language of the content.", usage: "Use 'en' for English, 'ga' for Irish, 'fr' for French, etc.", docSource: "tei_acallam.odd", docExample: 'xml:lang="mga"', exampleSource: "TEI P5 Guidelines", example: 'xml:lang="fr"' },
  { id: "when", label: "Normalized Date", desc: "supplies the value of the date or time in a standard form, e.g. yyyy-mm-dd.", usage: "Standard format: YYYY-MM-DD.", docSource: "tei_acallam.odd", docExample: 'when="1100"', exampleSource: "TEI P5 Guidelines", example: 'when="2001-09-11"' },
  { id: "cert", label: "Certainty", desc: "(certainty) signifies the degree of certainty associated with the intervention or interpretation.", usage: "Values like 'high', 'medium', or 'low'. Useful for disputed identifications.", docSource: "tei_acallam.odd", docExample: 'cert="low"', exampleSource: "TEI P5 Guidelines", example: 'cert="high"' },
  { id: "resp", label: "Responsibility", desc: "(responsible party) indicates the agency responsible for the intervention or interpretation, for example an editor or transcriber.", usage: "Points to a person or editor ID (e.g., '#editor1').", docSource: "tei_acallam.odd", docExample: 'resp="#scribe1"', exampleSource: "TEI P5 Guidelines", example: 'resp="#editor"' },
];

const APP_FEATURES = [
  { id: "setup", icon: "🚀", label: "Project Setup", desc: "Initialize your project by loading a text file and an ODD schema.", usage: "Supports .txt and .xml files. ODD schemas dynamically load custom tags from your XML header." },
  { id: "annotation", icon: "✍️", label: "Smart Tagging", desc: "Highlight text to apply tags and attributes instantly.", usage: "In 'Annotate' mode, your chosen tag is applied as soon as you release the mouse. Use the sidebar to add attributes." },
  { id: "validation", icon: "✅", label: "Live Validation", desc: "The 'Validate' button checks your XML against the schema in real-time.", usage: "Errors are highlighted in the editor with tooltips explaining specific TEI schema violations." },
  { id: "search", icon: "🔍", label: "Advanced Search", desc: "Search through your annotations using complex filters.", usage: "Filter by tag type, attribute values (like xml:id), or the exact text within the tag." },
  { id: "export", icon: "💾", label: "Schema-Aware Export", desc: "Export your work as fully compliant TEI XML.", usage: "The tool automatically wraps your text in a valid <teiHeader>, <fileDesc>, and <body>." },
];

const GUIDES = [
  { id: "tutorial_guide", icon: "📜", label: "How Tutorial Works", desc: "Your interactive guide to the TEI ecosystem.", usage: "Switch tabs to explore tags, attributes, and features. Use the AI Assistant to test what you've learned on real XML snippets. Item descriptions provide context on why each tag is important." },
  { id: "gemini_guide", icon: "✨", label: "How Gemini Works", desc: "AI-powered TEI validation and educational feedback.", usage: "Paste a snippet on the right. Gemini checks if tags match TEI guidelines and suggests extra attributes or 'richer' encoding. It uses the model selection on the right for processing." },
  { id: "workflow", icon: "🔄", label: "Workflow Overview", desc: "The end-to-end annotation process.", usage: "1. Create/Load Project -> 2. Select Tag -> 3. Highlight Text -> 4. Add Attributes -> 5. Validate -> 6. Export." },
  { id: "schema_support", icon: "⚙️", label: "ODD Schema Support", desc: "How the tool handles custom TEI schemas.", usage: "The tool parses the <teiHeader> of your XML to find the <schemaSpec>. It then dynamically builds your tagging menu based on that ODD specification." },
];

const Tutorial = () => {
    const [category, setCategory] = useState("tags"); // tags, attributes, features
    const [selectedItem, setSelectedItem] = useState(ENTITY_TYPES[0]);
    const [apiKey, setApiKey] = useState("");
    const [snippet, setSnippet] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [modelName, setModelName] = useState(localStorage.getItem("gemini_model") || "gemini-2.5-flash");

    const [validTags, setValidTags] = useState(new Set());

    useEffect(() => {
        const loadSchema = async () => {
            try {
                const res = await fetch(teiOdd);
                const text = await res.text();
                const modules = parseODD(text);
                const tags = new Set(modules.flatMap(m => m.elements).map(e => e.id));
                setValidTags(tags);
            } catch (err) {
                console.error("Failed to load schema for tutorial", err);
            }
        };
        loadSchema();

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

    // Reset selected item when category changes
    useEffect(() => {
        if (category === "tags") setSelectedItem(ENTITY_TYPES[0]);
        else if (category === "attributes") setSelectedItem(ATTRIBUTES[0]);
        else if (category === "features") setSelectedItem(APP_FEATURES[0]);
        else if (category === "guides") setSelectedItem(GUIDES[0]);
    }, [category]);

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

    const runAiCheck = async () => {
        setIsLoading(true);
        setFeedback("");
        try {
            const res = await getGeminiFeedback(apiKey, snippet, ENTITY_TYPES, modelName);
            setFeedback(res);
        } catch (err) {
            setFeedback(`### AI Feedback Error\nYour API key might not have access to the selected model or has reached its quota.\n\n**Details:** ${err.message}`);
        }
        setIsLoading(false);
    };

    const renderContent = () => {
        let list = [];
        if (category === "tags") list = ENTITY_TYPES;
        else if (category === "attributes") list = ATTRIBUTES;
        else if (category === "features") list = APP_FEATURES;
        else if (category === "guides") list = GUIDES;

        return (
            <div className="tag-info-box">
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedItem.icon && <span>{selectedItem.icon}</span>}
                    {selectedItem.label}
                    {category === "attributes" && <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 400 }}>(@{selectedItem.id})</span>}
                </h4>
                
                <p style={{ margin: '8px 0', lineHeight: '1.5' }}>
                    <strong style={{ color: '#334155' }}>Description:</strong> {selectedItem.desc}
                </p>
                <p style={{ margin: '8px 0', lineHeight: '1.5' }}>
                    <strong style={{ color: '#334155' }}>Usage:</strong> {selectedItem.usage}
                </p>
                
                {category !== "features" && category !== "guides" && (
                    <div style={{ marginTop: '20px' }}>
                        {(category === "attributes" || validTags.size === 0 || validTags.has(selectedItem.id)) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {(selectedItem.docSource || selectedItem.exampleSource) && (
                                    <>
                                        {selectedItem.docSource && (
                                            <div>
                                                <span className="source-badge doc" style={{ display: 'inline-block', marginBottom: '8px' }}>
                                                    📚 Documentation: {selectedItem.docSource}
                                                </span>
                                                <label className="tei-label" style={{ fontSize: '10px', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>SCHEMA SOURCE</label>
                                                <div className="example-box">
                                                    {selectedItem.docExample || (category === "tags" ? 
                                                        `<${selectedItem.id}>Highlighted Text</${selectedItem.id}>` : 
                                                        `<persName ${selectedItem.id}="example_value">John Doe</persName>`
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {selectedItem.exampleSource && (
                                            <div>
                                                <span className="source-badge example" style={{ display: 'inline-block', marginBottom: '8px' }}>
                                                    🌍 Official Source: {selectedItem.exampleSource}
                                                </span>
                                                <label className="tei-label" style={{ fontSize: '10px', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>OFFICIAL SOURCE</label>
                                                <div className="example-box">
                                                    {selectedItem.example || (category === "tags" ? 
                                                        `<${selectedItem.id}>Highlighted Text</${selectedItem.id}>` : 
                                                        `<persName ${selectedItem.id}="example_value">John Doe</persName>`
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{ marginTop: '20px', padding: '10px', background: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid #ffeeba' }}>
                                ⚠️ This tag is not defined in the current TEI XML schema (tei_acallam.odd). Examples are disabled.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="tutorial-page">
            <div className="tutorial-container">
                <header className="tutorial-header">
                <h1>TEI Learning Hub</h1>
                <p>Interactive documentation and AI-powered feedback.</p>
            </header>

            <div className="tutorial-grid">
                {/* Left Side: Documentation Hub */}
                <section className="tutorial-card">
                    <div className="card-title">
                        <span>📖</span>
                        Documentation Hub
                    </div>
                    
                    {/* Category Selector */}
                    <div className="category-tabs" style={{ display: 'flex', gap: '5px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                        <button 
                            className={`tab-btn ${category === 'tags' ? 'active' : ''}`}
                            onClick={() => setCategory('tags')}
                        >
                            Tags
                        </button>
                        <button 
                            className={`tab-btn ${category === 'attributes' ? 'active' : ''}`}
                            onClick={() => setCategory('attributes')}
                        >
                            Attributes
                        </button>
                        <button 
                            className={`tab-btn ${category === 'features' ? 'active' : ''}`}
                            onClick={() => setCategory('features')}
                        >
                            Features
                        </button>
                        <button 
                            className={`tab-btn ${category === 'guides' ? 'active' : ''}`}
                            onClick={() => setCategory('guides')}
                        >
                            Guides
                        </button>
                    </div>
                    
                    <div className="tei-form-group">
                        <label className="tei-label" style={{ color: '#475569' }}>SELECT ITEM</label>
                        <select 
                            className="tei-input" 
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                borderRadius: '10px', 
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#fff'
                            }}
                            value={selectedItem.id}
                            onChange={(e) => {
                                let list = [];
                                if (category === "tags") list = ENTITY_TYPES;
                                else if (category === "attributes") list = ATTRIBUTES;
                                else if (category === "features") list = APP_FEATURES;
                                else if (category === "guides") list = GUIDES;
                                setSelectedItem(list.find(t => t.id === e.target.value));
                            }}
                        >
                            {(category === 'tags' ? ENTITY_TYPES : category === 'attributes' ? ATTRIBUTES : category === 'features' ? APP_FEATURES : GUIDES).map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.icon ? `${t.icon} ` : ''}{t.label} 
                                </option>
                            ))}
                        </select>
                    </div>

                    {renderContent()}
                </section>

                {/* Right Side: AI Assistant */}
                <section className="tutorial-card">
                    <div className="card-title">
                        <span>✨</span>
                        Gemini AI Assistant
                    </div>
                    
                    <div className="api-key-container">
                        <span title="Your API Key is saved locally">🔒</span>
                        <input 
                            type="password" 
                            placeholder="Gemini API Key..."
                            value={apiKey}
                            onChange={handleApiKeyChange}
                            style={{ flex: 1 }}
                        />
                        {!apiKey && <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>KEY REQUIRED</span>}
                    </div>

                    <div className="tag-info-box" style={{ background: '#fff', border: '1px solid #e2e8f0', marginBottom: '15px', padding: '10px' }}>
                        <label className="tei-label" style={{ color: '#475569', fontSize: '10px' }}>GEMINI AI MODEL</label>
                        <select 
                            className="tei-input" 
                            style={{ border: 'none', padding: '5px', fontSize: '0.9rem', color: '#1e293b', background: 'transparent' }} 
                            value={modelName}
                            onChange={handleModelChange}
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (New Default)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro Exp</option>
                            <option value="gemini-pro">Gemini 1.0 Pro (Legacy)</option>
                        </select>
                    </div>

                    <div className="tei-form-group">
                        <label className="tei-label" style={{ color: '#475569' }}>PASTE TEI SNIPPET OR TEXT</label>
                        <textarea 
                            className="ai-textarea tei-input" 
                            placeholder="Example: <p>On Easter Monday, Patrick Pearse read the Proclamation...</p>"
                            value={snippet}
                            onChange={(e) => setSnippet(e.target.value)}
                        />
                    </div>

                    <button 
                        className="shiny-button" 
                        onClick={runAiCheck}
                        disabled={isLoading || !snippet || !apiKey}
                        style={{ width: '100%', marginTop: '15px' }}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <div className="spinner"></div> Analyzing...
                            </span>
                        ) : "Run AI Verification"}
                    </button>
                    
                    <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#94a3b8', marginTop: '12px' }}>
                        AI will check definitions, verify context, and suggest richer encoding.
                    </p>
                </section>

                {/* Full Width: Feedback */}
                {feedback && (
                    <div className="feedback-section">
                        <div className="feedback-box">
                            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📋 Verification Report
                            </h3>
                            <div className="markdown-content">
                                {feedback}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            </div>
            
            <style>{`
                .tutorial-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                }
                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .markdown-content {
                    white-space: pre-wrap;
                }
                .tab-btn {
                    flex: 1;
                    padding: 8px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .tab-btn.active {
                    background: #fff;
                    color: #1e293b;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
            `}</style>
        </div>
    );
};

export default Tutorial;
