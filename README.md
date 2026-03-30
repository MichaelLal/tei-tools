# TEI Annotation Tool

An AI-powered web application for semantic annotation and tagging of TEI (Text Encoding Initiative) XML documents. This tool simplifies the complex process of creating and validating TEI-compliant digital editions.

## Features

- **AI-Powered Assistance**: Integration with Google Gemini for automated entity recognition, tag suggestions, and structural validation.
- **ODD Schema Awareness**: Dynamically parses TEI ODD files to provide context-aware tagging and documentation.
- **Custom Schema Extension**: Easily add new TEI elements to your active session and export the updated ODD specification.
- **Real-time Validation**: Syntax and schema validation for XML snippets.
- **Interactive Tutorial**: Built-in guide to help users understand TEI tagging and AI features.
- **Safe Export**: Export your annotated text as clean, valid TEI XML.

## Technology Stack

- **Frontend**: React + Vite
- **Styling**: Vanilla CSS (Custom Design System)
- **AI**: Google Gemini API
- **XML Processing**: DOMParser and manual serialization for high-fidelity export.

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd tei-tool
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run in development mode**:
    ```bash
    npm run dev
    ```
4.  **Configuration**: Provide your **Gemini API Key** in the "Settings" or "Tagging" interface to enable AI features. 
    - Your key is stored **only in your browser's local storage**.
    - It is sent directly to Google's Gemini API endpoints.
    - No backend server is used for this tool, ensuring your keys and data stay private.

## Project Structure

- `src/components`: Reusable UI components (Navbar, Notification, etc.)
- `src/pages`: Main application views (Tutorial, Tagging, Setup)
- `src/utils`: Core logic for ODD parsing, XML validation, and AI integration.
- `src/tei_acallam.odd`: The default ODD schema used for the project.

## Development Note
This project was built as a student Final Year Project at **University College Cork (UCC)**. It focuses on the intersection of Digital Humanities and Artificial Intelligence.

## License
MIT License - see [LICENSE](LICENSE) for details.
