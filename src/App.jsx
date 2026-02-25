import { useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Tagging from "./pages/Tagging.jsx";
import SchemaEditor from "./components/SchemaEditor";
import SearchTags from "./components/SearchTags";
import { GiHamburgerMenu } from "react-icons/gi";
import teiOdd from "./tei_acallam.odd?url";
import "./index.css";

const App = () => {
  const [showNav, setShowNav] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Lifted State
  const [projectData, setProjectData] = useState(null);
  const [oddContent, setOddContent] = useState(null);

  const closeNav = () => setShowNav(false);

  // Called when user starts project from Home
  const handleProjectReady = (data) => {
    setProjectData(data);
    setActiveTab('tagging');
  };

  // Called when Tagging component updates (syncs back state)
  const handleProjectUpdate = (updates) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  };

  // Called when user creates new tag
  const handleSchemaUpdate = (newXml) => {
    setOddContent(newXml);
    // We could also re-parse modules here if needed, 
    // but ProjectSetup handles parsing logic usually.
    // For now, simple state lift.
  };

  return (
    <div className="app-container">
      <header>
        <GiHamburgerMenu onClick={() => setShowNav(!showNav)} />
      </header>

      <Navbar
        show={showNav}
        closeNav={closeNav}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main">
        {activeTab === 'home' && (
          <div className="tei-container">
            <div className="tei-section" style={{ textAlign: 'center', marginTop: '50px' }}>
              <h2>Welcome to TEI Editor</h2>
              <p>Navigate to the <strong>Tagging</strong> tab to start or continue your project.</p>
              <button
                className="tei-annotate-button"
                onClick={() => setActiveTab('tagging')}
                style={{ marginTop: '20px' }}
              >
                Go to Tagging
              </button>
            </div>
          </div>
        )}

        {/* Tagging stays mounted to preserve undo/redo history and text state */}
        <div style={{ display: activeTab === 'tagging' ? 'block' : 'none', height: '100%' }}>
          <Tagging
            projectData={projectData}
            onUpdate={handleProjectUpdate}
            oddFilePath={teiOdd}
            onODDLoaded={setOddContent}
            existingOdd={oddContent}
          />
        </div>

        {activeTab === 'search' && (
          <SearchTags projectData={projectData} />
        )}

        {activeTab === 'add-tag' && (
          <SchemaEditor
            oddContent={oddContent} // Pass the "current" ODD content
            onSave={handleSchemaUpdate}
            onCancel={() => setActiveTab('home')}
          />
        )}
      </main>
    </div>
  );
};

export default App;
