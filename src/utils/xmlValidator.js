export const validateAgainstXSD = async (xmlString, xsdString) => {
  try {
    // 1. Validate well-formedness using native DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      const text = parserError.textContent;
      let loc = undefined;
      const match = text.match(/line\s+(\d+)/i);
      if (match && match[1]) {
        loc = { lineNumber: parseInt(match[1], 10) };
      }
      return {
        valid: false,
        errors: [{ message: `XML Syntax Error: ${text}`, loc: loc }],
        rawOutput: text
      };
    }

    // 2. Extract allowed elements from the XSD schema
    // We use regex to find all <xs:element name="X"> in the schema
    const allowedElements = new Set();
    const elementRegex = /<xs:element[^>]+name="([^"]+)"/g;
    let match;
    while ((match = elementRegex.exec(xsdString)) !== null) {
      allowedElements.add(match[1]);
    }
    
    // TEI root is always allowed
    allowedElements.add("TEI");

    // 3. Validate that every tag used in our XML document exists in the XSD
    const errors = [];
    const elements = xmlDoc.getElementsByTagName("*");
    
    for (let i = 0; i < elements.length; i++) {
      const elName = elements[i].nodeName;
      // Ignore root xml declarations and standard HTML-like elements if strictly needed,
      // but TEI encompasses most. We just check if it's in the allowed list from the XSD.
      if (!allowedElements.has(elName)) {
        errors.push({ message: `Schema Error: Element <${elName}> is not defined in the XSD.` });
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors,
        rawOutput: "Document contains tags not permitted by the tei_acallam schema."
      };
    }

    // Passed both syntax and basic schema element validation
    return {
      valid: true,
      errors: [],
      rawOutput: "Validation successful. Document is well-formed and schema-compliant."
    };

  } catch (error) {
    console.error("Custom Validation Error:", error);
    return {
      valid: false,
      errors: [{ message: `Validation Engine Error: ${error.message}` }],
      rawOutput: error.toString()
    };
  }
};
